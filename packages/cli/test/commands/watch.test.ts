import * as console from "node:console";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

import { readConfig } from "@allurereport/core";
import { newFilesInDirectoryWatcher } from "@allurereport/directory-watcher";
import { PathResultFile } from "@allurereport/reader-api";
import { epic, feature, label, step, story } from "allure-js-commons";
import { Cli, run } from "clipanion";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WatchCommand } from "../../src/commands/watch.js";
import { waitForAbort } from "../../src/utils/signals.js";
import { AllureReportMock } from "../utils.js";

const { exitMock, discoveryUpdateHandlers, newFilesInDirectoryWatcherMock, nameWatcherMock, globWatcherMock } =
  vi.hoisted(() => {
    const createWatcher = () => ({
      initialScan: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn().mockResolvedValue(undefined),
    });

    return {
      exitMock: vi.fn(),
      discoveryUpdateHandlers: [] as ((newDirs: Set<string>, deletedDirs: Set<string>) => Promise<void>)[],
      newFilesInDirectoryWatcherMock: vi.fn(() => createWatcher()),
      nameWatcherMock: vi.fn(
        (_cwd: string, update: (newDirs: Set<string>, deletedDirs: Set<string>) => Promise<void>) => {
          discoveryUpdateHandlers.push(update);

          return createWatcher();
        },
      ),
      globWatcherMock: vi.fn(
        (
          _cwd: string,
          _patterns: readonly string[],
          update: (newDirs: Set<string>, deletedDirs: Set<string>) => Promise<void>,
        ) => {
          discoveryUpdateHandlers.push(update);

          return createWatcher();
        },
      ),
    };
  });

