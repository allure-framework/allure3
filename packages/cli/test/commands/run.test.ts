import * as console from "node:console";

import { readConfig } from "@allurereport/core";
import AwesomePlugin from "@allurereport/plugin-awesome";
import { epic, feature, label, story } from "allure-js-commons";
import { run, UsageError } from "clipanion";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { executeAllureRun } from "../../src/commands/commons/run.js";
import { RunCommand } from "../../src/commands/run.js";
import { ALLURE_CLI_ACTIVE_COMMAND_ENV } from "../../src/utils/execution-context.js";

const { exitMock, processStream, nameWatcherMock, globWatcherMock } = vi.hoisted(() => {
  const exitMock = vi.fn();
  const processStream = {
    setEncoding: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
  };
  const watcher = () => ({
    initialScan: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(undefined),
  });

  return {
    exitMock,
    processStream,
    nameWatcherMock: vi.fn(() => watcher()),
    globWatcherMock: vi.fn(() => watcher()),
  };
});

vi.mock("node:console", async (importOriginal) => ({
  ...(await importOriginal()),
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
vi.mock("node:process", async (importOriginal) => ({
  ...(await importOriginal()),
  exit: (...args: unknown[]) => exitMock(...args),
}));
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal()),
  realpath: vi.fn().mockResolvedValue("/cwd"),
  rm: vi.fn().mockResolvedValue(undefined),
  mkdtemp: vi.fn().mockResolvedValue("/tmp/run"),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@allurereport/core", async () => {
  const { AllureReportMock } = await import("../utils.js");

  return {
    AllureReport: AllureReportMock,
    QualityGateState: class {
      getResult() {
        return undefined;
      }

      setResult() {}
    },
    readConfig: vi.fn(),
    stringifyQualityGateResults: vi.fn(),
    isFileNotFoundError: vi.fn().mockReturnValue(false),
  };
});
vi.mock("../../src/commands/commons/resultsDiscovery.js", () => ({
  allureResultsDirectoriesGlobWatcher: globWatcherMock,
}));
vi.mock("@allurereport/directory-watcher", () => ({
  allureResultsDirectoriesWatcher: nameWatcherMock,
  delayedFileProcessingWatcher: vi.fn(() => ({
    addFile: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(undefined),
  })),
  newFilesInDirectoryWatcher: vi.fn(() => ({
    initialScan: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(undefined),
  })),
  difference: vi.fn((before: Set<string>, after: Set<string>) => [new Set(), new Set()]),
  watch: vi.fn(() => ({
    initialScan: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(undefined),
  })),
}));
vi.mock("../../src/utils/index.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/utils/index.js")>()),
  logTests: vi.fn(),
  runProcess: vi.fn(() => ({
    pid: 123,
    stdout: processStream,
    stderr: processStream,
  })),
  terminationOf: vi.fn().mockResolvedValue(0),
}));
vi.mock("../../src/utils/logs.js", () => ({
  logError: vi.fn(),
}));
vi.mock("../../src/utils/process.js", () => ({
  stopProcessTree: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@allurereport/static-server", async (importOriginal) => ({
  ...(await importOriginal()),
  serve: vi.fn(),
}));
beforeEach(async () => {
  await epic("coverage");
  await feature("cli-run");
  await story("run");
  await label("coverage", "cli-run");
  vi.clearAllMocks();
  delete process.env[ALLURE_CLI_ACTIVE_COMMAND_ENV];

  const { AllureReportMock } = await import("../utils.js");
  const { terminationOf } = await import("../../src/utils/index.js");

  AllureReportMock.prototype.store = {
    blockingFailedTestResults: vi.fn().mockResolvedValue([]),
    failedTestResults: vi.fn().mockResolvedValue([]),
    allTestResults: vi.fn().mockResolvedValue([]),
  };
  AllureReportMock.prototype.realtimeSubscriber = {
    onTestResults: vi.fn(() => () => {}),
  };
  AllureReportMock.prototype.realtimeDispatcher = {
    sendQualityGateResults: vi.fn(),
    sendGlobalAttachment: vi.fn(),
    sendGlobalError: vi.fn(),
    sendGlobalExitCode: vi.fn(),
  };
  AllureReportMock.prototype.validate = vi.fn().mockResolvedValue({
    results: [],
  });
  vi.mocked(terminationOf).mockReset();
  vi.mocked(terminationOf).mockResolvedValue(0);
});

