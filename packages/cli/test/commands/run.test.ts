import * as console from "node:console";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { readConfig } from "@allurereport/core";
import { ExpressionError } from "@allurereport/core-api";
import AwesomePlugin from "@allurereport/plugin-awesome";
import { KnownError } from "@allurereport/service";
import { serve } from "@allurereport/static-server";
import { allureId, epic, feature, label, story } from "allure-js-commons";
import { Cli, run, UsageError } from "clipanion";
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { executeAllureRun, runTests } from "../../src/commands/commons/run.js";
import { RunCommand } from "../../src/commands/run.js";
import { ALLURE_CLI_ACTIVE_COMMAND_ENV } from "../../src/utils/execution-context.js";
import { applyVerbosity } from "../../src/utils/verbosity.js";

const {
  exitMock,
  processStream,
  nameWatcherMock,
  globWatcherMock,
  supervisorConstructorMock,
  supervisorStartMock,
  supervisorStopMock,
  supervisorExitCodeMock,
  supervisorInterruptedMock,
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
    supervisorInterruptedMock: vi.fn(),
    supervisorStdoutMock: vi.fn(),
    supervisorStderrMock: vi.fn(),
  };
});

vi.mock("node:console", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:console") & { default: typeof import("node:console") }>();
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
const { mutedGetMock, testOpsConstructorMock } = vi.hoisted(() => ({
  mutedGetMock: vi.fn(),
  testOpsConstructorMock: vi.fn(),
}));
vi.mock("@allurereport/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@allurereport/service")>();
  return {
    ...actual,
    AllureTestOpsClient: class extends actual.AllureTestOpsClient {
      constructor(config: ConstructorParameters<typeof actual.AllureTestOpsClient>[0]) {
        super(config);
        testOpsConstructorMock(config);
      }
      getMutedTests = mutedGetMock;
    },
  };
});
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

    get interrupted(): "stopped" | "terminated" | undefined {
      return supervisorInterruptedMock();
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
  supervisorInterruptedMock.mockReset().mockReturnValue(undefined);
  supervisorStdoutMock.mockReset().mockResolvedValue("");
  supervisorStderrMock.mockReset().mockResolvedValue("");
  delete process.env[ALLURE_CLI_ACTIVE_COMMAND_ENV];

  const { AllureReportMock } = await import("../utils.js");
  const { terminationOf } = await import("../../src/utils/index.js");

  AllureReportMock.prototype.readResult.mockReset().mockResolvedValue(undefined);
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
  it.each(["live ingestion", "final flush"])(
    "fails and cleans up after an environment error during %s",
    async (phase) => {
      const { AllureReportMock } = await import("../utils.js");
      const { delayedFileProcessingWatcher } = await import("@allurereport/directory-watcher");
      const error = new ExpressionError('Invalid expression at environments["firefox"].matcher');
      AllureReportMock.prototype.readResult.mockRejectedValueOnce(error);
      let processFile!: (path: string) => Promise<void>;
      const abort = vi.fn(async () => {
        if (phase === "final flush") await processFile("test-result.json");
      });
      vi.mocked(delayedFileProcessingWatcher).mockImplementationOnce((callback) => {
        processFile = callback;
        return {
          addFile: vi.fn().mockResolvedValue(undefined),
          initialScan: vi.fn().mockResolvedValue(undefined),
          watchEnd: vi.fn().mockResolvedValue(undefined),
          abort,
        };
      });
      if (phase === "live ingestion") {
        supervisorExitCodeMock.mockReturnValueOnce(new Promise<number>(() => {}));
        supervisorStartMock.mockImplementationOnce(async () => {
          await processFile("test-result.json");
        });
      }
      const report = new AllureReportMock() as unknown as import("@allurereport/core").AllureReport;

      const result = await runTests({
        allureReport: report,
        cwd: "/cwd",
        command: "test",
        commandArgs: [],
        environmentVariables: {},
        withQualityGate: false,
      }).catch((cause) => cause);

      expect(result).toBe(error);
      expect(abort).toHaveBeenCalledOnce();
      expect(AllureReportMock.prototype.readResult).toHaveBeenCalledOnce();
      expect(supervisorStopMock).toHaveBeenCalledTimes(phase === "live ingestion" ? 1 : 0);
      if (phase === "live ingestion") {
        expect(supervisorStopMock).toHaveBeenCalledWith({ escalate: true });
      }
    },
  );
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

    supervisorExitCodeMock
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error("rerun process failed unexpectedly"));

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

  it.each([
    {
      name: "known internal run failures",
      error: new KnownError("Configured results directory is invalid"),
    },
    {
      name: "unexpected internal run failures",
      error: new Error("orchestration crashed"),
    },
  ])("should record $name as global errors", async ({ error }) => {
    await allureId("304052");
    await story("global-errors");
    await label("coverage", "global-errors");

    const { AllureReportMock } = await import("../utils.js");
    const dispatcher = AllureReportMock.prototype.realtimeDispatcher;

    supervisorStartMock.mockRejectedValueOnce(error);

    const failureResult = await executeAllureRun({
      allureReport: new AllureReportMock() as never,
      cwd: "/cwd",
      command: "npm",
      commandArgs: ["test"],
      withQualityGate: false,
    });

    expect(failureResult.globalExitCode.actual).toBe(1);
    expect(dispatcher.sendGlobalError).toHaveBeenCalledTimes(1);
    expect(dispatcher.sendGlobalError).toHaveBeenCalledWith(
      error instanceof KnownError ? { message: error.message } : { message: error.message, trace: error.stack },
    );
    expect(dispatcher.sendGlobalExitCode).toHaveBeenCalledWith(expect.objectContaining({ actual: 1 }));
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
        mutedTests: [],
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

  it.each(
    ["stopped", "terminated"].flatMap((interrupted) =>
      [20, 0, null].flatMap((code) =>
        [
          { withQualityGate: true, muted: false },
          { withQualityGate: false, muted: true },
          { withQualityGate: true, muted: true },
        ].map((scenario) => ({ interrupted, code, ...scenario })),
      ),
    ),
  )(
    "should prioritize interruption over quality gate ($interrupted, code=$code, qualityGate=$withQualityGate, muted=$muted)",
    async ({ interrupted, code, withQualityGate, muted }) => {
      const { AllureReportMock } = await import("../utils.js");
      const passingRule = {
        success: true,
        expected: 0,
        actual: 0,
        rule: "maxFailures",
        message: "No blocking failures",
        testResults: [],
      };

      (readConfig as Mock).mockResolvedValueOnce({
        output: "./allure-report",
        open: false,
        plugins: [],
        ...(withQualityGate ? { qualityGate: { rules: [{ maxFailures: 0 }] } } : {}),
      });
      supervisorExitCodeMock.mockResolvedValueOnce(code);
      supervisorInterruptedMock.mockReturnValue(interrupted);
      AllureReportMock.prototype.validate.mockResolvedValue({ results: [passingRule] });
      if (muted) {
        AllureReportMock.prototype.store.failedTestResults.mockResolvedValue([
          { fullName: "muted failure", status: "failed", resolution: "muted" },
        ]);
      }

      const exitCode = await run(RunCommand, ["run", "--", "npm", "test"]);
      const expectedCode = code === 20 ? 20 : 1;

      expect(exitCode).toBe(expectedCode);
      expect(AllureReportMock.prototype.realtimeDispatcher.sendGlobalExitCode).toHaveBeenCalledWith({
        original: code ?? -1,
        actual: expectedCode,
      });
      expect(AllureReportMock.prototype.realtimeDispatcher.sendGlobalError).toHaveBeenCalledWith({
        environment: undefined,
        message: expect.stringContaining(interrupted === "stopped" ? "interrupted" : "forcibly terminated"),
      });
      if (withQualityGate) {
        expect(AllureReportMock.prototype.realtimeDispatcher.sendQualityGateResults).toHaveBeenCalledWith([
          passingRule,
        ]);
      }
      expect(AllureReportMock.prototype.done).toHaveBeenCalled();
    },
  );

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

  describe("verbosity flags", () => {
    afterEach(() => applyVerbosity("normal"));

    const createCommand = (ignoreLogs = false, silent = false) => {
      const command = new RunCommand();

      // options of a command that was not parsed by clipanion are descriptors, not values
      command.ignoreLogs = ignoreLogs;
      command.silent = silent;
      command.quiet = false;

      return command;
    };

    it("should treat --quiet as --silent for the nested test process", () => {
      applyVerbosity("quiet");

      const command = createCommand();

      expect(command.silentOutput).toBe(true);
      expect(command.logs).toBe("pipe");
    });

    it("should keep ignoring logs under --quiet when --ignore-logs is set", () => {
      applyVerbosity("quiet");

      const command = createCommand(true);

      expect(command.silentOutput).toBe(true);
      expect(command.logs).toBe("ignore");
    });

    it("should treat a parsed --quiet option like --silent even without the global flag", () => {
      const command = new RunCommand();

      command.quiet = true;

      expect(command.silentOutput).toBe(true);
    });

    it("should not change process output under --verbose", () => {
      applyVerbosity("verbose");

      const command = createCommand();

      expect(command.silentOutput).toBe(false);
      expect(command.logs).toBe("pipe");
    });

    it("should still honor an explicit --silent under --verbose", () => {
      applyVerbosity("verbose");

      expect(createCommand(false, true).silentOutput).toBe(true);
    });
  });
});

