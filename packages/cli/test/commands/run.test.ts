import * as console from "node:console";
import { resolve } from "node:path";

import { readConfig } from "@allurereport/core";
import AwesomePlugin from "@allurereport/plugin-awesome";
import { epic, feature, label, story } from "allure-js-commons";
import { run, UsageError } from "clipanion";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { executeAllureRun } from "../../src/commands/commons/run.js";
import { RunCommand } from "../../src/commands/run.js";
import { ALLURE_CLI_ACTIVE_COMMAND_ENV } from "../../src/utils/execution-context.js";

const {
  exitMock,
  processStream,
  nameWatcherMock,
  globWatcherMock,
  supervisorConstructorMock,
  supervisorStartMock,
  supervisorStopMock,
  supervisorExitCodeMock,
  supervisorStdoutMock,
  supervisorStderrMock,
} = vi.hoisted(() => {
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
    supervisorConstructorMock: vi.fn(),
    supervisorStartMock: vi.fn(),
    supervisorStopMock: vi.fn().mockResolvedValue(undefined),
    supervisorExitCodeMock: vi.fn(),
    supervisorStdoutMock: vi.fn(),
    supervisorStderrMock: vi.fn(),
  };
});

vi.mock("node:console", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:console")>();
  const methods = {
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return {
    ...actual,
    ...methods,
    default: {
      ...actual.default,
      ...methods,
    },
  };
});
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
    filterFailedQualityGateResults: vi.fn((results: { success: boolean }[]) =>
      results.filter(({ success }) => !success),
    ),
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
  difference: vi.fn((_before: Set<string>, _after: Set<string>) => [new Set(), new Set()]),
  watch: vi.fn(() => ({
    initialScan: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(undefined),
  })),
}));
vi.mock("../../src/utils/index.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/utils/index.js")>()),
  runProcess: vi.fn(() => ({
    pid: 123,
    stdout: processStream,
    stderr: processStream,
  })),
  terminationOf: vi.fn().mockResolvedValue(0),
}));
vi.mock("../../src/utils/supervisor/index.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/utils/supervisor/index.js")>()),
  ProcessSupervisor: class {
    constructor(command: string, options: unknown) {
      supervisorConstructorMock(command, options);
    }

    get exitCode(): Promise<number | null> {
      return supervisorExitCodeMock();
    }

    get stdout(): Promise<string> {
      return supervisorStdoutMock();
    }

    get stderr(): Promise<string> {
      return supervisorStderrMock();
    }

    start = supervisorStartMock;
    stop = supervisorStopMock;
  },
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
  supervisorConstructorMock.mockReset();
  supervisorStartMock.mockReset().mockResolvedValue(undefined);
  supervisorStopMock.mockReset().mockResolvedValue(undefined);
  supervisorExitCodeMock.mockReset().mockResolvedValue(0);
  supervisorStdoutMock.mockReset().mockResolvedValue("");
  supervisorStderrMock.mockReset().mockResolvedValue("");
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
    sendProcessGlobalAttachment: vi.fn(),
    sendGlobalError: vi.fn(),
    sendProcessGlobalError: vi.fn(),
    sendProcessGlobalsReset: vi.fn(),
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
    expect(console.info).not.toHaveBeenCalledWith(expect.stringMatching(/Completed with exit code/u));
  });

  it("should treat a path-like executable as the nested command", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      output: "./allure-report",
      open: false,
      plugins: [],
    });

    const command = new RunCommand();

    command.resultsDir = undefined;
    command.commandToRun = ["./script.sh", "--flag"];

    await command.execute();

    expect(supervisorConstructorMock).toHaveBeenCalledWith(
      "./script.sh",
      expect.objectContaining({
        arguments: ["--flag"],
      }),
    );
  });

  it("should accept --results-dir and still run the nested command", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      output: "./allure-report",
      open: false,
      plugins: [],
      resultsDir: ["./from-config"],
    });

    await run(RunCommand, ["run", "--results-dir", "./custom/**/allure-results", "--", "npm", "test"]);

    expect(readConfig).toHaveBeenCalled();
    expect(supervisorConstructorMock).toHaveBeenCalledWith(
      "npm",
      expect.objectContaining({
        arguments: ["test"],
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

    supervisorExitCodeMock.mockResolvedValueOnce(0);
    (readConfig as Mock).mockResolvedValueOnce({
      output: "./allure-report",
      open: false,
      hideLabels: ["owner"],
      plugins: [],
    });

    const exitCode = await run(RunCommand, ["run", "--hide-labels", "owner", "--", "npm", "test"]);

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
    expect(supervisorConstructorMock).toHaveBeenCalledWith(
      "npm",
      expect.objectContaining({
        environmentVariables: {
          ALLURE_CLI_ACTIVE_COMMAND: "run",
        },
      }),
    );
    expect(exitCode).toEqual(0);
  });

  it("should pass hideLabels override to readConfig and keep normalized value on report config", async () => {
    const { AllureReportMock } = await import("../utils.js");
    const awesomePlugin = new AwesomePlugin({});

    supervisorExitCodeMock.mockResolvedValueOnce(0);
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

    const exitCode = await run(RunCommand, [
      "run",
      "--hide-labels",
      "owner",
      "--hide-labels",
      "tag",
      "--",
      "npm",
      "test",
    ]);

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
    expect(exitCode).toEqual(0);
  });

  it("should keep config dump when run --dump is omitted", async () => {
    const { AllureReportMock } = await import("../utils.js");

    supervisorExitCodeMock.mockResolvedValueOnce(0);
    (readConfig as Mock).mockResolvedValueOnce({
      output: "./allure-report",
      open: false,
      dump: "./snapshots/stage_1",
      plugins: [],
    });

    const exitCode = await run(RunCommand, ["run", "--", "npm", "test"]);

    expect(AllureReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dump: "./snapshots/stage_1",
      }),
    );
    expect(exitCode).toEqual(0);
  });

  it("should prefer run --dump over config dump", async () => {
    const { AllureReportMock } = await import("../utils.js");
    supervisorExitCodeMock.mockResolvedValueOnce(0);

    (readConfig as Mock).mockResolvedValueOnce({
      output: "./allure-report",
      open: false,
      dump: "./snapshots/from-config",
      plugins: [],
    });

    const exitCode = await run(RunCommand, ["run", "--dump", "./snapshots/from-cli", "--", "npm", "test"]);

    expect(AllureReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dump: "./snapshots/from-cli",
      }),
    );
    expect(exitCode).toEqual(0);
  });

  it("should evaluate a configured quality gate when writing a dump", async () => {
    const { AllureReportMock } = await import("../utils.js");
    const qualityGate = {
      rules: [
        {
          maxFailures: 0,
        },
      ],
    };
    supervisorExitCodeMock.mockResolvedValueOnce(0);

    (readConfig as Mock).mockResolvedValueOnce({
      output: "./allure-report",
      open: false,
      dump: "./snapshots/with-quality-gate",
      qualityGate,
      plugins: [],
    });
    AllureReportMock.prototype.validate.mockResolvedValueOnce({
      results: [
        {
          success: true,
          expected: 0,
          actual: 0,
          rule: "maxFailures",
          message: "No failed tests",
          testResults: [],
        },
      ],
    });

    await run(RunCommand, ["run", "--", "npm", "test"]);

    expect(AllureReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dump: "./snapshots/with-quality-gate",
        qualityGate,
      }),
    );
    expect(AllureReportMock.prototype.validate).toHaveBeenCalled();
    expect(AllureReportMock.prototype.realtimeDispatcher.sendQualityGateResults).toHaveBeenCalled();
    expect(AllureReportMock.prototype.done).toHaveBeenCalled();
  });

  it("should keep configured quality gate when rerun is enabled", async () => {
    const { AllureReportMock } = await import("../utils.js");
    const qualityGate = {
      rules: [],
    };

    (readConfig as Mock).mockResolvedValueOnce({
      output: "./allure-report",
      open: false,
      qualityGate,
      plugins: [],
    });

    const exitCode = await run(RunCommand, ["run", "--rerun", "2", "--", "npm", "test"]);

    expect(console.warn).not.toHaveBeenCalled();
    expect(AllureReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        qualityGate,
      }),
    );
    expect(AllureReportMock.prototype.realtimeSubscriber.onTestResults).toHaveBeenCalled();
    expect(AllureReportMock.prototype.validate).toHaveBeenCalled();
    expect(supervisorConstructorMock).toHaveBeenCalledWith(
      "npm",
      expect.objectContaining({
        arguments: ["test"],
      }),
    );

    expect(console.info).toHaveBeenCalledWith(expect.stringMatching(/\[AllureRun\]:.*Completed with exit code 0/u));
    expect(console.info).toHaveBeenCalledWith(
      expect.stringMatching(
        /\[AllureRerun\]:.*No blocking failures or failed Quality Gate-related tests remain; no further reruns are needed/u,
      ),
    );
    expect(supervisorStartMock).toHaveBeenCalledOnce();
    expect(exitCode).toEqual(0);
  });

  it("should reset process globals before a rerun", async () => {
    const { AllureReportMock } = await import("../utils.js");
    const failed = {
      id: "failed-result",
      name: "failed test",
      fullName: "suite > failed test",
      status: "failed",
      labels: [],
    };

    AllureReportMock.prototype.store = {
      blockingFailedTestResults: vi
        .fn()
        .mockResolvedValue([])
        .mockResolvedValueOnce([failed])
        .mockResolvedValueOnce([failed]),
      failedTestResults: vi.fn().mockResolvedValue([]).mockResolvedValueOnce([failed]),
      allTestResults: vi.fn().mockResolvedValue([]),
    };
    supervisorStdoutMock.mockReturnValueOnce("first stdout");
    supervisorStdoutMock.mockReturnValueOnce("second stdout");
    supervisorStderrMock.mockReturnValueOnce("first stderr");
    supervisorStderrMock.mockReturnValueOnce("");
    supervisorExitCodeMock.mockReturnValueOnce(1);
    supervisorExitCodeMock.mockReturnValueOnce(0);

    await executeAllureRun({
      allureReport: new AllureReportMock() as never,
      cwd: "/cwd",
      command: "npm",
      commandArgs: ["test"],
      logs: "pipe",
      silent: true,
      withQualityGate: false,
      maxRerun: 1,
    });

    expect(supervisorConstructorMock).toHaveBeenCalledTimes(2);
    expect(AllureReportMock.prototype.realtimeDispatcher.sendProcessGlobalAttachment).toHaveBeenCalledTimes(3);
    expect(AllureReportMock.prototype.realtimeDispatcher.sendProcessGlobalError).toHaveBeenCalledTimes(1);
    expect(AllureReportMock.prototype.realtimeDispatcher.sendProcessGlobalsReset).toHaveBeenCalledTimes(1);

    const firstErrorOrder =
      AllureReportMock.prototype.realtimeDispatcher.sendProcessGlobalError.mock.invocationCallOrder[0];
    const resetOrder =
      AllureReportMock.prototype.realtimeDispatcher.sendProcessGlobalsReset.mock.invocationCallOrder[0];
    const finalAttachmentOrder =
      AllureReportMock.prototype.realtimeDispatcher.sendProcessGlobalAttachment.mock.invocationCallOrder[2];

    expect(firstErrorOrder).toBeLessThan(resetOrder);
    expect(resetOrder).toBeLessThan(finalAttachmentOrder);
  });

  it("should remove the temporary test plan when a rerun process fails unexpectedly", async () => {
    const { AllureReportMock } = await import("../utils.js");
    const { rm } = await import("node:fs/promises");
    const failed = {
      id: "failed-result",
      name: "failed test",
      fullName: "suite > failed test",
      status: "failed",
      labels: [],
    };

    AllureReportMock.prototype.store = {
      blockingFailedTestResults: vi.fn().mockResolvedValue([failed]),
      failedTestResults: vi.fn().mockResolvedValue([failed]),
      allTestResults: vi.fn().mockResolvedValue([]),
    };

    await executeAllureRun({
      allureReport: new AllureReportMock() as never,
      cwd: "/cwd",
      command: "npm",
      commandArgs: ["test"],
      withQualityGate: false,
      maxRerun: 1,
    });

    expect(rm).toHaveBeenCalledWith("/tmp/run", { recursive: true, force: true });
  });

  it("should publish captured process logs as process globals", async () => {
    const { AllureReportMock } = await import("../utils.js");

    processStream.on
      .mockImplementationOnce((_event, listener) => {
        listener("stdout");
        return processStream;
      })
      .mockImplementationOnce((_event, listener) => {
        listener("stderr");
        return processStream;
      });
    supervisorExitCodeMock.mockResolvedValueOnce(1);
    supervisorStdoutMock.mockResolvedValue("stdout");
    supervisorStderrMock.mockResolvedValue("stderr");

    await executeAllureRun({
      allureReport: new AllureReportMock() as never,
      cwd: "/cwd",
      command: "npm",
      commandArgs: ["test"],
      logs: "pipe",
      silent: true,
      withQualityGate: false,
    });

    expect(AllureReportMock.prototype.realtimeDispatcher.sendProcessGlobalAttachment).toHaveBeenCalledTimes(2);
    expect(AllureReportMock.prototype.realtimeDispatcher.sendProcessGlobalAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        buffer: Buffer.from("stderr", "utf-8"),
        contentType: "text/plain",
      }),
      expect.stringMatching(/\.stderr\.txt$/),
    );
    expect(AllureReportMock.prototype.realtimeDispatcher.sendProcessGlobalAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        buffer: Buffer.from("stdout", "utf-8"),
        contentType: "text/plain",
      }),
      expect.stringMatching(/\.stdout\.txt$/),
    );
    expect(AllureReportMock.prototype.realtimeDispatcher.sendProcessGlobalError).toHaveBeenCalledOnce();
    expect(AllureReportMock.prototype.realtimeDispatcher.sendProcessGlobalError).toHaveBeenCalledWith({
      message: "Test process has failed",
      trace: "stderr",
    });
    expect(AllureReportMock.prototype.realtimeDispatcher.sendGlobalAttachment).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith(expect.stringMatching(/\[AllureRun\]:.*Running: npm test/u));
    expect(console.info).not.toHaveBeenCalledWith(expect.stringMatching(/\bAttempt \d/u));
  });

  it("should pass known issues override to readConfig", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      output: "./allure-report",
      open: false,
      plugins: [],
    });

    await run(RunCommand, [
      "run",
      "--known-issues",
      "known.json",
      "--history-base-url",
      "https://bucket.example/runs/42",
      "--",
      "npm",
      "test",
    ]);

    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      output: undefined,
      name: undefined,
      open: undefined,
      port: undefined,
      hideLabels: undefined,
      historyLimit: undefined,
      historyBaseUrl: "https://bucket.example/runs/42",
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

    const exitCode = await run(RunCommand, ["run", "--rerun", "0", "--", "npm", "test"]);

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
    expect(exitCode).toEqual(0);
  });

  it("should rerun blocking failures and tests related to failed Quality Gate rules after a completed run", async () => {
    const { AllureReportMock } = await import("../utils.js");
    const { writeFile } = await import("node:fs/promises");
    const blockingFailure = {
      id: "blocking-failure",
      name: "failed test",
      fullName: "suite > failed test",
      status: "failed",
      labels: [],
    };
    const relatedPassedTest = {
      id: "related-passed",
      name: "slow passed test",
      fullName: "suite > slow passed test",
      status: "passed",
      labels: [],
    };
    const failedQualityGateResult = {
      success: false,
      expected: 100,
      actual: 200,
      rule: "maxDuration",
      message: "Some tests are too slow",
      testResults: [blockingFailure.id, relatedPassedTest.id],
    };
    const testPlanPath = resolve("/tmp/run", "0-testplan.json");

    AllureReportMock.prototype.store = {
      blockingFailedTestResults: vi.fn().mockResolvedValue([blockingFailure]),
      failedTestResults: vi.fn().mockResolvedValue([blockingFailure]),
      allTestResults: vi.fn().mockResolvedValue([blockingFailure, relatedPassedTest]),
      testResultById: vi.fn(async (id: string) => {
        if (id === blockingFailure.id) {
          return blockingFailure;
        }

        return id === relatedPassedTest.id ? relatedPassedTest : undefined;
      }),
    };
    AllureReportMock.prototype.validate = vi.fn().mockResolvedValue({
      results: [failedQualityGateResult],
      fastFailed: false,
    });

    await executeAllureRun({
      allureReport: new AllureReportMock() as never,
      cwd: "/cwd",
      command: "npm",
      commandArgs: ["test"],
      withQualityGate: true,
      maxRerun: 1,
    });

    expect(supervisorConstructorMock).toHaveBeenCalledTimes(2);
    expect(supervisorConstructorMock).toHaveBeenNthCalledWith(
      2,
      "npm",
      expect.objectContaining({
        environmentVariables: {
          ALLURE_RERUN: "0",
          ALLURE_TESTPLAN_PATH: testPlanPath,
        },
      }),
    );

    expect(writeFile).toHaveBeenCalledWith(
      testPlanPath,
      JSON.stringify({
        version: "1.0",
        tests: [
          { selector: blockingFailure.fullName, id: undefined },
          { selector: relatedPassedTest.fullName, id: undefined },
        ],
      }),
    );
    expect(AllureReportMock.prototype.store.testResultById).toHaveBeenCalledTimes(2);
  });

  it("should restart the full process after Quality Gate fast-fail even when related tests exist", async () => {
    const { AllureReportMock } = await import("../utils.js");
    const { mkdtemp, writeFile } = await import("node:fs/promises");
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
      testResults: ["tr-1", "tr-1"],
    };
    const passedResult = {
      ...firstResult,
      success: true,
      rule: "maxDuration",
      testResults: ["tr-passed"],
    };
    const recoveredResult = {
      ...firstResult,
      success: true,
      actual: 0,
      testResults: [],
    };
    const relatedTestResult = {
      id: "tr-1",
      name: "failed test",
      fullName: "suite > failed test",
      status: "failed",
      labels: [],
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
      testResultById: vi.fn(async (id: string) => (id === relatedTestResult.id ? relatedTestResult : undefined)),
    };
    AllureReportMock.prototype.validate = vi
      .fn()
      .mockResolvedValueOnce({ results: [passedResult, firstResult], fastFailed: true })
      .mockResolvedValueOnce({ results: [recoveredResult], fastFailed: false });
    vi.mocked(supervisorExitCodeMock).mockReturnValueOnce(testProcessTermination).mockResolvedValueOnce(0);

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
    finishTestProcess(1);
    await commandPromise;

    expect(AllureReportMock.prototype.validate).toHaveBeenCalledTimes(2);
    expect(supervisorConstructorMock).toHaveBeenCalledTimes(2);
    expect(supervisorConstructorMock).toHaveBeenNthCalledWith(
      2,
      "npm",
      expect.objectContaining({
        environmentVariables: {
          ALLURE_RERUN: "0",
        },
      }),
    );
    expect(mkdtemp).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(AllureReportMock.prototype.store.testResultById).not.toHaveBeenCalledWith("tr-passed");
    expect(console.info).toHaveBeenCalledWith(
      expect.stringMatching(/\[QualityGate\]:.*Fast-fail triggered: maxFailures; stopping attempt 1\/2/u),
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /\[AllureRerun\]:.*Attempt 2\/2: Quality Gate fast-fail interrupted the previous attempt; restarting full test process/u,
      ),
    );
    expect(unsubscribe).toHaveBeenCalledTimes(2);
    expect(supervisorStopMock).toHaveBeenCalledTimes(1);
    expect(AllureReportMock.prototype.realtimeDispatcher.sendQualityGateResults).toHaveBeenCalledTimes(1);
    expect(AllureReportMock.prototype.realtimeDispatcher.sendQualityGateResults).toHaveBeenCalledWith([
      recoveredResult,
    ]);
  });

  it("should restart the full test process when a fast-failing Quality Gate has no related tests", async () => {
    const { AllureReportMock } = await import("../utils.js");
    const { mkdtemp, writeFile } = await import("node:fs/promises");
    let resolveOnTestResults!: (callback: (ids: string[]) => Promise<void>) => void;
    const onTestResultsReady = new Promise<(ids: string[]) => Promise<void>>((resolve) => {
      resolveOnTestResults = resolve;
    });
    let finishTestProcess!: (code: number | null) => void;
    const testProcessTermination = new Promise<number | null>((resolve) => {
      finishTestProcess = resolve;
    });
    const fastFailResult = {
      success: false,
      expected: 10,
      actual: 1,
      rule: "minTestsCount",
      message: "Not enough tests",
      testResults: [],
    };

    AllureReportMock.prototype.realtimeSubscriber = {
      onTestResults: vi.fn((callback: (ids: string[]) => Promise<void>) => {
        resolveOnTestResults(callback);
        return vi.fn();
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
      .mockResolvedValueOnce({ results: [fastFailResult], fastFailed: true })
      .mockResolvedValueOnce({ results: [fastFailResult], fastFailed: false });
    vi.mocked(supervisorExitCodeMock).mockReturnValueOnce(testProcessTermination).mockResolvedValueOnce(0);

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
    finishTestProcess(1);
    await commandPromise;

    expect(supervisorConstructorMock).toHaveBeenCalledTimes(2);
    expect(supervisorConstructorMock).toHaveBeenNthCalledWith(
      2,
      "npm",
      expect.objectContaining({
        environmentVariables: {
          ALLURE_RERUN: "0",
        },
      }),
    );
    expect(mkdtemp).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith(
      expect.stringMatching(/\[QualityGate\]:.*Fast-fail triggered: minTestsCount; stopping attempt 1\/2/u),
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /\[AllureRerun\]:.*Attempt 2\/2: Quality Gate fast-fail interrupted the previous attempt; restarting full test process/u,
      ),
    );
  });

  it("should use the shared rerun budget for repeated full Quality Gate restarts", async () => {
    const { AllureReportMock } = await import("../utils.js");
    type TestResultsCallback = (ids: string[]) => Promise<void>;
    type ProcessFinisher = (code: number | null) => void;
    const callbacks: TestResultsCallback[] = [];
    const callbackWaiters: ((callback: TestResultsCallback) => void)[] = [];
    const processFinishers: ProcessFinisher[] = [];
    const processFinisherWaiters: ((finisher: ProcessFinisher) => void)[] = [];
    const nextCallback = () =>
      new Promise<TestResultsCallback>((resolve) => {
        const callback = callbacks.shift();

        if (callback) {
          resolve(callback);
        } else {
          callbackWaiters.push(resolve);
        }
      });
    const nextProcessFinisher = () =>
      new Promise<ProcessFinisher>((resolve) => {
        const finisher = processFinishers.shift();

        if (finisher) {
          resolve(finisher);
        } else {
          processFinisherWaiters.push(resolve);
        }
      });
    const fastFailResult = {
      success: false,
      expected: 10,
      actual: 1,
      rule: "minTestsCount",
      message: "Not enough tests",
      testResults: [],
    };

    AllureReportMock.prototype.realtimeSubscriber = {
      onTestResults: vi.fn((callback: TestResultsCallback) => {
        const waiter = callbackWaiters.shift();

        if (waiter) {
          waiter(callback);
        } else {
          callbacks.push(callback);
        }

        return vi.fn();
      }),
    };
    AllureReportMock.prototype.store = {
      blockingFailedTestResults: vi.fn().mockResolvedValue([]),
      failedTestResults: vi.fn().mockResolvedValue([]),
      allTestResults: vi.fn().mockResolvedValue([]),
      testResultById: vi.fn(async (id: string) => ({ id })),
    };
    AllureReportMock.prototype.validate = vi.fn().mockResolvedValue({
      results: [fastFailResult],
      fastFailed: true,
    });
    vi.mocked(supervisorExitCodeMock).mockImplementation(
      () =>
        new Promise<number | null>((resolve) => {
          const waiter = processFinisherWaiters.shift();

          if (waiter) {
            waiter(resolve);
          } else {
            processFinishers.push(resolve);
          }
        }),
    );

    const commandPromise = executeAllureRun({
      allureReport: new AllureReportMock() as never,
      cwd: "/cwd",
      command: "npm",
      commandArgs: ["test"],
      withQualityGate: true,
      maxRerun: 2,
    });

    for (let attempt = 0; attempt < 3; attempt++) {
      const [onTestResults, finishTestProcess] = await Promise.all([nextCallback(), nextProcessFinisher()]);

      await onTestResults([`tr-${attempt}`]);
      finishTestProcess(1);
    }

    await commandPromise;

    expect(supervisorConstructorMock).toHaveBeenCalledTimes(3);
    expect(supervisorConstructorMock).toHaveBeenNthCalledWith(
      2,
      "npm",
      expect.objectContaining({
        environmentVariables: {
          ALLURE_RERUN: "0",
        },
      }),
    );
    expect(supervisorConstructorMock).toHaveBeenNthCalledWith(
      3,
      "npm",
      expect.objectContaining({
        environmentVariables: {
          ALLURE_RERUN: "1",
        },
      }),
    );
    expect(AllureReportMock.prototype.validate).toHaveBeenCalledTimes(3);
  });

  it("should not restart after Quality Gate fast-fail when the rerun budget is zero", async () => {
    const { AllureReportMock } = await import("../utils.js");
    let resolveOnTestResults!: (callback: (ids: string[]) => Promise<void>) => void;
    const onTestResultsReady = new Promise<(ids: string[]) => Promise<void>>((resolve) => {
      resolveOnTestResults = resolve;
    });
    let finishTestProcess!: (code: number | null) => void;
    const testProcessTermination = new Promise<number | null>((resolve) => {
      finishTestProcess = resolve;
    });
    const fastFailResult = {
      success: false,
      expected: 0,
      actual: 1,
      rule: "maxFailures",
      message: "Too many failures",
      testResults: ["tr-1"],
    };

    AllureReportMock.prototype.realtimeSubscriber = {
      onTestResults: vi.fn((callback: (ids: string[]) => Promise<void>) => {
        resolveOnTestResults(callback);
        return vi.fn();
      }),
    };
    AllureReportMock.prototype.store = {
      blockingFailedTestResults: vi.fn().mockResolvedValue([]),
      failedTestResults: vi.fn().mockResolvedValue([]),
      allTestResults: vi.fn().mockResolvedValue([]),
      testResultById: vi.fn(async (id: string) => ({ id })),
    };
    AllureReportMock.prototype.validate = vi.fn().mockResolvedValue({
      results: [fastFailResult],
      fastFailed: true,
    });
    vi.mocked(supervisorExitCodeMock).mockReturnValueOnce(testProcessTermination);

    const commandPromise = executeAllureRun({
      allureReport: new AllureReportMock() as never,
      cwd: "/cwd",
      command: "npm",
      commandArgs: ["test"],
      withQualityGate: true,
      maxRerun: 0,
    });
    const onTestResults = await onTestResultsReady;

    await onTestResults(["tr-1"]);
    finishTestProcess(1);
    await commandPromise;

    expect(supervisorConstructorMock).toHaveBeenCalledTimes(1);
    expect(AllureReportMock.prototype.realtimeDispatcher.sendQualityGateResults).toHaveBeenCalledWith([fastFailResult]);
    expect(console.info).toHaveBeenCalledWith(expect.stringMatching(/\[AllureRun\]:.*Running: npm test/u));
    expect(console.info).toHaveBeenCalledWith(
      expect.stringMatching(/\[QualityGate\]:.*Fast-fail triggered: maxFailures; stopping test process/u),
    );
    expect(console.info).not.toHaveBeenCalledWith(expect.stringMatching(/\bAttempt \d/u));
  });

  it("should preserve raw child exit code when only muted failures remain", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      output: "./allure-report",
      open: false,
      plugins: [],
    });
    supervisorExitCodeMock.mockResolvedValueOnce(7);

    const { AllureReportMock } = await import("../utils.js");
    const mutedFailure = {
      fullName: "muted failure",
      status: "failed",
      resolution: "muted",
      labels: [],
      retryHash: "muted-1",
    };

    AllureReportMock.prototype.store = {
      blockingFailedTestResults: vi.fn().mockResolvedValue([]),
      failedTestResults: vi.fn().mockResolvedValue([mutedFailure]),
      allTestResults: vi.fn().mockResolvedValue([]),
    };

    const exitCode = await run(RunCommand, ["run", "--", "npm", "test"]);

    expect(supervisorConstructorMock).toHaveBeenCalledTimes(1);
    expect(AllureReportMock.prototype.realtimeDispatcher.sendGlobalExitCode).toHaveBeenCalledWith({
      original: 7,
      actual: 0,
    });
    expect(exitCode).toEqual(0);
  });

  it("should bypass nested allure wrappers and execute the child command directly", async () => {
    const { AllureReportMock } = await import("../utils.js");
    const { runProcess } = await import("../../src/utils/index.js");

    process.env[ALLURE_CLI_ACTIVE_COMMAND_ENV] = "agent";

    const exitCode = await run(RunCommand, ["run", "--silent", "--", "npm", "test"]);

    expect(runProcess).toHaveBeenCalledWith({
      command: "npm",
      commandArgs: ["test"],
      cwd: "/cwd",
      logs: "ignore",
    });
    expect(readConfig).not.toHaveBeenCalled();
    expect(AllureReportMock).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalledWith(expect.stringMatching(/Completed with exit code/u));
    expect(exitCode).toEqual(0);

    delete process.env[ALLURE_CLI_ACTIVE_COMMAND_ENV];
  });
});