vi.mock("node:console", async (importOriginal) => ({
  ...(await importOriginal()),
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
vi.mock("node:process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:process")>();
  const exitFn = (...args: unknown[]) => exitMock(...args);
  const processProxy = new Proxy(actual.default, {
    get: (target, prop, receiver) => (prop === "exit" ? exitFn : Reflect.get(target, prop, receiver)),
  });

  return {
    ...actual,
    default: processProxy,
    exit: exitFn,
  };
});
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal()),
  realpath: vi.fn().mockResolvedValue("/cwd"),
  rm: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@allurereport/core", async () => {
  const { AllureReportMock } = await import("../utils.js");

  return {
    AllureReport: AllureReportMock,
    isFileNotFoundError: vi.fn().mockReturnValue(false),
    readConfig: vi.fn(),
  };
});
vi.mock("@allurereport/static-server", () => ({
  serve: vi.fn().mockResolvedValue({
    url: "http://localhost:1234",
    open: vi.fn(),
    stop: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("../../src/commands/commons/resultsDiscovery.js", () => ({
  allureResultsDirectoriesGlobWatcher: globWatcherMock,
}));
vi.mock("@allurereport/directory-watcher", () => ({
  allureResultsDirectoriesWatcher: nameWatcherMock,
  newFilesInDirectoryWatcher: newFilesInDirectoryWatcherMock,
  difference: vi.fn(),
  watch: vi.fn(() => ({
    initialScan: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(undefined),
  })),
}));
vi.mock("../../src/utils/signals.js", () => ({
  notifySignals: vi.fn(() => ({
    signal: {},
    info: () => ({ signal: "SIGINT", code: 130 }),
    dispose: vi.fn(),
  })),
  waitForAbort: vi.fn().mockResolvedValue(undefined),
  boundedTerminationSignal: vi.fn(() => ({})),
}));

const createWatcher = () => ({
  initialScan: vi.fn().mockResolvedValue(undefined),
  abort: vi.fn().mockResolvedValue(undefined),
});

const notice = (skippedResults: number) =>
  `skipped ${skippedResults} existing result(s); pass --no-new-only to load them`;

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });

  return { promise, resolve };
};

let exitListeners: ReturnType<typeof process.listeners>;

beforeEach(async () => {
  await epic("coverage");
  await feature("cli-run");
  await story("watch");
  await label("coverage", "cli-run");
  vi.clearAllMocks();
  discoveryUpdateHandlers.length = 0;
  exitListeners = process.listeners("exit");

  exitMock.mockReset();
  newFilesInDirectoryWatcherMock.mockReset().mockImplementation(() => createWatcher());
  nameWatcherMock.mockReset().mockImplementation((_cwd, update) => {
    discoveryUpdateHandlers.push(update);

    return createWatcher();
  });
  globWatcherMock.mockReset().mockImplementation((_cwd, _patterns, update) => {
    discoveryUpdateHandlers.push(update);

    return createWatcher();
  });

  vi.mocked(readConfig).mockResolvedValue({
    output: "./allure-report",
    open: false,
    plugins: [],
  });
});

afterEach(() => {
  for (const listener of process.listeners("exit")) {
    if (!exitListeners.includes(listener)) {
      process.removeListener("exit", listener);
    }
  }
});

describe.each([
  { mode: "name-based discovery", resultsDir: [], patterns: [] },
  { mode: "explicit directory", resultsDir: ["./allure-results"], patterns: [] },
  { mode: "CLI glob", resultsDir: ["./packages/*/allure-results"], patterns: [] },
  { mode: "config glob", resultsDir: [], patterns: ["./packages/*/allure-results"] },
])("watch startup results with $mode", ({ resultsDir, patterns }) => {
  beforeEach(() => {
    vi.mocked(readConfig, { partial: true }).mockResolvedValueOnce({
      output: "./allure-report",
      open: false,
      plugins: [],
      resultsDir: patterns,
    });
  });

  it.each([
    { option: "default", args: [], skipsStartupResults: true, expectedNotice: notice(1) },
    { option: "--new-only", args: ["--new-only"], skipsStartupResults: true, expectedNotice: notice(1) },
    { option: "--no-new-only", args: ["--no-new-only"], skipsStartupResults: false, expectedNotice: undefined },
  ])(
    "$option skips only startup discovery results and keeps ingesting later ones",
    async ({ args, skipsStartupResults, expectedNotice }) => {
      const startupDirectory = "/cwd/pkg-a/allure-results";
      const laterDirectory = "/cwd/pkg-b/allure-results";
      const startupExistingFile = `${startupDirectory}/existing-result.json`;
      const startupLiveFile = `${startupDirectory}/live-result.json`;
      const laterExistingFile = `${laterDirectory}/existing-result.json`;
      const shutdown = deferred();
      const pendingWait = new Promise<void>(() => {});
      const callbacks = new Map<string, (file: string) => Promise<void>>();
      let runPromise: Promise<number> | undefined;

      newFilesInDirectoryWatcherMock.mockImplementation((directory, onNewFile) => {
        callbacks.set(directory, async (file) => {
          await onNewFile(file, undefined as never);
        });

        const initialFiles =
          directory === startupDirectory
            ? [startupExistingFile]
            : directory === laterDirectory
              ? [laterExistingFile]
              : [];

        return {
          initialScan: vi.fn(async () => {
            for (const file of initialFiles) {
              await onNewFile(file, undefined as never);
            }
          }),
          abort: vi.fn().mockResolvedValue(undefined),
        };
      });

      const createDiscoveryWatcher = (update: (newDirs: Set<string>, deletedDirs: Set<string>) => Promise<void>) => {
        discoveryUpdateHandlers.push(update);

        return {
          initialScan: vi.fn(async () => {
            await update(new Set([startupDirectory]), new Set());
          }),
          abort: vi.fn().mockResolvedValue(undefined),
        };
      };

      if (resultsDir.length === 0 && patterns.length === 0) {
        nameWatcherMock.mockImplementationOnce((_cwd, update) => createDiscoveryWatcher(update));
      } else {
        globWatcherMock.mockImplementationOnce((_cwd, _patterns, update) => createDiscoveryWatcher(update));
      }

      vi.mocked(waitForAbort)
        .mockImplementationOnce(() => shutdown.promise)
        .mockImplementationOnce(() => pendingWait);

      try {
        runPromise = Cli.from(WatchCommand).run(["watch", ...args, ...resultsDir]);

        await step("verify startup results are skipped by default and callbacks are still observed", async () => {
          await expect.poll(() => newFilesInDirectoryWatcherMock.mock.calls.length).toBe(1);
          expect(newFilesInDirectoryWatcherMock).toHaveBeenCalledWith(startupDirectory, expect.any(Function), {
            ignoreInitial: false,
          });
          await expect
            .poll(() => AllureReportMock.prototype.readResult.mock.calls.length)
            .toBe(skipsStartupResults ? 0 : 1);
          if (skipsStartupResults) {
            expect(vi.mocked(console.info)).toHaveBeenCalledWith(expectedNotice);
          } else {
            expect(vi.mocked(console.info)).not.toHaveBeenCalledWith(notice(1));
            expect(AllureReportMock.prototype.readResult).toHaveBeenCalledWith(new PathResultFile(startupExistingFile));
          }
        });

        await step("verify startup directories ingest later live results", async () => {
          await callbacks.get(startupDirectory)?.(startupLiveFile);

          await expect
            .poll(() => AllureReportMock.prototype.readResult.mock.calls.length)
            .toBe(skipsStartupResults ? 1 : 2);
          expect(AllureReportMock.prototype.readResult).toHaveBeenLastCalledWith(new PathResultFile(startupLiveFile));
        });

        await step("verify directories discovered after startup always ingest their backlog", async () => {
          await discoveryUpdateHandlers[0](new Set([laterDirectory]), new Set());

          await expect
            .poll(() => AllureReportMock.prototype.readResult.mock.calls.length)
            .toBe(skipsStartupResults ? 2 : 3);
          expect(newFilesInDirectoryWatcherMock).toHaveBeenLastCalledWith(laterDirectory, expect.any(Function), {
            ignoreInitial: false,
          });
          expect(AllureReportMock.prototype.readResult).toHaveBeenLastCalledWith(new PathResultFile(laterExistingFile));
        });

        shutdown.resolve();
        expect(await runPromise).toBe(0);
        runPromise = undefined;

        await step("verify results are not ingested twice", async () => {
          expect(AllureReportMock.prototype.readResult.mock.calls).toEqual(
            (skipsStartupResults
              ? [startupLiveFile, laterExistingFile]
              : [startupExistingFile, startupLiveFile, laterExistingFile]
            ).map((path) => [new PathResultFile(path)]),
          );
        });
      } finally {
        shutdown.resolve();
        await runPromise?.catch(() => undefined);
      }
    },
  );

  it("--new-only loads the backlog for the first directory discovered after an empty startup scan", async () => {
    const laterDirectory = "/cwd/pkg-a/allure-results";
    const laterExistingFile = `${laterDirectory}/existing-result.json`;
    const shutdown = deferred();
    const pendingWait = new Promise<void>(() => {});
    let runPromise: Promise<number> | undefined;

    newFilesInDirectoryWatcherMock.mockImplementation((directory, onNewFile) => ({
      initialScan: vi.fn(async () => {
        if (directory === laterDirectory) {
          await onNewFile(laterExistingFile, undefined as never);
        }
      }),
      abort: vi.fn().mockResolvedValue(undefined),
    }));

    const createDiscoveryWatcher = (update: (newDirs: Set<string>, deletedDirs: Set<string>) => Promise<void>) => {
      discoveryUpdateHandlers.push(update);

      return {
        initialScan: vi.fn(async () => {
          await update(new Set(), new Set());
        }),
        abort: vi.fn().mockResolvedValue(undefined),
      };
    };

    if (resultsDir.length === 0 && patterns.length === 0) {
      nameWatcherMock.mockImplementationOnce((_cwd, update) => createDiscoveryWatcher(update));
    } else {
      globWatcherMock.mockImplementationOnce((_cwd, _patterns, update) => createDiscoveryWatcher(update));
    }

    vi.mocked(waitForAbort)
      .mockImplementationOnce(() => shutdown.promise)
      .mockImplementationOnce(() => pendingWait);

    try {
      runPromise = Cli.from(WatchCommand).run(["watch", "--new-only", ...resultsDir]);

      await step("verify the empty initial discovery does not create file watchers or notices", async () => {
        await expect.poll(() => discoveryUpdateHandlers.length).toBe(1);
        expect(newFilesInDirectoryWatcherMock).not.toHaveBeenCalled();
        expect(vi.mocked(console.info)).not.toHaveBeenCalledWith(notice(1));
      });

      await step("verify the first later directory ingests its existing backlog", async () => {
        await discoveryUpdateHandlers[0](new Set([laterDirectory]), new Set());

        await expect.poll(() => AllureReportMock.prototype.readResult.mock.calls.length).toBe(1);
        expect(newFilesInDirectoryWatcherMock).toHaveBeenCalledExactlyOnceWith(laterDirectory, expect.any(Function), {
          ignoreInitial: false,
        });
        expect(AllureReportMock.prototype.readResult).toHaveBeenCalledWith(new PathResultFile(laterExistingFile));
      });

      shutdown.resolve();
      expect(await runPromise).toBe(0);
      runPromise = undefined;
    } finally {
      shutdown.resolve();
      await runPromise?.catch(() => undefined);
    }
  });
});

describe("watch result ingestion", () => {
  it.each([
    { option: "default", args: [], loadsStartupResults: false, expectedNotice: notice(1) },
    { option: "--new-only", args: ["--new-only"], loadsStartupResults: false, expectedNotice: notice(1) },
    { option: "--no-new-only", args: ["--no-new-only"], loadsStartupResults: true, expectedNotice: undefined },
  ])(
    "$option reads startup, live, and later-discovered results without duplicates",
    async ({ args, loadsStartupResults, expectedNotice }) => {
      const { mkdir, mkdtemp, rm, writeFile } =
        await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      const { newFilesInDirectoryWatcher: realFileWatcher } = await vi.importActual<
        typeof import("@allurereport/directory-watcher")
      >("@allurereport/directory-watcher");
      const shutdown = deferred();
      const pendingWait = new Promise<void>(() => {});
      const tempDir = await mkdtemp(join(tmpdir(), "allure-watch-"));
      const startupDirectory = join(tempDir, "pkg-a", "allure-results");
      const laterDirectory = join(tempDir, "pkg-b", "allure-results");
      const startupExistingFile = join(startupDirectory, "existing-result.json");
      const startupLiveFile = join(startupDirectory, "live-result.json");
      const laterExistingFile = join(laterDirectory, "existing-result.json");
      const fileWatchers: Array<ReturnType<typeof realFileWatcher>> = [];
      let runPromise: Promise<number> | undefined;

      try {
        await mkdir(startupDirectory, { recursive: true });
        await writeFile(startupExistingFile, JSON.stringify({ uuid: "existing", name: "existing", status: "passed" }));

        vi.mocked(waitForAbort)
          .mockImplementationOnce(() => shutdown.promise)
          .mockImplementationOnce(() => pendingWait);
        vi.mocked(newFilesInDirectoryWatcher).mockImplementation((directory, onNewFile, options) => {
          const watcher = realFileWatcher(directory, onNewFile, { ...options, indexDelay: 10 });

          fileWatchers.push(watcher);

          return watcher;
        });
        nameWatcherMock.mockImplementationOnce((_cwd, update) => {
          discoveryUpdateHandlers.push(update);

          return {
            initialScan: vi.fn(async () => {
              await update(new Set([startupDirectory]), new Set());
            }),
            abort: vi.fn().mockResolvedValue(undefined),
          };
        });

        runPromise = Cli.from(WatchCommand).run(["watch", ...args]);

        await step("verify startup ingestion and the skipped-results notice", async () => {
          await expect.poll(() => newFilesInDirectoryWatcherMock.mock.calls.length).toBe(1);
          expect(newFilesInDirectoryWatcherMock).toHaveBeenCalledWith(startupDirectory, expect.any(Function), {
            ignoreInitial: false,
          });
          await expect
            .poll(() => AllureReportMock.prototype.readResult.mock.calls.length)
            .toBe(loadsStartupResults ? 1 : 0);
          if (loadsStartupResults) {
            expect(vi.mocked(console.info)).not.toHaveBeenCalledWith(notice(1));
            expect(AllureReportMock.prototype.readResult).toHaveBeenCalledWith(new PathResultFile(startupExistingFile));
          } else {
            expect(vi.mocked(console.info)).toHaveBeenCalledWith(expectedNotice);
          }
        });

        await step("verify live results in startup directories are still ingested", async () => {
          await writeFile(startupLiveFile, JSON.stringify({ uuid: "live", name: "live", status: "passed" }));

          await expect
            .poll(() => AllureReportMock.prototype.readResult.mock.calls.length)
            .toBe(loadsStartupResults ? 2 : 1);
          expect(AllureReportMock.prototype.readResult).toHaveBeenLastCalledWith(new PathResultFile(startupLiveFile));
        });

        await step("verify later-discovered directories ingest their existing backlog", async () => {
          await mkdir(laterDirectory, { recursive: true });
          await writeFile(laterExistingFile, JSON.stringify({ uuid: "later", name: "later", status: "passed" }));
          await discoveryUpdateHandlers[0](new Set([laterDirectory]), new Set());

          await expect
            .poll(() => AllureReportMock.prototype.readResult.mock.calls.length)
            .toBe(loadsStartupResults ? 3 : 2);
          expect(newFilesInDirectoryWatcherMock).toHaveBeenLastCalledWith(laterDirectory, expect.any(Function), {
            ignoreInitial: false,
          });
          expect(AllureReportMock.prototype.readResult).toHaveBeenLastCalledWith(new PathResultFile(laterExistingFile));
        });

        shutdown.resolve();
        expect(await runPromise).toBe(0);
        runPromise = undefined;

        await step("verify startup results are not duplicated on shutdown", async () => {
          expect(AllureReportMock.prototype.readResult.mock.calls).toEqual(
            (loadsStartupResults
              ? [startupExistingFile, startupLiveFile, laterExistingFile]
              : [startupLiveFile, laterExistingFile]
            ).map((path) => [new PathResultFile(path)]),
          );
        });
      } finally {
        shutdown.resolve();
        await runPromise?.catch(() => undefined);
        for (const watcher of fileWatchers) {
          await watcher.abort(true);
        }
        await rm(tempDir, { recursive: true, force: true });
      }
    },
  );
});

describe("watch resultsDir discovery mode", () => {
  it("uses name-based discovery when CLI and config resultsDir are empty", async () => {
    await run(WatchCommand, ["watch"]);

    expect(nameWatcherMock).toHaveBeenCalled();
    expect(globWatcherMock).not.toHaveBeenCalled();
  });

  it("uses live re-glob for CLI Rest patterns", async () => {
    await run(WatchCommand, ["watch", "./packages/*/allure-results"]);

    expect(globWatcherMock).toHaveBeenCalledWith(
      "/cwd",
      ["./packages/*/allure-results"],
      expect.any(Function),
      expect.objectContaining({ indexDelay: 600 }),
    );
    expect(nameWatcherMock).not.toHaveBeenCalled();
  });

  it("uses live re-glob for config.resultsDir when Rest is empty", async () => {
    vi.mocked(readConfig).mockResolvedValueOnce({
      output: "./allure-report",
      open: false,
      plugins: [],
      resultsDir: ["./from-config/**/allure-results"],
    });

    await run(WatchCommand, ["watch"]);

    expect(globWatcherMock).toHaveBeenCalledWith(
      "/cwd",
      ["./from-config/**/allure-results"],
      expect.any(Function),
      expect.objectContaining({ indexDelay: 600 }),
    );
    expect(nameWatcherMock).not.toHaveBeenCalled();
  });

  it("prefers CLI Rest patterns over config.resultsDir", async () => {
    vi.mocked(readConfig).mockResolvedValueOnce({
      output: "./allure-report",
      open: false,
      plugins: [],
      resultsDir: ["./from-config"],
    });

    await run(WatchCommand, ["watch", "./cli-only/**/allure-results"]);

    expect(globWatcherMock).toHaveBeenCalledWith(
      "/cwd",
      ["./cli-only/**/allure-results"],
      expect.any(Function),
      expect.objectContaining({ indexDelay: 600 }),
    );
  });
});
