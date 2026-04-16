import { resolve } from "node:path";

import { readConfig } from "@allurereport/core";
import { run, UsageError } from "clipanion";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentCommand } from "../../src/commands/agent.js";
import { executeAllureRun, executeNestedAllureCommand } from "../../src/commands/commons/run.js";
import { createAgentTestPlanContext } from "../../src/utils/agent-select.js";
import { writeLatestAgentState } from "../../src/utils/agent-state.js";
import { ALLURE_CLI_ACTIVE_COMMAND_ENV } from "../../src/utils/execution-context.js";

const { exitMock } = vi.hoisted(() => {
  return {
    exitMock: vi.fn(),
  };
});

vi.mock("node:console", async (importOriginal) => ({
  ...(await importOriginal()),
  log: vi.fn(),
  error: vi.fn(),
}));
vi.mock("node:process", async (importOriginal) => ({
  ...(await importOriginal()),
  exit: (...args: unknown[]) => exitMock(...args),
}));
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal()),
  realpath: vi.fn().mockResolvedValue("/cwd"),
  mkdtemp: vi.fn().mockResolvedValue("/tmp/allure-agent-123"),
  rm: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@allurereport/core", async () => {
  const { AllureReportMock } = await import("../utils.js");

  return {
    AllureReport: AllureReportMock,
    readConfig: vi.fn(),
    isFileNotFoundError: vi.fn().mockReturnValue(false),
  };
});
vi.mock("../../src/commands/commons/run.js", () => ({
  executeAllureRun: vi.fn().mockResolvedValue({
    globalExitCode: {
      original: 0,
      actual: undefined,
    },
    testProcessResult: null,
  }),
  executeNestedAllureCommand: vi.fn().mockResolvedValue(0),
}));
vi.mock("../../src/utils/agent-state.js", () => ({
  resolveAgentStateDir: vi.fn().mockReturnValue("/tmp/allure-agent-state-0f0810f05e3f7d8f"),
  writeLatestAgentState: vi.fn().mockResolvedValue(undefined),
  readLatestAgentState: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/utils/agent-select.js", () => ({
  normalizeAgentRerunPreset: vi.fn((value?: string) => value ?? "review"),
  parseAgentLabelFilters: vi.fn((values?: string[]) =>
    (values ?? []).map((value) => {
      const [name, filterValue] = value.split("=");

      return {
        name,
        value: filterValue,
      };
    }),
  ),
  resolveAgentSelectionOutputDir: vi.fn(),
  selectAgentTestPlan: vi.fn(),
  createAgentTestPlanContext: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(async () => {
  vi.clearAllMocks();
  delete process.env[ALLURE_CLI_ACTIVE_COMMAND_ENV];

  const { AllureReportMock } = await import("../utils.js");

  AllureReportMock.prototype.store = {
    allKnownIssues: vi.fn().mockResolvedValue([]),
  };
  (readConfig as Mock).mockResolvedValue({
    output: "./allure-report",
    open: true,
    qualityGate: {
      rules: [],
    },
    allureService: {
      accessToken: "token",
    },
    plugins: [
      {
        id: "agent",
        enabled: true,
        options: {
          outputDir: "/tmp/allure-agent-123",
        },
        plugin: { name: "agent-plugin" },
      },
    ],
  });
});

describe("agent command", () => {
  it("should fail with usage error when command to run is missing", async () => {
    const command = new AgentCommand();

    command.commandToRun = [];

    await expect(command.execute()).rejects.toBeInstanceOf(UsageError);
  });

  it("should reject expectations files placed inside the output directory", async () => {
    const command = new AgentCommand();

    command.output = "./custom-output";
    command.expectations = "./custom-output/expected.yaml";
    command.commandToRun = ["--", "npm", "test"];

    await expect(command.execute()).rejects.toBeInstanceOf(UsageError);

    expect(readConfig).not.toHaveBeenCalled();
    expect(executeAllureRun).not.toHaveBeenCalled();
  });

  it("should use an auto-created agent output dir and pass agent-only overrides to readConfig", async () => {
    const { AllureReportMock } = await import("../utils.js");
    const consoleModule = await import("node:console");
    const logMock = consoleModule.log as Mock;

    await run(AgentCommand, ["agent", "--", "npm", "test"]);

    expect(readConfig).toHaveBeenCalledWith("/cwd", undefined, {
      output: "/tmp/allure-agent-123",
      plugins: {
        agent: {
          options: {
            outputDir: "/tmp/allure-agent-123",
          },
        },
      },
    });
    expect(AllureReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        output: "/tmp/allure-agent-123",
        open: false,
        port: undefined,
        qualityGate: undefined,
        allureService: undefined,
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "agent",
          }),
        ]),
      }),
    );
    expect(executeAllureRun).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "npm",
        commandArgs: ["test"],
        cwd: "/cwd",
        environmentVariables: {
          ALLURE_CLI_ACTIVE_COMMAND: "agent",
        },
        withQualityGate: false,
        logs: "pipe",
        ignoreLogs: false,
        logProcessExit: false,
      }),
    );
    expect(logMock).toHaveBeenNthCalledWith(1, "agent output: /tmp/allure-agent-123");
    expect(logMock).toHaveBeenNthCalledWith(2, "npm test");
    expect(logMock.mock.invocationCallOrder[0]).toBeLessThan((executeAllureRun as Mock).mock.invocationCallOrder[0]);
    expect(writeLatestAgentState).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        cwd: "/cwd",
        outputDir: "/tmp/allure-agent-123",
        expectationsPath: undefined,
        command: "npm test",
        startedAt: expect.any(String),
        status: "running",
      }),
    );
    expect(writeLatestAgentState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        cwd: "/cwd",
        outputDir: "/tmp/allure-agent-123",
        expectationsPath: undefined,
        command: "npm test",
        startedAt: expect.any(String),
        finishedAt: expect.any(String),
        status: "finished",
        exitCode: 0,
      }),
    );
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it("should continue the run when latest-state persistence in the resolved state dir is not permitted", async () => {
    const consoleModule = await import("node:console");
    const stateDir = "/tmp/allure-agent-state-0f0810f05e3f7d8f";

    (writeLatestAgentState as Mock)
      .mockRejectedValueOnce(
        Object.assign(new Error(`EACCES: permission denied, mkdir '${stateDir}'`), { code: "EACCES" }),
      )
      .mockResolvedValueOnce(undefined);

    await run(AgentCommand, ["agent", "--", "npm", "test"]);

    expect(consoleModule.error).toHaveBeenCalledWith(
      `Could not update latest agent output in ${stateDir}: EACCES: permission denied, mkdir '${stateDir}'`,
    );
    expect(executeAllureRun).toHaveBeenCalled();
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it("should resolve explicit output and expectations paths relative to cwd", async () => {
    const consoleModule = await import("node:console");
    const resolvedOutput = resolve("/cwd", "./custom-output");
    const resolvedExpectations = resolve("/cwd", "./expected.yaml");

    await run(AgentCommand, [
      "agent",
      "--output",
      "./custom-output",
      "--expectations",
      "./expected.yaml",
      "--",
      "npm",
      "test",
    ]);

    expect(readConfig).toHaveBeenCalledWith("/cwd", undefined, {
      output: resolvedOutput,
      plugins: {
        agent: {
          options: {
            outputDir: resolvedOutput,
          },
        },
      },
    });
    expect(consoleModule.log).toHaveBeenCalledWith(`agent output: ${resolvedOutput}`);
    expect(consoleModule.log).toHaveBeenCalledWith(`agent expectations: ${resolvedExpectations}`);
  });

  it("should pass ALLURE_TESTPLAN_PATH to the child process when rerun-from is enabled", async () => {
    const cleanupMock = vi.fn().mockResolvedValue(undefined);

    (createAgentTestPlanContext as Mock).mockResolvedValueOnce({
      outputDir: "/tmp/previous-agent",
      preset: "review",
      selectedCount: 1,
      testPlanPath: "/tmp/testplan.json",
      cleanup: cleanupMock,
    });

    await run(AgentCommand, ["agent", "--rerun-from", "./previous-agent", "--", "npm", "test"]);

    expect(createAgentTestPlanContext).toHaveBeenCalledWith({
      cwd: "/cwd",
      from: "./previous-agent",
      latest: false,
      preset: "review",
      environments: undefined,
      labelFilters: [],
    });
    expect(executeAllureRun).toHaveBeenCalledWith(
      expect.objectContaining({
        environmentVariables: {
          ALLURE_CLI_ACTIVE_COMMAND: "agent",
          ALLURE_TESTPLAN_PATH: "/tmp/testplan.json",
        },
      }),
    );
    expect(cleanupMock).toHaveBeenCalledTimes(1);
  });

  it("should resolve rerun-latest through the shared test-plan context", async () => {
    const cleanupMock = vi.fn().mockResolvedValue(undefined);

    (createAgentTestPlanContext as Mock).mockResolvedValueOnce({
      outputDir: "/tmp/latest-agent",
      preset: "review",
      selectedCount: 1,
      testPlanPath: "/tmp/latest-testplan.json",
      cleanup: cleanupMock,
    });

    await run(AgentCommand, ["agent", "--rerun-latest", "--", "npm", "test"]);

    expect(createAgentTestPlanContext).toHaveBeenCalledWith({
      cwd: "/cwd",
      from: undefined,
      latest: true,
      preset: "review",
      environments: undefined,
      labelFilters: [],
    });
    expect(executeAllureRun).toHaveBeenCalledWith(
      expect.objectContaining({
        environmentVariables: {
          ALLURE_CLI_ACTIVE_COMMAND: "agent",
          ALLURE_TESTPLAN_PATH: "/tmp/latest-testplan.json",
        },
      }),
    );
    expect(cleanupMock).toHaveBeenCalledTimes(1);
  });

  it("should bypass nested allure wrappers and execute the child command directly", async () => {
    process.env[ALLURE_CLI_ACTIVE_COMMAND_ENV] = "run";
    const consoleModule = await import("node:console");

    await run(AgentCommand, ["agent", "--silent", "--", "npm", "test"]);

    expect(consoleModule.log).toHaveBeenCalledWith("npm test");
    expect(executeNestedAllureCommand).toHaveBeenCalledWith({
      command: "npm",
      commandArgs: ["test"],
      cwd: "/cwd",
      silent: true,
    });
    expect(readConfig).not.toHaveBeenCalled();
    expect(executeAllureRun).not.toHaveBeenCalled();
    expect(exitMock).toHaveBeenCalledWith(0);

    delete process.env[ALLURE_CLI_ACTIVE_COMMAND_ENV];
  });

  it("should sandbox ALLURE_AGENT_* variables during execution and restore them afterwards", async () => {
    const resolvedOutput = resolve("/cwd", "./custom-output");
    const resolvedExpectations = resolve("/cwd", "./expected.yaml");

    process.env.ALLURE_AGENT_OUTPUT = "ambient-output";
    process.env.ALLURE_AGENT_EXPECTATIONS = "ambient-expected";
    process.env.ALLURE_AGENT_NAME = "ambient-name";
    process.env.ALLURE_AGENT_LOOP_ID = "ambient-loop";
    process.env.ALLURE_AGENT_TASK_ID = "ambient-task";
    process.env.ALLURE_AGENT_CONVERSATION_ID = "ambient-conversation";

    (executeAllureRun as Mock).mockImplementationOnce(async () => {
      expect(process.env.ALLURE_AGENT_OUTPUT).toBe(resolvedOutput);
      expect(process.env.ALLURE_AGENT_EXPECTATIONS).toBe(resolvedExpectations);
      expect(process.env.ALLURE_AGENT_COMMAND).toBe("npm test");
      expect(process.env.ALLURE_AGENT_PROJECT_ROOT).toBe("/cwd");
      expect(process.env.ALLURE_AGENT_NAME).toBeUndefined();
      expect(process.env.ALLURE_AGENT_LOOP_ID).toBeUndefined();
      expect(process.env.ALLURE_AGENT_TASK_ID).toBeUndefined();
      expect(process.env.ALLURE_AGENT_CONVERSATION_ID).toBeUndefined();

      return {
        globalExitCode: {
          original: 0,
          actual: undefined,
        },
        testProcessResult: null,
      };
    });

    await run(AgentCommand, [
      "agent",
      "--output",
      "./custom-output",
      "--expectations",
      "./expected.yaml",
      "--",
      "npm",
      "test",
    ]);

    expect(process.env.ALLURE_AGENT_OUTPUT).toBe("ambient-output");
    expect(process.env.ALLURE_AGENT_EXPECTATIONS).toBe("ambient-expected");
    expect(process.env.ALLURE_AGENT_NAME).toBe("ambient-name");
    expect(process.env.ALLURE_AGENT_LOOP_ID).toBe("ambient-loop");
    expect(process.env.ALLURE_AGENT_TASK_ID).toBe("ambient-task");
    expect(process.env.ALLURE_AGENT_CONVERSATION_ID).toBe("ambient-conversation");

    delete process.env.ALLURE_AGENT_OUTPUT;
    delete process.env.ALLURE_AGENT_EXPECTATIONS;
    delete process.env.ALLURE_AGENT_NAME;
    delete process.env.ALLURE_AGENT_LOOP_ID;
    delete process.env.ALLURE_AGENT_TASK_ID;
    delete process.env.ALLURE_AGENT_CONVERSATION_ID;
  });
});
