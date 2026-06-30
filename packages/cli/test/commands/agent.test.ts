import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { readConfig, readRawConfig } from "@allurereport/core";
import {
  AgentExpectationUsageError,
  AgentUsageError,
  buildAgentInlineExpectations,
  cleanupAgentRunState,
  cleanupStaleAgentRunStates,
  createAgentTestPlanContext,
  formatAgentRunSummary,
  loadAgentOutput,
  resolveAgentStateDir,
  validateAgentExpectationsFile,
  writeInvalidAgentExpectationOutput,
  writeAgentRunState,
} from "@allurereport/plugin-agent";
import { attachment, epic, feature, label, story } from "allure-js-commons";
import { run, UsageError } from "clipanion";
import { glob } from "glob";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { createAgentHumanReportConfig } from "../../src/commands/agent-human-report.js";
import {
  AgentCommand,
  AgentCapabilitiesCommand,
  AgentInspectCommand,
  AgentLatestCommand,
  AgentQueryCommand,
  AgentSelectCommand,
  AgentStateDirCommand,
  createAgentCapabilities,
} from "../../src/commands/agent.js";
import { executeAllureRun, executeNestedAllureCommand } from "../../src/commands/commons/run.js";
import { ALLURE_CLI_ACTIVE_COMMAND_ENV } from "../../src/utils/execution-context.js";

const { exitMock } = vi.hoisted(() => ({
  exitMock: vi.fn(),
}));

const agentOutputDir = join(tmpdir(), "allure-agent-123");
const agentStateDir = join(tmpdir(), "allure-agent-state");
const latestAgentOutputDir = join(tmpdir(), "latest-agent");
const latestTestPlanPath = join(tmpdir(), "latest-testplan.json");
const previousAgentOutputDir = join(tmpdir(), "previous-agent");
const testPlanPath = join(tmpdir(), "testplan.json");

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
  mkdtemp: vi.fn(),
  rm: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@allurereport/core", async () => {
  const { AllureReportMock } = await import("../utils.js");

  return {
    AllureReport: AllureReportMock,
    readConfig: vi.fn(),
    readRawConfig: vi.fn(),
    isFileNotFoundError: vi.fn().mockReturnValue(false),
  };
});
vi.mock("@allurereport/plugin-awesome", () => ({
  default: vi.fn(function (this: Record<string, unknown>, options?: unknown) {
    this.options = options;
    this.start = vi.fn().mockResolvedValue(undefined);
    this.done = vi.fn().mockResolvedValue(undefined);
    this.info = vi.fn().mockResolvedValue(undefined);
  }),
}));
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
vi.mock("glob", () => ({
  glob: vi.fn(),
}));
vi.mock("@allurereport/plugin-agent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@allurereport/plugin-agent")>();

  return {
    ...actual,
    resolveAgentStateDir: vi.fn(),
    writeAgentRunState: vi.fn().mockResolvedValue(undefined),
    cleanupAgentRunState: vi.fn().mockResolvedValue({ deleted: [], failed: [], retained: [] }),
    cleanupStaleAgentRunStates: vi.fn().mockResolvedValue({
      checked: 0,
      deleted: [],
      failed: [],
      orphaned: { deleted: [], failed: [], retained: [] },
      retained: [],
      skipped: [],
    }),
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
    loadAgentOutput: vi.fn().mockResolvedValue({ outputDir: "", run: {}, tests: [], findings: [], humanReport: null }),
    formatAgentRunSummary: vi.fn((params: { outputDir: string }) => [`agent summary: ${params.outputDir}`]),
    buildAgentInlineExpectations: vi.fn((options: Record<string, unknown>) =>
      Object.values(options).some((value) =>
        Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.length > 0,
      )
        ? { goal: "mock inline expectations" }
        : undefined,
    ),
    validateAgentExpectationsFile: vi.fn().mockResolvedValue(undefined),
    writeInvalidAgentExpectationOutput: vi.fn(),
  };
});

