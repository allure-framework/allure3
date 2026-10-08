import { readConfig } from "@allurereport/core";
import { epic, feature, label, story } from "allure-js-commons";
import { run } from "clipanion";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WatchCommand } from "../../src/commands/watch.js";

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

beforeEach(async () => {
  await epic("coverage");
  await feature("cli-run");
  await story("watch");
  await label("coverage", "cli-run");
  vi.clearAllMocks();
  discoveryUpdateHandlers.length = 0;

  (readConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
    output: "./allure-report",
    open: false,
    plugins: [],
  });
});

describe("watch command --new-only with dynamic directory discovery", () => {
  it("only skips the backlog for directories present at the initial scan, not ones discovered later", async () => {
    await run(WatchCommand, ["watch", "--new-only"]);

    // first discovery round: directory present from the start
    await discoveryUpdateHandlers[0](new Set(["/cwd/pkg-a/allure-results"]), new Set());
    // second discovery round: a directory created after watch started
    await discoveryUpdateHandlers[0](new Set(["/cwd/pkg-b/allure-results"]), new Set());

    expect(newFilesInDirectoryWatcherMock).toHaveBeenCalledWith(
      "/cwd/pkg-a/allure-results",
      expect.any(Function),
      expect.objectContaining({ ignoreInitial: true }),
    );
    expect(newFilesInDirectoryWatcherMock).toHaveBeenCalledWith(
      "/cwd/pkg-b/allure-results",
      expect.any(Function),
      expect.objectContaining({ ignoreInitial: false }),
    );
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