describe("with skipping muted tests", () => {
  const accessToken = `ato1.${Buffer.from(JSON.stringify({ accessToken: "api-token", url: "https://testops.example.com", projectId: 42 })).toString("base64url")}.signature`;
  const ownedDir = resolve("/tmp/run-muted");
  const planPath = resolve(ownedDir, "testplan.json");
  const execute = (options: string[] = []) =>
    Cli.from([RunCommand])
      .process(["run", ...options, "--", "npm", "test"])
      .execute();
  const childEnvironment = (attempt = 0) => supervisorConstructorMock.mock.calls[attempt]?.[1].environmentVariables;

  beforeEach(async () => {
    for (const key of [
      "ALLURE_ENDPOINT",
      "ALLURE_TOKEN",
      "ALLURE_PROJECT_ID",
      "ALLURE_CI_ENV",
      "ALLURE_TESTPLAN_PATH",
    ]) {
      vi.stubEnv(key, undefined);
    }
    vi.stubEnv("ALLURE_TOKEN", accessToken);
    vi.mocked(readConfig)
      .mockReset()
      .mockResolvedValue({
        output: "./allure-report",
        open: false,
        plugins: [{ id: "testops", enabled: true, options: { skipMutedTests: true } }],
      } as never);
    vi.mocked(mkdtemp).mockReset().mockResolvedValue(ownedDir);
    vi.mocked(writeFile).mockReset().mockResolvedValue(undefined);
    vi.mocked(rm).mockReset().mockResolvedValue(undefined);
    vi.mocked(serve).mockReset();
    mutedGetMock.mockReset().mockResolvedValue([{ id: "123", selector: "suite.spec.ts#test" }]);
    const { AllureReportMock } = await import("../utils.js");
    AllureReportMock.prototype.done.mockReset().mockResolvedValue(undefined);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.mocked(mkdtemp).mockReset().mockResolvedValue("/tmp/run");
    vi.mocked(writeFile).mockReset().mockResolvedValue(undefined);
    vi.mocked(rm).mockReset().mockResolvedValue(undefined);
    const { AllureReportMock } = await import("../utils.js");
    AllureReportMock.prototype.done.mockReset().mockResolvedValue(undefined);
  });

  it("does not prepare a muted plan with skipMutedTests=false", async () => {
    vi.mocked(readConfig).mockResolvedValueOnce({
      output: "./allure-report",
      plugins: [{ id: "testops", enabled: true, options: { skipMutedTests: false } }],
    } as never);

    await execute();

    expect(testOpsConstructorMock).not.toHaveBeenCalled();
    expect(mkdtemp).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(childEnvironment()).toEqual({ ALLURE_CLI_ACTIVE_COMMAND: "run" });
  });

  it("preserves explicitly set host testplan before client setup", async () => {
    const path = "/caller/testplan.json";

    vi.stubEnv("ALLURE_TESTPLAN_PATH", path);
    vi.stubEnv(
      "ALLURE_CI_ENV",
      Buffer.from(
        JSON.stringify({
          ALLURE_TOKEN: "changed-token",
          ALLURE_TESTPLAN_PATH: "/ci/testplan.json",
        }),
      ).toString("base64"),
    );

    await execute();

    expect(testOpsConstructorMock).not.toHaveBeenCalled();
    expect(mkdtemp).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(process.env.ALLURE_TOKEN).toBe(accessToken);
    expect(process.env.ALLURE_TESTPLAN_PATH).toBe(path);
    expect(childEnvironment()).toEqual({ ALLURE_CLI_ACTIVE_COMMAND: "run" });
  });

  it("preserves a CI-decoded testplan", async () => {
    vi.stubEnv(
      "ALLURE_CI_ENV",
      Buffer.from(
        JSON.stringify({
          ALLURE_TESTPLAN_PATH: "/ci/testplan.json",
          ALLURE_TOKEN: accessToken,
        }),
      ).toString("base64"),
    );

    await execute();

    expect(mutedGetMock).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(process.env.ALLURE_TESTPLAN_PATH).toBe("/ci/testplan.json");
    expect(childEnvironment()).toEqual({ ALLURE_CLI_ACTIVE_COMMAND: "run" });
  });

  it("warns and skips when no TestOps token is configured", async () => {
    vi.stubEnv("ALLURE_TOKEN", undefined);

    const exitCode = await execute();

    expect(exitCode).toBe(0);
    expect(mutedGetMock).not.toHaveBeenCalled();
    expect(mkdtemp).not.toHaveBeenCalled();
    expect(childEnvironment()).toEqual({ ALLURE_CLI_ACTIVE_COMMAND: "run" });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "TestOps skipMutedTests requires a functional Allure TestOps instance: set the TestOps plugin accessToken or ALLURE_TOKEN. Continuing without a muted test plan.",
      ),
    );
  });

  it.each(["testops", "plugin-testops"])("prefers %s plugin configuration over environment values", async (id) => {
    vi.mocked(readConfig).mockResolvedValueOnce({
      output: "./allure-report",
      plugins: [
        {
          id,
          enabled: true,
          options: {
            skipMutedTests: true,
            accessToken: "plugin-token",
            endpoint: "https://plugin.example.com",
            projectId: 123,
          },
        },
      ],
    } as never);
    vi.stubEnv("ALLURE_TOKEN", "environment-token");
    vi.stubEnv("ALLURE_ENDPOINT", "https://environment.example.com");
    vi.stubEnv("ALLURE_PROJECT_ID", "456");

    await execute();

    expect(testOpsConstructorMock).toHaveBeenCalledWith({
      accessToken: "plugin-token",
      url: "https://plugin.example.com",
      projectId: 123,
    });
    expect(childEnvironment().ALLURE_TESTPLAN_PATH).toBe(planPath);
  });

  it.each([
    {
      options: { accessToken: "plugin-token" },
      expectedToken: "plugin-token",
      expectedUrl: "https://environment.example.com",
      expectedProjectId: "456",
    },
    {
      options: { endpoint: "https://plugin.example.com", projectId: 123 },
      expectedToken: "environment-token",
      expectedUrl: "https://plugin.example.com",
      expectedProjectId: 123,
    },
  ])(
    "falls back to environment values independently for omitted plugin options $options",
    async ({ options, expectedToken, expectedUrl, expectedProjectId }) => {
      vi.mocked(readConfig).mockResolvedValueOnce({
        output: "./allure-report",
        plugins: [{ id: "testops", enabled: true, options: { ...options, skipMutedTests: true } }],
      } as never);
      vi.stubEnv("ALLURE_TOKEN", "environment-token");
      vi.stubEnv("ALLURE_ENDPOINT", "https://environment.example.com");
      vi.stubEnv("ALLURE_PROJECT_ID", "456");

      await execute();

      expect(testOpsConstructorMock).toHaveBeenCalledWith({
        accessToken: expectedToken,
        url: expectedUrl,
        projectId: expectedProjectId,
      });
      expect(childEnvironment().ALLURE_TESTPLAN_PATH).toBe(planPath);
    },
  );

  it("uses the token decoded from the CI environment", async () => {
    vi.stubEnv("ALLURE_TOKEN", undefined);
    vi.stubEnv("ALLURE_CI_ENV", Buffer.from(JSON.stringify({ ALLURE_TOKEN: accessToken })).toString("base64"));

    await execute();

    expect(testOpsConstructorMock).toHaveBeenCalledWith(expect.objectContaining({ accessToken }));
    expect(childEnvironment().ALLURE_TESTPLAN_PATH).toBe(planPath);
  });

  it("writes and injects a muted-only plan", async () => {
    const mutedTests = [{ id: "123", selector: "suite.spec.ts#test" }];

    mutedGetMock.mockResolvedValueOnce(mutedTests);

    await execute();

    expect(mutedGetMock).toHaveBeenCalledExactlyOnceWith();
    expect(testOpsConstructorMock).toHaveBeenCalledWith(expect.objectContaining({ accessToken }));
    expect(writeFile).toHaveBeenCalledWith(
      planPath,
      JSON.stringify({
        version: "1.0",
        tests: [],
        mutedTests: mutedTests,
      }),
      "utf-8",
    );
    expect(childEnvironment()).toEqual({ ALLURE_CLI_ACTIVE_COMMAND: "run", ALLURE_TESTPLAN_PATH: planPath });
    expect(process.env.ALLURE_TESTPLAN_PATH).toBeUndefined();
  });

  it("does not create or inject a test plan when no muted tests are returned", async () => {
    mutedGetMock.mockResolvedValueOnce([]);

    const exitCode = await execute();

    expect(exitCode).toBe(0);
    expect(mutedGetMock).toHaveBeenCalledExactlyOnceWith();
    expect(mkdtemp).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(childEnvironment()).toEqual({ ALLURE_CLI_ACTIVE_COMMAND: "run" });
  });

  it("keeps nested commands as pass-through", async () => {
    vi.stubEnv(ALLURE_CLI_ACTIVE_COMMAND_ENV, "run");

    const exitCode = await execute();

    expect(exitCode).toBe(0);
    expect(mutedGetMock).not.toHaveBeenCalled();
    expect(mkdtemp).not.toHaveBeenCalled();
  });

  it.each(["request", "directory", "write"])("warns and continues after a muted %s failure", async (phase) => {
    if (phase === "request") mutedGetMock.mockRejectedValueOnce(new Error("404 Not Found"));
    if (phase === "directory") vi.mocked(mkdtemp).mockRejectedValueOnce(new Error("mkdir failed"));
    if (phase === "write") vi.mocked(writeFile).mockRejectedValueOnce(new Error("write failed"));
    supervisorExitCodeMock.mockResolvedValueOnce(7);

    const exitCode = await execute();

    expect(exitCode).toBe(7);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("muted"));
    expect(childEnvironment()).toEqual({ ALLURE_CLI_ACTIVE_COMMAND: "run" });
    if (phase === "write") expect(rm).toHaveBeenCalledWith(ownedDir, { recursive: true, force: true });
    else expect(writeFile).not.toHaveBeenCalled();
  });

  it("keeps the plan until report finalization", async () => {
    const { AllureReportMock } = await import("../utils.js");
    AllureReportMock.prototype.done.mockImplementationOnce(async () => {
      expect(rm).not.toHaveBeenCalledWith(ownedDir, expect.anything());
    });

    await execute();

    expect(AllureReportMock.prototype.done).toHaveBeenCalledOnce();
    expect(rm).toHaveBeenCalledWith(ownedDir, { recursive: true, force: true });
  });

  it("cleans up when report finalization rejects", async () => {
    const { AllureReportMock } = await import("../utils.js");
    const error = new Error("finalization failed");
    AllureReportMock.prototype.done.mockRejectedValueOnce(error);

    await expect(execute()).rejects.toBe(error);

    expect(rm).toHaveBeenCalledWith(ownedDir, { recursive: true, force: true });
  });

  it("warns on cleanup failure without changing the child exit code", async () => {
    vi.mocked(rm).mockImplementation(async (path) => {
      if (path === ownedDir) throw new Error("cleanup failed");
    });
    supervisorExitCodeMock.mockResolvedValueOnce(7);

    const exitCode = await execute();

    expect(exitCode).toBe(7);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("cleanup failed"));
  });

  it("cleans the plan before starting the report server", async () => {
    vi.mocked(readConfig).mockResolvedValueOnce({
      output: "./allure-report",
      open: true,
      plugins: [{ id: "testops", enabled: true, options: { skipMutedTests: true } }],
    } as never);
    vi.mocked(serve).mockImplementationOnce(async () => {
      expect(rm).toHaveBeenCalledWith(ownedDir, { recursive: true, force: true });
      return { url: "http://localhost:8080", port: 8080, stop: vi.fn(), reload: vi.fn(), open: vi.fn() };
    });

    await execute();

    expect(serve).toHaveBeenCalledOnce();
  });

  it("uses the positive plan for a targeted rerun with one muted fetch", async () => {
    const { AllureReportMock } = await import("../utils.js");
    const failedTest = { id: "failed", fullName: "suite#failed", status: "failed", labels: [] };
    AllureReportMock.prototype.store.blockingFailedTestResults.mockResolvedValue([failedTest]);
    vi.mocked(mkdtemp).mockResolvedValueOnce(ownedDir).mockResolvedValueOnce("/tmp/rerun");

    await execute(["--rerun", "1"]);

    expect(childEnvironment()).toEqual({ ALLURE_CLI_ACTIVE_COMMAND: "run", ALLURE_TESTPLAN_PATH: planPath });
    expect(childEnvironment(1)).toEqual({
      ALLURE_CLI_ACTIVE_COMMAND: "run",
      ALLURE_TESTPLAN_PATH: resolve("/tmp/rerun", "0-testplan.json"),
      ALLURE_RERUN: "0",
    });
    expect(writeFile).toHaveBeenCalledWith(
      resolve("/tmp/rerun", "0-testplan.json"),
      JSON.stringify({
        version: "1.0",
        tests: [{ selector: "suite#failed" }],
        mutedTests: [],
      }),
    );
    expect(mutedGetMock).toHaveBeenCalledTimes(1);
    expect(rm).toHaveBeenCalledWith(ownedDir, { recursive: true, force: true });
  });

  it("retains the initial plan across a full fast-fail restart with one muted fetch", async () => {
    const { AllureReportMock } = await import("../utils.js");
    vi.mocked(readConfig).mockResolvedValueOnce({
      output: "./allure-report",
      qualityGate: { rules: [] },
      plugins: [{ id: "testops", enabled: true, options: { skipMutedTests: true } }],
    } as never);
    let notify!: (callback: (ids: string[]) => Promise<void>) => void;
    const callbackReady = new Promise<(ids: string[]) => Promise<void>>((resolve) => {
      notify = resolve;
    });
    let finish!: (code: number) => void;
    const processDone = new Promise<number>((resolve) => {
      finish = resolve;
    });
    AllureReportMock.prototype.store = {
      ...AllureReportMock.prototype.store,
      testResultById: vi
        .fn()
        .mockResolvedValue({ id: "failed", fullName: "suite#failed", status: "failed", labels: [] }),
    };
    AllureReportMock.prototype.realtimeSubscriber.onTestResults.mockImplementation(
      (callback: (ids: string[]) => Promise<void>) => {
        notify(callback);
        return vi.fn();
      },
    );
    AllureReportMock.prototype.validate
      .mockResolvedValueOnce({
        results: [{ success: false, rule: "maxFailures", expected: 0, actual: 1, testResults: [] }],
        fastFailed: true,
      })
      .mockResolvedValue({ results: [], fastFailed: false });
    supervisorExitCodeMock.mockReturnValueOnce(processDone).mockResolvedValueOnce(0);

    const completion = execute(["--rerun", "1"]);
    const callback = await callbackReady;
    await callback(["failed"]);
    finish(1);
    await completion;

    expect(supervisorConstructorMock).toHaveBeenCalledTimes(2);
    expect(childEnvironment()).toEqual({ ALLURE_CLI_ACTIVE_COMMAND: "run", ALLURE_TESTPLAN_PATH: planPath });
    expect(childEnvironment(1)).toEqual({
      ALLURE_CLI_ACTIVE_COMMAND: "run",
      ALLURE_TESTPLAN_PATH: planPath,
      ALLURE_RERUN: "0",
    });
    expect(mutedGetMock).toHaveBeenCalledTimes(1);
    expect(mkdtemp).toHaveBeenCalledOnce();
    expect(rm).toHaveBeenCalledWith(ownedDir, { recursive: true, force: true });
  });
});
