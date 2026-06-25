import * as console from "node:console";

import { readConfig } from "@allurereport/core";
import AwesomePlugin from "@allurereport/plugin-awesome";
import { epic, feature, label, story } from "allure-js-commons";
import { run, UsageError } from "clipanion";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { RunCommand } from "../../src/commands/run.js";
import { ALLURE_CLI_ACTIVE_COMMAND_ENV } from "../../src/utils/execution-context.js";

const { exitMock, processStream } = vi.hoisted(() => {
  const exitMock = vi.fn();
  const processStream = {
    setEncoding: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
  };

  return {
    exitMock,
    processStream,
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
vi.mock("@allurereport/directory-watcher", () => ({
  allureResultsDirectoriesWatcher: vi.fn(() => ({
    initialScan: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(undefined),
  })),
  delayedFileProcessingWatcher: vi.fn(() => ({
    addFile: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(undefined),
  })),
  newFilesInDirectoryWatcher: vi.fn(() => ({
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

  AllureReportMock.prototype.store = {
    allKnownIssues: vi.fn().mockResolvedValue([]),
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
});

describe("run command", () => {
  it("should fail with usage error when command to run is missing", async () => {
    const command = new RunCommand();

    command.commandToRun = [];

    await expect(command.execute()).rejects.toBeInstanceOf(UsageError);
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