beforeEach(async () => {
  await epic("coverage");
  await feature("agent-mode");
  await story("agent");
  await label("coverage", "agent-mode");
  vi.clearAllMocks();
  delete process.env[ALLURE_CLI_ACTIVE_COMMAND_ENV];

  const fsModule = await import("node:fs/promises");
  const { AllureReportMock } = await import("../utils.js");

  (fsModule.mkdtemp as Mock).mockReset();
  (executeAllureRun as Mock).mockReset();
  (executeNestedAllureCommand as Mock).mockReset();
  (resolveAgentStateDir as Mock).mockReset();
  (writeAgentRunState as Mock).mockReset();
  (cleanupAgentRunState as Mock).mockReset();
  (cleanupStaleAgentRunStates as Mock).mockReset();
  (createAgentTestPlanContext as Mock).mockReset();
  (loadAgentOutput as Mock).mockReset();
  (formatAgentRunSummary as Mock).mockReset();
  (buildAgentInlineExpectations as Mock).mockReset();
  (validateAgentExpectationsFile as Mock).mockReset();
  (writeInvalidAgentExpectationOutput as Mock).mockReset();
  (readConfig as Mock).mockReset();
  (readRawConfig as Mock).mockReset();
  vi.mocked(glob).mockReset();

  (fsModule.mkdtemp as Mock).mockResolvedValue(agentOutputDir);
  (executeAllureRun as Mock).mockResolvedValue({
    globalExitCode: {
      original: 0,
      actual: undefined,
    },
    testProcessResult: null,
  });
  (executeNestedAllureCommand as Mock).mockResolvedValue(0);
  (resolveAgentStateDir as Mock).mockReturnValue(agentStateDir);
  (writeAgentRunState as Mock).mockResolvedValue(undefined);
  (cleanupAgentRunState as Mock).mockResolvedValue({ deleted: [], failed: [], retained: [] });
  (cleanupStaleAgentRunStates as Mock).mockResolvedValue({
    checked: 0,
    deleted: [],
    failed: [],
    orphaned: { deleted: [], failed: [], retained: [] },
    retained: [],
    skipped: [],
  });
  (createAgentTestPlanContext as Mock).mockResolvedValue(undefined);
  (loadAgentOutput as Mock).mockResolvedValue({ outputDir: "", run: {}, tests: [], findings: [], humanReport: null });
  (formatAgentRunSummary as Mock).mockImplementation((params: { outputDir: string }) => [
    `agent summary: ${params.outputDir}`,
  ]);
  (buildAgentInlineExpectations as Mock).mockImplementation((options: Record<string, unknown>) =>
    Object.values(options).some((value) =>
      Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.length > 0,
    )
      ? { goal: "mock inline expectations" }
      : undefined,
  );
  (validateAgentExpectationsFile as Mock).mockResolvedValue(undefined);
  (writeInvalidAgentExpectationOutput as Mock).mockResolvedValue({
    outputDir: agentOutputDir,
    generatedAt: "2026-06-10T16:00:00.000Z",
  });
  (readRawConfig as Mock).mockResolvedValue({ plugins: {} });
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
          outputDir: agentOutputDir,
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
        AgentInspectCommand,
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
        "allure agent inspect",
        "allure agent latest",
        "allure agent query",
        "allure agent select",
        "allure agent state-dir",
        "allure agent [--config",
        "--report #0",
        "--expect-tests #0",
        "--expect-label #0",
        "--expect-test #0",
        "--expect-step-containing #0",
        "--rerun-latest",
        "Run again with -h=<index>",
      ],
    },
    {
      command: "agent inspect",
      args: ["agent", "inspect", "--help"],
      expected: [
        "Inspect existing Allure results or dump archives in Allure agent mode",
        "With the default --report auto mode",
        "manifest/human-report.json",
        "human-report manifest before regenerating anything",
        "$ allure agent inspect",
        "--dump #0",
        "Explicit output is caller-managed",
        "--report #0",
        "--report-name,--name #0",
        "--open",
        "--port #0",
        "--history-limit #0",
        "--hide-labels #0",
        "--expect-tests #0",
        "--expect-label #0",
        "--expect-test #0",
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
        "When a user asks for a human-readable report from",
        "the last run",
        "manifest/human-report.json",
        "usually awesome/index.html",
        "$ allure agent latest",
        "--cwd #0",
      ],
    },
    {
      command: "agent state-dir",
      args: ["agent", "state-dir", "--help"],
      expected: ["Print the shared Allure agent state directory", "$ allure agent state-dir", "--cwd #0"],
    },
  ])("should expose $command help for local capability detection", async ({ args, expected }) => {
    const output = await captureAgentHelp(args);

    expected.forEach((line) => {
      expect(output).toContain(line);
    });
  });

  it("should expose agent run output cleanup guidance in detailed help", async () => {
    const summary = await captureAgentHelp(["agent", "--help"]);
    const runHelpIndex = summary.match(/^\s*(\d+)\. allure agent \[/mu)?.[1];

    expect(runHelpIndex).toBeDefined();

    const output = await captureAgentHelp(["agent", `-h=${runHelpIndex!}`]);

    expect(output).toContain("Run specified command in Allure agent mode");
    expect(output).toContain("--output,-o #0");
    expect(output).toContain("Explicit output is caller-managed");
    expect(output).toContain("state compaction can drop its record");
  });

  it("should print structured agent capabilities as JSON", async () => {
    const consoleModule = await import("node:console");
    const logMock = consoleModule.log as Mock;

    const exitCode = await run(AgentCapabilitiesCommand, ["agent", "capabilities", "--json"]);

    expect(exitCode).toBe(0);
    expect(logMock).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(logMock.mock.calls[0][0]) as ReturnType<typeof createAgentCapabilities>;

    expect(payload).toEqual(createAgentCapabilities());
    expect(payload.commands.inspect.options).toContain("--dump");
    expect(payload.commands.inspect.options).toContain("--report");
    expect(payload.commands.run.options).toContain("--report");
    expect(payload.output.files).toContain("manifest/human-report.json");
    expect(payload.output.files).toContain("awesome/index.html");
    expect(payload.humanReports.defaultMode).toBe("auto");
    expect(payload.humanReports.statusManifest).toBe("manifest/human-report.json");
    expect(payload.humanReports.defaultGeneratedPath).toBe("awesome/index.html");
    expect(payload.humanReports.discovery).toEqual(
      expect.arrayContaining([
        expect.stringContaining("allure agent latest"),
        expect.stringContaining("If the status is `generated`"),
      ]),
    );
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

  it("refuses to delete a non-empty, non-agent --output directory before a run", async () => {
    const dir = mkdtempSync(join(tmpdir(), "allure-agent-output-guard-"));
    writeFileSync(join(dir, "important.txt"), "keep me");

    try {
      const command = new AgentCommand();

      command.output = dir;
      command.commandToRun = ["--", "npm", "test"];

      await expect(command.execute()).rejects.toBeInstanceOf(UsageError);

      expect(readConfig).not.toHaveBeenCalled();
      expect(executeAllureRun).not.toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("allows an empty --output directory", async () => {
    const dir = mkdtempSync(join(tmpdir(), "allure-agent-output-empty-"));

    try {
      await run(AgentCommand, ["agent", "--output", dir, "--", "npm", "test"]);

      expect(executeAllureRun).toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses a non-empty --output directory even when it looks like a previous agent output", async () => {
    const dir = mkdtempSync(join(tmpdir(), "allure-agent-output-prev-"));
    writeFileSync(join(dir, "index.md"), "# previous agent run");

    try {
      const command = new AgentCommand();

      command.output = dir;
      command.commandToRun = ["--", "npm", "test"];

      await expect(command.execute()).rejects.toBeInstanceOf(UsageError);

      expect(readConfig).not.toHaveBeenCalled();
      expect(executeAllureRun).not.toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses an inspect --output that points at a non-empty results directory", async () => {
    const dir = mkdtempSync(join(tmpdir(), "allure-agent-inspect-output-"));
    writeFileSync(join(dir, "0a1b2c3d-result.json"), "{}");
    vi.mocked(glob).mockResolvedValueOnce([`${dir}/`]);

    try {
      const command = new AgentInspectCommand();

      command.output = dir;
      command.resultsDir = [dir];

      await expect(command.execute()).rejects.toBeInstanceOf(UsageError);

      expect(readConfig).not.toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses a non-empty --output before the invalid-expectation fallback can delete it", async () => {
    const dir = mkdtempSync(join(tmpdir(), "allure-agent-invalid-output-guard-"));
    writeFileSync(join(dir, "important.txt"), "keep me");
    // An expectation error is queued so that, without the guard, the flow would reach
    // writeInvalidAgentExpectationOutput (which rm -rf's the dir).
    (validateAgentExpectationsFile as Mock).mockRejectedValueOnce(
      new AgentExpectationUsageError("invalid expectation"),
    );

    try {
      const command = new AgentCommand();

      command.output = dir;
      command.commandToRun = ["--", "npm", "test"];

      await expect(command.execute()).rejects.toBeInstanceOf(UsageError);

      expect(writeInvalidAgentExpectationOutput).not.toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses a non-empty inspect --output before the invalid-expectation fallback can delete it", async () => {
    const dir = mkdtempSync(join(tmpdir(), "allure-agent-invalid-inspect-guard-"));
    writeFileSync(join(dir, "important.txt"), "keep me");
    (validateAgentExpectationsFile as Mock).mockRejectedValueOnce(
      new AgentExpectationUsageError("invalid expectation"),
    );

    try {
      const command = new AgentInspectCommand();

      command.output = dir;
      command.resultsDir = ["./allure-results"];

      await expect(command.execute()).rejects.toBeInstanceOf(UsageError);

      expect(writeInvalidAgentExpectationOutput).not.toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("should use an auto-created agent output dir and pass agent-mode overrides to readConfig", async () => {
    const { AllureReportMock } = await import("../utils.js");
    const consoleModule = await import("node:console");
    const logMock = consoleModule.log as Mock;

    await run(AgentCommand, ["agent", "--", "npm", "test"]);

    expect(readConfig).toHaveBeenCalledWith("/cwd", undefined, {
      output: agentOutputDir,
      plugins: {
        agent: {
          options: {
            outputDir: agentOutputDir,
            command: "npm test",
            humanReport: expect.any(Function),
          },
        },
      },
    });
    expect(AllureReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        output: agentOutputDir,
        open: false,
        port: undefined,
        qualityGate: undefined,
        allureService: undefined,
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "awesome",
          }),
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
        // Agent runs capture the test output instead of streaming it to the terminal.
        silent: true,
        ignoreLogs: false,
        logProcessExit: false,
      }),
    );
    // Before the run, the output dir is announced first so an agent can watch the live state; the
    // command is echoed but its own output is not streamed.
    expect(logMock).toHaveBeenNthCalledWith(1, `agent output: ${agentOutputDir}`);
    expect(logMock).toHaveBeenNthCalledWith(2, "npm test");
    expect(logMock).toHaveBeenCalledWith(expect.stringContaining("manifest/test-events.jsonl"));
    expect(logMock.mock.invocationCallOrder[0]).toBeLessThan((executeAllureRun as Mock).mock.invocationCallOrder[0]);
    // After the run, a compact summary is printed (built from the agent output) instead of test logs,
    // with the wall-clock duration and a rerun-failed command derived from the test command.
    expect(formatAgentRunSummary).toHaveBeenCalledWith(
      expect.objectContaining({ outputDir: agentOutputDir, rerunCommand: "npm test", durationMs: expect.any(Number) }),
    );
    expect(logMock).toHaveBeenCalledWith(`agent summary: ${agentOutputDir}`);
    expect(writeAgentRunState).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        runId: expect.any(String),
        cwd: "/cwd",
        outputDir: agentOutputDir,
        managedOutput: true,
        expectationsPath: undefined,
        command: "npm test",
        startedAt: expect.any(Number),
        status: "running",
        pid: expect.any(Number),
      }),
    );
    expect(writeAgentRunState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        runId: expect.any(String),
        cwd: "/cwd",
        outputDir: agentOutputDir,
        managedOutput: true,
        expectationsPath: undefined,
        command: "npm test",
        startedAt: expect.any(Number),
        finishedAt: expect.any(Number),
        status: "finished",
        exitCode: 0,
        pid: expect.any(Number),
      }),
    );
    expect(cleanupAgentRunState).toHaveBeenCalledWith({
      cwd: "/cwd",
      currentRunId: expect.any(String),
      keepManagedRuns: 1,
    });
    await attachment(
      "agent run state contract",
      JSON.stringify(
        {
          started: (writeAgentRunState as Mock).mock.calls[0][0],
          finished: (writeAgentRunState as Mock).mock.calls[1][0],
          cleanupCurrent: (cleanupAgentRunState as Mock).mock.calls[0][0],
          cleanupStale: (cleanupStaleAgentRunStates as Mock).mock.calls[0]?.[0],
        },
        null,
        2,
      ),
      "application/json",
    );
    expect(cleanupStaleAgentRunStates).toHaveBeenCalledWith({
      cwd: "/cwd",
      currentRunId: expect.any(String),
    });
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it("should disable human reports when --report off is used", async () => {
    const { AllureReportMock } = await import("../utils.js");

    await run(AgentCommand, ["agent", "--report", "off", "--", "npm", "test"]);

    expect(readRawConfig).not.toHaveBeenCalled();
    expect(AllureReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: [
          expect.objectContaining({
            id: "agent",
          }),
        ],
      }),
    );
  });

  it("should reject unsupported human report modes", async () => {
    const command = new AgentCommand();

    command.report = "html";
    command.commandToRun = ["--", "npm", "test"];

    await expect(command.execute()).rejects.toBeInstanceOf(UsageError);

    expect(readConfig).not.toHaveBeenCalled();
    expect(executeAllureRun).not.toHaveBeenCalled();
  });

  it("should use configured non-agent plugins when --report config is forced", async () => {
    const { AllureReportMock } = await import("../utils.js");
    const customPlugin = {
      id: "dashboard",
      enabled: true,
      options: {},
      plugin: {
        done: vi.fn(),
      },
    };

    (readConfig as Mock)
      .mockResolvedValueOnce({
        plugins: [
          customPlugin,
          {
            id: "agent",
            enabled: true,
            options: {},
            plugin: {},
          },
        ],
      })
      .mockResolvedValueOnce({
        output: "./allure-report",
        plugins: [
          {
            id: "agent",
            enabled: true,
            options: {
              outputDir: agentOutputDir,
            },
            plugin: { name: "agent-plugin" },
          },
        ],
      });

    await run(AgentCommand, ["agent", "--report", "config", "--", "npm", "test"]);

    expect(readConfig).toHaveBeenNthCalledWith(1, "/cwd", undefined, {
      output: agentOutputDir,
    });
    expect(AllureReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: [
          expect.objectContaining({
            id: "dashboard",
          }),
          expect.objectContaining({
            id: "agent",
          }),
        ],
      }),
    );
  });

  it("should generate the auto human report when the stored result count is at the threshold", async () => {
    const humanReport = await createAgentHumanReportConfig({
      mode: "auto",
      cwd: "/cwd",
      outputDir: agentOutputDir,
    });
    const store = {
      allTestResults: vi.fn().mockResolvedValue(Array.from({ length: 1000 }, (_, index) => ({ id: `tr-${index}` }))),
    };
    const plugin = humanReport.plugins[0].plugin;

    await plugin.start?.({} as any, store as any, {} as any);
    await plugin.done?.({} as any, store as any);

    expect(humanReport.status.status).toBe("generated");
    expect(humanReport.status.result_count).toBe(1000);
    expect(humanReport.status.path).toBe("awesome/index.html");
    expect(humanReport.status.reports).toEqual([{ plugin_id: "awesome", path: "awesome/index.html" }]);
  });

  it("should skip the auto human report when the stored result count exceeds the threshold", async () => {
    const humanReport = await createAgentHumanReportConfig({
      mode: "auto",
      cwd: "/cwd",
      outputDir: agentOutputDir,
    });
    const store = {
      allTestResults: vi.fn().mockResolvedValue(Array.from({ length: 1001 }, (_, index) => ({ id: `tr-${index}` }))),
    };
    const plugin = humanReport.plugins[0].plugin;

    await plugin.start?.({} as any, store as any, {} as any);
    await plugin.done?.({} as any, store as any);

    expect(humanReport.status.status).toBe("skipped");
    expect(humanReport.status.result_count).toBe(1001);
    expect(humanReport.status.path).toBeNull();
    expect(humanReport.status.reason).toBe("result count 1001 exceeds threshold 1000");
  });

  it("should force the awesome human report beyond the auto threshold", async () => {
    const humanReport = await createAgentHumanReportConfig({
      mode: "awesome",
      cwd: "/cwd",
      outputDir: agentOutputDir,
    });
    const store = {
      allTestResults: vi.fn().mockResolvedValue(Array.from({ length: 1001 }, (_, index) => ({ id: `tr-${index}` }))),
    };
    const plugin = humanReport.plugins[0].plugin;

    await plugin.start?.({} as any, store as any, {} as any);
    await plugin.done?.({} as any, store as any);

    expect(humanReport.status.status).toBe("generated");
    expect(humanReport.status.result_count).toBe(1001);
    expect(humanReport.status.path).toBe("awesome/index.html");
  });

  it("should force configured human reports beyond the auto threshold", async () => {
    const configuredPlugin = {
      id: "dashboard",
      enabled: true,
      options: {},
      plugin: {
        start: vi.fn(),
        done: vi.fn(),
      },
    };

    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [configuredPlugin],
    });

    const humanReport = await createAgentHumanReportConfig({
      mode: "config",
      cwd: "/cwd",
      outputDir: agentOutputDir,
    });
    const store = {
      allTestResults: vi.fn().mockResolvedValue(Array.from({ length: 1001 }, (_, index) => ({ id: `tr-${index}` }))),
    };
    const plugin = humanReport.plugins[0].plugin;

    await plugin.start?.({} as any, store as any, {} as any);
    await plugin.done?.({} as any, store as any);

    expect(configuredPlugin.plugin.done).toHaveBeenCalled();
    expect(humanReport.status.status).toBe("generated");
    expect(humanReport.status.result_count).toBe(1001);
    expect(humanReport.status.path).toBe("dashboard/");
  });

  it("should inspect repeated dump files and result directories into agent-mode output without running a command", async () => {
    const { AllureReportMock } = await import("../utils.js");
    const consoleModule = await import("node:console");
    const logMock = consoleModule.log as Mock;
    const resolvedOutput = resolve("/cwd", "./agent-from-inspect");

    vi.mocked(glob).mockResolvedValueOnce(["/cwd/allure-results-linux.zip"]);
    vi.mocked(glob).mockResolvedValueOnce(["/cwd/allure-results-macos.zip"]);
    vi.mocked(glob).mockResolvedValueOnce(["/cwd/local/allure-results/"]);

    await run(AgentInspectCommand, [
      "agent",
      "inspect",
      "--config",
      "./allurerc.inspect.mjs",
      "--output",
      "./agent-from-inspect",
      "--name",
      "Agent Inspect",
      "--open",
      "--port",
      "1234",
      "--history-limit",
      "7",
      "--hide-labels",
      "thread",
      "--hide-labels",
      "host",
      "--dump",
      "allure-results-linux.zip",
      "--dump",
      "allure-results-macos.zip",
      "./local/allure-results",
    ]);

    expect(glob).toHaveBeenNthCalledWith(1, "allure-results-linux.zip", {
      nodir: true,
      dot: true,
      absolute: true,
      windowsPathsNoEscape: true,
      cwd: "/cwd",
    });
    expect(glob).toHaveBeenNthCalledWith(2, "allure-results-macos.zip", {
      nodir: true,
      dot: true,
      absolute: true,
      windowsPathsNoEscape: true,
      cwd: "/cwd",
    });
    expect(glob).toHaveBeenNthCalledWith(3, "./local/allure-results", {
      mark: true,
      nodir: false,
      absolute: true,
      dot: true,
      windowsPathsNoEscape: true,
      cwd: "/cwd",
    });
    expect(readConfig).toHaveBeenCalledWith("/cwd", "./allurerc.inspect.mjs", {
      name: "Agent Inspect",
      output: resolvedOutput,
      open: true,
      port: "1234",
      hideLabels: ["thread", "host"],
      historyLimit: 7,
      plugins: {
        agent: {
          options: {
            outputDir: resolvedOutput,
            command:
              "allure agent inspect --dump /cwd/allure-results-linux.zip --dump /cwd/allure-results-macos.zip /cwd/local/allure-results/",
            humanReport: expect.any(Function),
          },
        },
      },
    });
    expect(AllureReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        output: resolvedOutput,
        open: false,
        port: undefined,
        qualityGate: undefined,
        allureService: undefined,
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "awesome",
          }),
          expect.objectContaining({
            id: "agent",
          }),
        ]),
      }),
    );
    expect(AllureReportMock.prototype.restoreState).toHaveBeenCalledWith([
      "/cwd/allure-results-linux.zip",
      "/cwd/allure-results-macos.zip",
    ]);
    expect(AllureReportMock.prototype.start).toHaveBeenCalledTimes(1);
    expect(AllureReportMock.prototype.readDirectory).toHaveBeenCalledWith("/cwd/local/allure-results/");
    expect(AllureReportMock.prototype.done).toHaveBeenCalledTimes(1);
    expect(executeAllureRun).not.toHaveBeenCalled();
    expect(logMock).toHaveBeenCalledWith(
      "allure agent inspect --dump /cwd/allure-results-linux.zip --dump /cwd/allure-results-macos.zip /cwd/local/allure-results/",
    );
    expect(formatAgentRunSummary).toHaveBeenCalledWith(expect.objectContaining({ outputDir: resolvedOutput }));
    expect(logMock).toHaveBeenCalledWith(`agent summary: ${resolvedOutput}`);
    expect(writeAgentRunState).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        runId: expect.any(String),
        cwd: "/cwd",
        outputDir: resolvedOutput,
        managedOutput: false,
        expectationsPath: undefined,
        command:
          "allure agent inspect --dump /cwd/allure-results-linux.zip --dump /cwd/allure-results-macos.zip /cwd/local/allure-results/",
        startedAt: expect.any(Number),
        status: "running",
        pid: expect.any(Number),
      }),
    );
    expect(writeAgentRunState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        runId: expect.any(String),
        cwd: "/cwd",
        outputDir: resolvedOutput,
        managedOutput: false,
        expectationsPath: undefined,
        command:
          "allure agent inspect --dump /cwd/allure-results-linux.zip --dump /cwd/allure-results-macos.zip /cwd/local/allure-results/",
        startedAt: expect.any(Number),
        finishedAt: expect.any(Number),
        status: "finished",
        exitCode: 0,
        pid: expect.any(Number),
      }),
    );
    expect(cleanupAgentRunState).toHaveBeenCalledWith({
      cwd: "/cwd",
      currentRunId: expect.any(String),
      keepManagedRuns: 0,
    });
    await attachment(
      "agent inspect state contract",
      JSON.stringify(
        {
          started: (writeAgentRunState as Mock).mock.calls[0][0],
          finished: (writeAgentRunState as Mock).mock.calls[1][0],
          cleanupCurrent: (cleanupAgentRunState as Mock).mock.calls[0][0],
          cleanupStale: (cleanupStaleAgentRunStates as Mock).mock.calls[0]?.[0],
        },
        null,
        2,
      ),
      "application/json",
    );
    expect(cleanupStaleAgentRunStates).toHaveBeenCalledWith({
      cwd: "/cwd",
      currentRunId: expect.any(String),
    });
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it("should fail when dump patterns match no files", async () => {
    const command = new AgentInspectCommand();

    vi.mocked(glob).mockResolvedValueOnce([]);

    command.dump = ["missing-dump.zip"];
    command.resultsDir = [];

    await expect(command.execute()).rejects.toBeInstanceOf(UsageError);

    expect(readConfig).not.toHaveBeenCalled();
    expect(executeAllureRun).not.toHaveBeenCalled();
  });

  it("should reject command separators in inspect mode", async () => {
    const command = new AgentInspectCommand();

    command.dump = ["allure-results.zip"];
    command.resultsDir = ["--", "npm", "test"];

    await expect(command.execute()).rejects.toBeInstanceOf(UsageError);

    expect(readConfig).not.toHaveBeenCalled();
    expect(executeAllureRun).not.toHaveBeenCalled();
  });

  it("should continue the run when latest-state persistence in the resolved state dir is not permitted", async () => {
    const consoleModule = await import("node:console");
    const stateDir = agentStateDir;

    (writeAgentRunState as Mock)
      .mockRejectedValueOnce(
        Object.assign(new Error(`EACCES: permission denied, mkdir '${stateDir}'`), { code: "EACCES" }),
      )
      .mockResolvedValueOnce(undefined);

    await run(AgentCommand, ["agent", "--", "npm", "test"]);

    expect(consoleModule.error).toHaveBeenCalledWith(
      `Could not update agent state in ${stateDir}: EACCES: permission denied, mkdir '${stateDir}'`,
    );
    await attachment(
      "state persistence failure contract",
      JSON.stringify(
        {
          stateDir,
          stateWriteAttempts: (writeAgentRunState as Mock).mock.calls.length,
          commandContinued: (executeAllureRun as Mock).mock.calls.length > 0,
        },
        null,
        2,
      ),
      "application/json",
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
            humanReport: expect.any(Function),
            expectationsPath: resolvedExpectations,
          },
        },
      },
    });
    expect(formatAgentRunSummary).toHaveBeenCalledWith(expect.objectContaining({ outputDir: resolvedOutput }));
    expect(consoleModule.log).toHaveBeenCalledWith(`agent summary: ${resolvedOutput}`);
  });

  it("should pass inline expectation options to plugin-agent and readConfig", async () => {
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
      outputDir: agentOutputDir,
      command: "npm test",
      error: expect.any(AgentExpectationUsageError),
    });
    expect(consoleModule.error).toHaveBeenCalledWith(
      "Use either --expectations <file> or inline expectation flags, not both",
    );
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
    expect(consoleModule.log).toHaveBeenCalledWith(`agent index: ${join(outputDir, "index.md")}`);
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
    expect(consoleModule.log).toHaveBeenCalledWith(`agent index: ${join(outputDir, "index.md")}`);
    expect(consoleModule.error).toHaveBeenCalledWith(
      "Could not load expectations from /cwd/expected.yaml: Expected a YAML or JSON object",
    );
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it("should pass ALLURE_TESTPLAN_PATH to the child process when rerun-from is enabled", async () => {
    const cleanupMock = vi.fn().mockResolvedValue(undefined);

    (createAgentTestPlanContext as Mock).mockResolvedValueOnce({
      outputDir: previousAgentOutputDir,
      preset: "review",
      selectedCount: 1,
      testPlanPath,
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
          ALLURE_TESTPLAN_PATH: testPlanPath,
        },
      }),
    );
    expect(cleanupMock).toHaveBeenCalledTimes(1);
  });

  it("should resolve rerun-latest through the shared test-plan context", async () => {
    const cleanupMock = vi.fn().mockResolvedValue(undefined);

    (createAgentTestPlanContext as Mock).mockResolvedValueOnce({
      outputDir: latestAgentOutputDir,
      preset: "review",
      selectedCount: 1,
      testPlanPath: latestTestPlanPath,
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
          ALLURE_TESTPLAN_PATH: latestTestPlanPath,
        },
      }),
    );
    expect(cleanupMock).toHaveBeenCalledTimes(1);
  });

  it("cleans up the rerun test-plan context before exiting", async () => {
    const cleanupMock = vi.fn().mockResolvedValue(undefined);

    (createAgentTestPlanContext as Mock).mockResolvedValueOnce({
      outputDir: previousAgentOutputDir,
      preset: "review",
      selectedCount: 1,
      testPlanPath,
      cleanup: cleanupMock,
    });

    await run(AgentCommand, ["agent", "--rerun-from", "./previous-agent", "--", "npm", "test"]);

    expect(cleanupMock).toHaveBeenCalledTimes(1);
    expect(exitMock).toHaveBeenCalled();
    // process.exit() skips pending finally blocks, so cleanup must run before exit().
    expect(cleanupMock.mock.invocationCallOrder[0]).toBeLessThan(exitMock.mock.invocationCallOrder[0]);
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
            humanReport: expect.any(Function),
            expectationsPath: resolvedExpectations,
          },
        },
      },
    });
  });
});
