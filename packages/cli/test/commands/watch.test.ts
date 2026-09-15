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
import { AllureReportMock } from "../utils.js";

const { exitMock, discoveryUpdateHandlers, newFilesInDirectoryWatcherMock, nameWatcherMock, globWatcherMock } =
  vi.hoisted(() => {
    return {
      exitMock: vi.fn(),
      discoveryUpdateHandlers: [] as ((newDirs: Set<string>, deletedDirs: Set<string>) => Promise<void>)[],
      newFilesInDirectoryWatcherMock: vi.fn(() => ({
        initialScan: vi.fn().mockResolvedValue(undefined),
        abort: vi.fn().mockResolvedValue(undefined),
      })),
      nameWatcherMock: vi.fn(
        (_cwd: string, update: (newDirs: Set<string>, deletedDirs: Set<string>) => Promise<void>) => {
          discoveryUpdateHandlers.push(update);

          return {
            initialScan: vi.fn().mockResolvedValue(undefined),
            abort: vi.fn().mockResolvedValue(undefined),
          };
        },
      ),
      globWatcherMock: vi.fn(
        (
          _cwd: string,
          _patterns: readonly string[],
          update: (newDirs: Set<string>, deletedDirs: Set<string>) => Promise<void>,
        ) => {
          discoveryUpdateHandlers.push(update);

          return {
            initialScan: vi.fn().mockResolvedValue(undefined),
            abort: vi.fn().mockResolvedValue(undefined),
          };
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

let exitListeners: ReturnType<typeof process.listeners>;

beforeEach(async () => {
  await epic("coverage");
  await feature("cli-run");
  await story("watch");
  await label("coverage", "cli-run");
  vi.clearAllMocks();
  discoveryUpdateHandlers.length = 0;
  exitListeners = process.listeners("exit");

  (readConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
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
    { option: "default", args: [], ignoreInitial: false },
    { option: "--new-only", args: ["--new-only"], ignoreInitial: true },
    { option: "--no-new-only", args: ["--no-new-only"], ignoreInitial: false },
  ])("$option only skips existing results when explicitly requested", async ({ args, ignoreInitial }) => {
    await run(WatchCommand, ["watch", ...args, ...resultsDir]);

    await step("verify startup results are skipped only with --new-only", async () => {
      await discoveryUpdateHandlers[0](new Set(["/cwd/pkg-a/allure-results", "/cwd/pkg-b/allure-results"]), new Set());

      expect(newFilesInDirectoryWatcherMock).toHaveBeenCalledTimes(2);
      for (const directory of ["/cwd/pkg-a/allure-results", "/cwd/pkg-b/allure-results"]) {
        expect(newFilesInDirectoryWatcherMock).toHaveBeenCalledWith(directory, expect.any(Function), { ignoreInitial });
      }
    });

    await step("verify later directories always load their existing results", async () => {
      await discoveryUpdateHandlers[0](new Set(["/cwd/pkg-c/allure-results"]), new Set());

      expect(newFilesInDirectoryWatcherMock).toHaveBeenCalledTimes(3);
      expect(newFilesInDirectoryWatcherMock).toHaveBeenLastCalledWith(
        "/cwd/pkg-c/allure-results",
        expect.any(Function),
        { ignoreInitial: false },
      );
    });
  });

  it("--new-only loads results discovered after an empty initial scan", async () => {
    await run(WatchCommand, ["watch", "--new-only", ...resultsDir]);

    await step("verify an empty startup scan creates no file watchers", async () => {
      await discoveryUpdateHandlers[0](new Set(), new Set());

      expect(newFilesInDirectoryWatcherMock).not.toHaveBeenCalled();
    });

    await step("verify results in the first directory created after startup are loaded", async () => {
      await discoveryUpdateHandlers[0](new Set(["/cwd/pkg-a/allure-results"]), new Set());

      expect(newFilesInDirectoryWatcherMock).toHaveBeenCalledExactlyOnceWith(
        "/cwd/pkg-a/allure-results",
        expect.any(Function),
        { ignoreInitial: false },
      );
    });
  });
});

describe("watch result ingestion", () => {
  it.each([
    { option: "default", args: [], loadExisting: true },
    { option: "--new-only", args: ["--new-only"], loadExisting: false },
    { option: "--no-new-only", args: ["--no-new-only"], loadExisting: true },
  ])("$option reads the expected startup and live result files", async ({ args, loadExisting }) => {
    const { mkdir, mkdtemp, rm, writeFile } =
      await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    const { newFilesInDirectoryWatcher: realFileWatcher } = await vi.importActual<
      typeof import("@allurereport/directory-watcher")
    >("@allurereport/directory-watcher");
    const tempDir = await mkdtemp(join(tmpdir(), "allure-watch-"));
    const directory = join(tempDir, "allure-results");
    const existingFile = join(directory, "existing-result.json");
    const liveFile = join(directory, "live-result.json");
    const expectedReads = loadExisting ? 2 : 1;
    let fileWatcher: ReturnType<typeof realFileWatcher> | undefined;

    try {
      await mkdir(directory);
      await writeFile(existingFile, JSON.stringify({ uuid: "existing", name: "existing", status: "passed" }));

      vi.mocked(newFilesInDirectoryWatcher).mockImplementationOnce((path, onNewFile, options) => {
        fileWatcher = realFileWatcher(path, onNewFile, { ...options, indexDelay: 10 });
        return fileWatcher;
      });
      nameWatcherMock.mockImplementationOnce((_cwd, update) => ({
        initialScan: vi.fn(async () => {
          await update(new Set([directory]), new Set());
          await step("verify existing result ingestion after the real initial scan", async () => {
            expect(AllureReportMock.prototype.readResult).toHaveBeenCalledTimes(loadExisting ? 1 : 0);
            if (loadExisting) {
              expect(AllureReportMock.prototype.readResult).toHaveBeenCalledWith(new PathResultFile(existingFile));
            }
          });
          await step("verify live results are still ingested after startup", async () => {
            await writeFile(liveFile, JSON.stringify({ uuid: "live", name: "live", status: "passed" }));
            await expect.poll(() => AllureReportMock.prototype.readResult.mock.calls.length).toBe(expectedReads);
            expect(AllureReportMock.prototype.readResult).toHaveBeenLastCalledWith(new PathResultFile(liveFile));
          });
        }),
        abort: vi.fn().mockResolvedValue(undefined),
      }));

      expect(await Cli.from(WatchCommand).run(["watch", ...args])).toBe(0);

      await step("verify shutdown does not ingest results twice", async () => {
        expect(AllureReportMock.prototype.readResult).toHaveBeenCalledTimes(expectedReads);
      });
    } finally {
      await fileWatcher?.abort(true);
      await rm(tempDir, { recursive: true, force: true });
    }
  });
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
    (readConfig as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
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
    (readConfig as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
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
