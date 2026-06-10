import { resolve } from "node:path";

import { readConfig } from "@allurereport/core";
import {
  AgentExpectationUsageError,
  AgentUsageError,
  buildAgentInlineExpectations,
  createAgentTestPlanContext,
  validateAgentExpectationsFile,
  writeInvalidAgentExpectationOutput,
  writeLatestAgentState,
} from "@allurereport/plugin-agent";
import { epic, feature, label, story } from "allure-js-commons";
import { run, UsageError } from "clipanion";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AgentCommand,
  AgentCapabilitiesCommand,
  AgentLatestCommand,
  AgentQueryCommand,
  AgentSelectCommand,
  AgentStateDirCommand,
  createAgentCapabilities,
} from "../../src/commands/agent.js";
import { executeAllureRun, executeNestedAllureCommand } from "../../src/commands/commons/run.js";
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
  readFile: vi.fn().mockResolvedValue("goal: valid file expectations\n"),
  mkdtemp: vi.fn().mockResolvedValue("/tmp/allure-agent-123"),
  rm: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
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
vi.mock("@allurereport/plugin-agent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@allurereport/plugin-agent")>();

  return {
    ...actual,
    resolveAgentStateDir: vi.fn().mockReturnValue("/tmp/allure-agent-state-0f0810f05e3f7d8f"),
    writeLatestAgentState: vi.fn().mockResolvedValue(undefined),
    readLatestAgentState: vi.fn().mockResolvedValue(undefined),
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
    buildAgentInlineExpectations: vi.fn((options: Record<string, unknown>) =>
      Object.values(options).some((value) =>
        Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.length > 0,
      )
        ? { goal: "mock inline expectations" }
        : undefined,
    ),
    validateAgentExpectationsFile: vi.fn().mockResolvedValue(undefined),
    writeInvalidAgentExpectationOutput: vi.fn().mockResolvedValue({
      outputDir: "/tmp/allure-agent-123",
      generatedAt: "2026-06-10T16:00:00.000Z",
    }),
  };
});