describe("run command", () => {
  it("should fail with usage error when command to run is missing", async () => {
    const command = new RunCommand();

    command.commandToRun = [];

    await expect(command.execute()).rejects.toBeInstanceOf(UsageError);
  });

  it("should treat a path-like executable as the nested command", async () => {
    const { runProcess } = await import("../../src/utils/index.js");

    (readConfig as Mock).mockResolvedValueOnce({
      output: "./allure-report",
      open: false,
      plugins: [],
    });

    const command = new RunCommand();

    command.resultsDir = undefined;
    command.commandToRun = ["./script.sh", "--flag"];

    await command.execute();

    expect(runProcess).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "./script.sh",
        commandArgs: ["--flag"],
      }),
    );
  });

  it("should accept --results-dir and still run the nested command", async () => {
    const { runProcess } = await import("../../src/utils/index.js");

    (readConfig as Mock).mockResolvedValueOnce({
      output: "./allure-report",
      open: false,
      plugins: [],
      resultsDir: ["./from-config"],
    });

    await run(RunCommand, ["run", "--results-dir", "./custom/**/allure-results", "--", "npm", "test"]);

    expect(readConfig).toHaveBeenCalled();
    expect(runProcess).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "npm",
        commandArgs: ["test"],
      }),
    );
    expect(globWatcherMock).toHaveBeenCalledWith(
      "/cwd",
      ["./custom/**/allure-results"],
      expect.any(Function),
      expect.objectContaining({ indexDelay: 600 }),
    );
    expect(nameWatcherMock).not.toHaveBeenCalled();
  });

  it("should prefer repeated --results-dir over config.resultsDir for live discovery", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      output: "./allure-report",
      open: false,
      plugins: [],
      resultsDir: ["./from-config"],
    });

    await run(RunCommand, [
      "run",
      "--results-dir",
      "./a/**/allure-results",
      "--results-dir",
      "./b/allure-results",
      "--",
      "npm",
      "test",
    ]);

    expect(globWatcherMock).toHaveBeenCalledWith(
      "/cwd",
      ["./a/**/allure-results", "./b/allure-results"],
      expect.any(Function),
      expect.objectContaining({ indexDelay: 600 }),
    );
    expect(nameWatcherMock).not.toHaveBeenCalled();
  });

  it("should use config.resultsDir for live re-glob when --results-dir is omitted", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      output: "./allure-report",
      open: false,
      plugins: [],
      resultsDir: ["./from-config/**/allure-results"],
    });

    await run(RunCommand, ["run", "--", "npm", "test"]);

    expect(globWatcherMock).toHaveBeenCalledWith(
      "/cwd",
      ["./from-config/**/allure-results"],
      expect.any(Function),
      expect.objectContaining({ indexDelay: 600 }),
    );
    expect(nameWatcherMock).not.toHaveBeenCalled();
  });

  it("should use name-based discovery when CLI and config resultsDir are empty", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      output: "./allure-report",
      open: false,
      plugins: [],
    });

    await run(RunCommand, ["run", "--", "npm", "test"]);

    expect(nameWatcherMock).toHaveBeenCalledWith(
      "/cwd",
      expect.any(Function),
      expect.objectContaining({ indexDelay: 600 }),
    );
    expect(globWatcherMock).not.toHaveBeenCalled();
  });

  it("should pass hideLabels override to readConfig and apply normalized value to default awesome plugin", async () => {
    const { AllureReportMock } = await import("../utils.js");
    const { runProcess } = await import("../../src/utils/index.js");

    (readConfig as Mock).mockResolvedValueOnce({
      output: "./allure-report",
      open: false,
      hideLabels: ["owner"],
      plugins: [],
    });

    await run(RunCommand, ["run", "--hide-labels", "owner", "--", "npm", "test"]);

    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      output: undefined,
      name: undefined,
      open: undefined,
      port: undefined,
      hideLabels: ["owner"],
      historyLimit: undefined,
      resolutions: { knownIssuesPath: undefined },
    });
    expect(AllureReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hideLabels: ["owner"],
        plugins: expect.arrayContaining([
          expect.objectContaining({
            options: {},
            plugin: expect.any(AwesomePlugin),
          }),
        ]),
      }),
    );
    expect(runProcess).toHaveBeenCalledWith(
      expect.objectContaining({
        environmentVariables: {
          ALLURE_CLI_ACTIVE_COMMAND: "run",
        },
      }),
    );
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it("should pass hideLabels override to readConfig and keep normalized value on report config", async () => {
    const { AllureReportMock } = await import("../utils.js");
    const awesomePlugin = new AwesomePlugin({});

    (readConfig as Mock).mockResolvedValueOnce({
      output: "./allure-report",
      open: false,
      hideLabels: ["owner", "tag"],
      plugins: [
        {
          id: "custom-awesome",
          enabled: true,
          options: {},
          plugin: awesomePlugin,
        },
      ],
    });

    await run(RunCommand, ["run", "--hide-labels", "owner", "--hide-labels", "tag", "--", "npm", "test"]);

    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      output: undefined,
      name: undefined,
      open: undefined,
      port: undefined,
      hideLabels: ["owner", "tag"],
      historyLimit: undefined,
      resolutions: { knownIssuesPath: undefined },
    });
    expect(AllureReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hideLabels: ["owner", "tag"],
        plugins: expect.arrayContaining([
          expect.objectContaining({
            options: {},
            plugin: awesomePlugin,
          }),
        ]),
      }),
    );
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it("should run with rerun and skip configured quality gate without failing early", async () => {
    const { AllureReportMock } = await import("../utils.js");
    const { runProcess } = await import("../../src/utils/index.js");

    (readConfig as Mock).mockResolvedValueOnce({
      output: "./allure-report",
      open: false,
      qualityGate: {
        rules: [],
      },
      plugins: [],
    });

    await run(RunCommand, ["run", "--rerun", "2", "--", "npm", "test"]);

    expect(console.warn).toHaveBeenCalledWith(
      "Quality gate doesn't work with rerun; skipping quality gate validation.",
    );
    expect(AllureReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        qualityGate: undefined,
      }),
    );
    expect(AllureReportMock.prototype.realtimeSubscriber.onTestResults).not.toHaveBeenCalled();
    expect(AllureReportMock.prototype.validate).not.toHaveBeenCalled();
    expect(runProcess).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "npm",
        commandArgs: ["test"],
      }),
    );
    expect(exitMock).toHaveBeenCalledWith(0);
    expect(exitMock).not.toHaveBeenCalledWith(-1);
  });

  it("should pass known issues override to readConfig", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      output: "./allure-report",
      open: false,
      plugins: [],
    });

    await run(RunCommand, ["run", "--known-issues", "known.json", "--", "npm", "test"]);

    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      output: undefined,
      name: undefined,
      open: undefined,
      port: undefined,
      hideLabels: undefined,
      historyLimit: undefined,
      resolutions: { knownIssuesPath: "known.json" },
    });
  });

  it("should keep configured quality gate when rerun is zero", async () => {
    const { AllureReportMock } = await import("../utils.js");
    const qualityGate = {
      rules: [
        {
          maxFailures: 0,
        },
      ],
    };

    (readConfig as Mock).mockResolvedValueOnce({
      output: "./allure-report",
      open: false,
      qualityGate,
      plugins: [],
    });

    await run(RunCommand, ["run", "--rerun", "0", "--", "npm", "test"]);

    expect(console.warn).not.toHaveBeenCalledWith(
      "Quality gate doesn't work with rerun; skipping quality gate validation.",
    );
    expect(AllureReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        qualityGate,
      }),
    );
    expect(AllureReportMock.prototype.realtimeSubscriber.onTestResults).toHaveBeenCalled();
    expect(AllureReportMock.prototype.validate).toHaveBeenCalled();
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it("should stop, skip reruns, and publish only the first realtime fast-fail result", async () => {
    const { AllureReportMock } = await import("../utils.js");
    const { runProcess, terminationOf } = await import("../../src/utils/index.js");
    const { stopProcessTree } = await import("../../src/utils/process.js");
    const unsubscribe = vi.fn();
    let resolveOnTestResults!: (callback: (ids: string[]) => Promise<void>) => void;
    const onTestResultsReady = new Promise<(ids: string[]) => Promise<void>>((resolve) => {
      resolveOnTestResults = resolve;
    });
    let finishTestProcess!: (code: number | null) => void;
    const testProcessTermination = new Promise<number | null>((resolve) => {
      finishTestProcess = resolve;
    });
    const firstResult = {
      success: false,
      expected: 0,
      actual: 1,
      rule: "maxFailures",
      message: "Too many failures",
      testResults: ["tr-1"],
    };
    const laterResult = {
      ...firstResult,
      actual: 2,
      testResults: ["tr-1", "tr-2"],
    };

    AllureReportMock.prototype.realtimeSubscriber = {
      onTestResults: vi.fn((callback: (ids: string[]) => Promise<void>) => {
        resolveOnTestResults(callback);
        return unsubscribe;
      }),
    };
    AllureReportMock.prototype.store = {
      blockingFailedTestResults: vi.fn().mockResolvedValue([]),
      failedTestResults: vi.fn().mockResolvedValue([]),
      allTestResults: vi.fn().mockResolvedValue([]),
      testResultById: vi.fn(async (id: string) => ({ id })),
    };
    AllureReportMock.prototype.validate = vi
      .fn()
      .mockResolvedValueOnce({ results: [firstResult], fastFailed: true })
      .mockResolvedValue({ results: [laterResult], fastFailed: true });
    vi.mocked(terminationOf).mockReturnValueOnce(testProcessTermination);

    const commandPromise = executeAllureRun({
      allureReport: new AllureReportMock() as never,
      cwd: "/cwd",
      command: "npm",
      commandArgs: ["test"],
      withQualityGate: true,
      maxRerun: 1,
    });
    const onTestResults = await onTestResultsReady;

    await onTestResults(["tr-1"]);
    await onTestResults(["tr-2"]);
    finishTestProcess(1);
    await commandPromise;

    expect(AllureReportMock.prototype.validate).toHaveBeenCalledTimes(1);
    expect(runProcess).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(stopProcessTree).toHaveBeenCalledTimes(1);
    expect(AllureReportMock.prototype.realtimeDispatcher.sendQualityGateResults).toHaveBeenCalledTimes(1);
    expect(AllureReportMock.prototype.realtimeDispatcher.sendQualityGateResults).toHaveBeenCalledWith([firstResult]);
  });

  it("should preserve raw child exit code when only known failures remain", async () => {
    const { runProcess, terminationOf } = await import("../../src/utils/index.js");

    (readConfig as Mock).mockResolvedValueOnce({
      output: "./allure-report",
      open: false,
      plugins: [],
    });
    vi.mocked(runProcess).mockClear();
    vi.mocked(terminationOf).mockResolvedValueOnce(7);

    const { AllureReportMock } = await import("../utils.js");
    const knownFailure = { fullName: "known failure", status: "failed", labels: [], historyId: "known-1" };

    AllureReportMock.prototype.store = {
      blockingFailedTestResults: vi.fn().mockResolvedValue([]),
      failedTestResults: vi.fn().mockResolvedValue([knownFailure]),
      allTestResults: vi.fn().mockResolvedValue([]),
    };

    await run(RunCommand, ["run", "--", "npm", "test"]);

    expect(runProcess).toHaveBeenCalledTimes(1);
    expect(AllureReportMock.prototype.realtimeDispatcher.sendGlobalExitCode).toHaveBeenCalledWith({
      original: 7,
      actual: 0,
    });
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it("should bypass nested allure wrappers and execute the child command directly", async () => {
    const { AllureReportMock } = await import("../utils.js");
    const { runProcess } = await import("../../src/utils/index.js");

    process.env[ALLURE_CLI_ACTIVE_COMMAND_ENV] = "agent";

    await run(RunCommand, ["run", "--silent", "--", "npm", "test"]);

    expect(runProcess).toHaveBeenCalledWith({
      command: "npm",
      commandArgs: ["test"],
      cwd: "/cwd",
      logs: "ignore",
    });
    expect(readConfig).not.toHaveBeenCalled();
    expect(AllureReportMock).not.toHaveBeenCalled();
    expect(exitMock).toHaveBeenCalledWith(0);

    delete process.env[ALLURE_CLI_ACTIVE_COMMAND_ENV];
  });
});