beforeEach(async () => {
  await epic("coverage");
  await feature("agent-mode");
  await story("agent");
  await label("coverage", "agent-mode");
  vi.clearAllMocks();
  delete process.env[ALLURE_CLI_ACTIVE_COMMAND_ENV];

  const { AllureReportMock } = await import("../utils.js");

  (executeAllureRun as Mock).mockReset();
  (executeNestedAllureCommand as Mock).mockReset();
  (writeLatestAgentState as Mock).mockReset();
  (createAgentTestPlanContext as Mock).mockReset();
  (buildAgentInlineExpectations as Mock).mockReset();
  (validateAgentExpectationsFile as Mock).mockReset();
  (writeInvalidAgentExpectationOutput as Mock).mockReset();
  (readConfig as Mock).mockReset();

  (executeAllureRun as Mock).mockResolvedValue({
    globalExitCode: {
      original: 0,
      actual: undefined,
    },
    testProcessResult: null,
  });
  (executeNestedAllureCommand as Mock).mockResolvedValue(0);
  (writeLatestAgentState as Mock).mockResolvedValue(undefined);
  (createAgentTestPlanContext as Mock).mockResolvedValue(undefined);
  (buildAgentInlineExpectations as Mock).mockImplementation((options: Record<string, unknown>) =>
    Object.values(options).some((value) =>
      Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.length > 0,
    )
      ? { goal: "mock inline expectations" }
      : undefined,
  );
  (validateAgentExpectationsFile as Mock).mockResolvedValue(undefined);
  (writeInvalidAgentExpectationOutput as Mock).mockResolvedValue({
    outputDir: "/tmp/allure-agent-123",
    generatedAt: "2026-06-10T16:00:00.000Z",
  });
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
  const stripAnsi = (value: string) => value.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g"), "");

  const captureAgentHelp = async (args: string[]) => {
    const stdout = { write: vi.fn() };

    const exitCode = await run(
      { binaryName: "allure" },
      [
        AgentCapabilitiesCommand,
        AgentLatestCommand,
        AgentQueryCommand,
        AgentSelectCommand,
        AgentStateDirCommand,
        AgentCommand,
      ],
      args,
      {
        stdout: stdout as unknown as NodeJS.WritableStream,
      },
    );

    expect(exitCode).toBe(0);

    return stripAnsi(stdout.write.mock.calls.map(([chunk]) => String(chunk)).join(""));
  };

  it.each([
    {
      command: "agent",
      args: ["agent", "--help"],
      expected: [
        "Multiple commands match your selection:",
        "allure agent capabilities",
        "allure agent latest",
        "allure agent query",
        "allure agent select",
        "allure agent state-dir",
        "allure agent [--config",
        "--expect-tests #0",
        "--expect-label #0",
        "--expect-test #0",
        "--expect-step-containing #0",
        "--rerun-latest",
        "Run again with -h=<index>",
      ],
    },
    {
      command: "agent capabilities",
      args: ["agent", "capabilities", "--help"],
      expected: ["Print structured Allure agent capability information", "$ allure agent capabilities", "--json"],
    },
    {
      command: "agent query",
      args: ["agent", "query", "--help"],
      expected: [
        "Query an existing Allure agent output directory as focused JSON",
        "$ allure agent query",
        "--latest",
        "--from #0",
        "--status #0",
        "--severity #0",
        "--include-markdown",
      ],
    },
    {
      command: "agent select",
      args: ["agent", "select", "--help"],
      expected: [
        "Select tests from an existing agent output and emit a test plan",
        "$ allure agent select",
        "--latest",
        "--preset #0",
        "--environment #0",
        "--label #0",
        "--output,-o #0",
      ],
    },
    {
      command: "agent latest",
      args: ["agent", "latest", "--help"],
      expected: [
        "Print the latest Allure agent output directory and index path for the current project",
        "$ allure agent latest",
        "--cwd #0",
      ],
    },
    {
      command: "agent state-dir",
      args: ["agent", "state-dir", "--help"],
      expected: [
        "Print the Allure agent state directory for the current project",
        "$ allure agent state-dir",
        "--cwd #0",
      ],
    },
  ])("should expose $command help for local capability detection", async ({ args, expected }) => {
    const output = await captureAgentHelp(args);

    expected.forEach((line) => {
      expect(output).toContain(line);
    });
  });

  it("should print structured agent capabilities as JSON", async () => {
    const consoleModule = await import("node:console");
    const logMock = consoleModule.log as Mock;

    const exitCode = await run(AgentCapabilitiesCommand, ["agent", "capabilities", "--json"]);

    expect(exitCode).toBe(0);
    expect(logMock).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(logMock.mock.calls[0][0]) as ReturnType<typeof createAgentCapabilities>;

    expect(payload).toEqual(createAgentCapabilities());
  });

  it("should fail with usage error when command to run is missing", async () => {
    const command = new AgentCommand();

    command.commandToRun = [];

    await expect(command.execute()).rejects.toBeInstanceOf(UsageError);
  });

  it("should translate plugin-agent expectation file validation failures to usage errors", async () => {
    const command = new AgentCommand();

    command.output = "./custom-output";
    command.expectations = "./custom-output/expected.yaml";
    command.commandToRun = ["--", "npm", "test"];
    (validateAgentExpectationsFile as Mock).mockRejectedValueOnce(new AgentUsageError("invalid expectation path"));

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
            command: "npm test",
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
    expect(logMock).toHaveBeenNthCalledWith(2, "agent index: /tmp/allure-agent-123/index.md");
    expect(logMock).toHaveBeenNthCalledWith(3, "npm test");
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
            command: "npm test",
            expectationsPath: resolvedExpectations,
          },
        },
      },
    });
    expect(consoleModule.log).toHaveBeenCalledWith(`agent output: ${resolvedOutput}`);
    expect(consoleModule.log).toHaveBeenCalledWith(`agent index: ${resolvedOutput}/index.md`);
    expect(consoleModule.log).toHaveBeenCalledWith(`agent expectations: ${resolvedExpectations}`);
  });

  it("should pass inline expectation options to plugin-agent and readConfig", async () => {
    const consoleModule = await import("node:console");

    await run(AgentCommand, [
      "agent",
      "--goal",
      "Review agent visibility",
      "--task-id",
      "agent-inline",
      "--expect-tests",
      "2",
      "--expect-label",
      "module=plugin-agent",
      "--expect-env",
      "node",
      "--expect-test",
      "suite should pass",
      "--expect-prefix",
      "suite",
      "--forbid-label",
      "layer=e2e",
      "--expect-step-containing",
      "assert expected behavior",
      "--expect-steps",
      "1",
      "--expect-attachments",
      "1",
      "--expect-attachment",
      "trace.zip",
      "--expect-attachment",
      "content-type=application/json",
      "--",
      "npm",
      "test",
    ]);

    expect(buildAgentInlineExpectations).toHaveBeenCalledWith({
      goal: ["Review agent visibility"],
      taskId: ["agent-inline"],
      expectTests: ["2"],
      expectLabels: ["module=plugin-agent"],
      expectEnvironments: ["node"],
      expectFullNames: ["suite should pass"],
      expectPrefixes: ["suite"],
      forbidLabels: ["layer=e2e"],
      expectStepContains: ["assert expected behavior"],
      expectSteps: ["1"],
      expectAttachments: ["1"],
      expectAttachmentFilters: ["trace.zip", "content-type=application/json"],
    });
    expect(readConfig).toHaveBeenCalledWith(
      "/cwd",
      undefined,
      expect.objectContaining({
        plugins: {
          agent: {
            options: expect.objectContaining({
              expectations: { goal: "mock inline expectations" },
            }),
          },
        },
      }),
    );
    expect(consoleModule.log).toHaveBeenCalledWith("agent expectations: CLI options");
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it("should reject mixing an expectations file with inline expectation flags", async () => {
    const consoleModule = await import("node:console");
    const command = new AgentCommand();

    command.expectations = "./expected.yaml";
    command.goal = ["Review"];
    command.commandToRun = ["--", "npm", "test"];

    await command.execute();

    expect(writeInvalidAgentExpectationOutput).toHaveBeenCalledWith({
      outputDir: "/tmp/allure-agent-123",
      command: "npm test",
      error: expect.any(AgentExpectationUsageError),
    });
    expect(consoleModule.error).toHaveBeenCalledWith("Use either --expectations <file> or inline expectation flags, not both");
    expect(executeAllureRun).not.toHaveBeenCalled();
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it("should write invalid agent output when plugin-agent inline expectation parsing fails", async () => {
    const consoleModule = await import("node:console");
    const command = new AgentCommand();
    const outputDir = resolve("/cwd", "./agent-invalid");
    const error = new AgentExpectationUsageError(
      'Invalid --expect-label "module". Expected the form name=value, for example module=cli',
      "--expect-label",
    );

    (buildAgentInlineExpectations as Mock).mockImplementationOnce(() => {
      throw error;
    });

    command.output = "./agent-invalid";
    command.expectLabels = ["module"];
    command.commandToRun = ["--", "npm", "test"];

    await command.execute();

    expect(writeInvalidAgentExpectationOutput).toHaveBeenCalledWith({
      outputDir,
      command: "npm test",
      error,
    });
    expect(readConfig).not.toHaveBeenCalled();
    expect(executeAllureRun).not.toHaveBeenCalled();
    expect(consoleModule.log).toHaveBeenCalledWith(`agent output: ${outputDir}`);
    expect(consoleModule.log).toHaveBeenCalledWith(`agent index: ${outputDir}/index.md`);
    expect(consoleModule.error).toHaveBeenCalledWith(
      'Invalid --expect-label "module". Expected the form name=value, for example module=cli',
    );
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it("should write invalid agent output when plugin-agent expectation file validation fails", async () => {
    const consoleModule = await import("node:console");
    const command = new AgentCommand();
    const outputDir = resolve("/cwd", "./agent-invalid-file");
    const error = new AgentExpectationUsageError(
      "Could not load expectations from /cwd/expected.yaml: Expected a YAML or JSON object",
      "--expectations",
    );

    (validateAgentExpectationsFile as Mock).mockRejectedValueOnce(error);

    command.output = "./agent-invalid-file";
    command.expectations = "./expected.yaml";
    command.commandToRun = ["--", "npm", "test"];

    await command.execute();

    expect(writeInvalidAgentExpectationOutput).toHaveBeenCalledWith({
      outputDir,
      command: "npm test",
      error,
    });
    expect(readConfig).not.toHaveBeenCalled();
    expect(executeAllureRun).not.toHaveBeenCalled();
    expect(consoleModule.log).toHaveBeenCalledWith(`agent output: ${outputDir}`);
    expect(consoleModule.log).toHaveBeenCalledWith(`agent index: ${outputDir}/index.md`);
    expect(consoleModule.error).toHaveBeenCalledWith(
      "Could not load expectations from /cwd/expected.yaml: Expected a YAML or JSON object",
    );
    expect(exitMock).toHaveBeenCalledWith(1);
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

  it("should pass agent metadata to the plugin through options", async () => {
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
            command: "npm test",
            expectationsPath: resolvedExpectations,
          },
        },
      },
    });
  });
});
