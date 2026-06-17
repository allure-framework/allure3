import * as console from "node:console";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process, { exit } from "node:process";

import {
  AGENT_FINDING_CATEGORIES,
  AGENT_FINDING_SEVERITIES,
  AGENT_TASK_MAP_HELP,
  AGENT_TEST_STATUSES,
  AgentExpectationUsageError,
  buildAgentInlineExpectations,
  buildAgentQueryPayload,
  cleanupAgentRunState,
  cleanupStaleAgentRunStates,
  createAgentCapabilities,
  formatAgentOutputLinks,
  isAgentExpectationUsageError,
  isAgentTaskMapHelpRequest,
  isAgentUsageError,
  loadAgentOutput,
  normalizeAgentQueryLimit,
  normalizeAgentQueryView,
  normalizeAgentRerunPreset,
  normalizeRepeatedEnumValues,
  normalizeRepeatedStringValues,
  parseAgentLabelFilters,
  readLatestAgentState,
  resolveAgentSelectionOutputDir,
  resolveAgentStateDir,
  selectAgentTestPlan,
  validateAgentExpectationsFile,
  writeAgentRunState,
  writeInvalidAgentExpectationOutput,
  type AgentExpectationsInput,
  type AgentHumanReportMode,
} from "@allurereport/plugin-agent";
import { Command, Option, UsageError } from "clipanion";

export { AGENT_TASK_MAP_HELP, createAgentCapabilities, isAgentTaskMapHelpRequest };

const readOptionalString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

const readOptionalBoolean = (value: unknown): boolean => value === true;

const readOptionalStringArray = (value: unknown): string[] | undefined => (Array.isArray(value) ? value : undefined);

const formatAgentCommand = (args: string[]) => args.join(" ");
const AGENT_HUMAN_REPORT_MODES = ["auto", "off", "awesome", "config"] as const;

const formatAgentInspectCommand = (params: { dumps?: string[]; resultsDir?: string[] }) =>
  [
    "allure",
    "agent",
    "inspect",
    ...(params.dumps ?? []).flatMap((dump) => ["--dump", dump]),
    ...(params.resultsDir ?? []),
  ].join(" ");

type AgentExpectationOptionSource = {
  goal?: string[];
  taskId?: string[];
  expectTests?: string[];
  expectLabels?: string[];
  expectEnvironments?: string[];
  expectFullNames?: string[];
  expectPrefixes?: string[];
  forbidLabels?: string[];
  expectStepContains?: string[];
  expectSteps?: string[];
  expectAttachments?: string[];
  expectAttachmentFilters?: string[];
};

const buildInlineExpectationsFromOptions = (options: AgentExpectationOptionSource) =>
  buildAgentInlineExpectations({
    goal: options.goal,
    taskId: options.taskId,
    expectTests: options.expectTests,
    expectLabels: readOptionalStringArray(options.expectLabels),
    expectEnvironments: readOptionalStringArray(options.expectEnvironments),
    expectFullNames: readOptionalStringArray(options.expectFullNames),
    expectPrefixes: readOptionalStringArray(options.expectPrefixes),
    forbidLabels: readOptionalStringArray(options.forbidLabels),
    expectStepContains: readOptionalStringArray(options.expectStepContains),
    expectSteps: options.expectSteps,
    expectAttachments: options.expectAttachments,
    expectAttachmentFilters: readOptionalStringArray(options.expectAttachmentFilters),
  });

const printAgentOutputLinks = (outputDir: string) => {
  for (const line of formatAgentOutputLinks(outputDir)) {
    console.log(line);
  }
};

const persistAgentRunState = async (value: Parameters<typeof writeAgentRunState>[0]) => {
  try {
    await writeAgentRunState(value);
  } catch (error) {
    console.error(`Could not update agent state in ${resolveAgentStateDir(value.cwd)}: ${(error as Error).message}`);
  }
};

const logAgentCleanupFailures = (failures: { state: { outputDir: string }; error: unknown }[]) => {
  for (const failure of failures) {
    console.error(`Could not clean stale agent output ${failure.state.outputDir}: ${(failure.error as Error).message}`);
  }
};

const logAgentOrphanCleanupFailures = (failures: { outputDir: string; error: unknown }[]) => {
  for (const failure of failures) {
    console.error(`Could not clean stale agent output ${failure.outputDir}: ${(failure.error as Error).message}`);
  }
};

const cleanupManagedAgentOutputs = async (params: { cwd: string; runId: string; managedOutput: boolean }) => {
  try {
    const result = await cleanupAgentRunState({
      cwd: params.cwd,
      currentRunId: params.runId,
      keepManagedRuns: params.managedOutput ? 1 : 0,
    });

    logAgentCleanupFailures(result.failed);
  } catch (error) {
    console.error(`Could not clean agent state in ${resolveAgentStateDir(params.cwd)}: ${(error as Error).message}`);
  }

  try {
    const staleResult = await cleanupStaleAgentRunStates({
      cwd: params.cwd,
      currentRunId: params.runId,
    });

    logAgentCleanupFailures(staleResult.failed);
    logAgentOrphanCleanupFailures(staleResult.orphaned.failed);
  } catch (error) {
    console.error(`Could not clean agent state in ${resolveAgentStateDir(params.cwd)}: ${(error as Error).message}`);
  }
};

const agentEnvironmentOption = () =>
  Option.String("--environment,--env", {
    description:
      "Force specific environment ID to all tests in the run. Given environment has higher priority than the one defined in the config file (default: empty string)",
  });

const agentEnvironmentNameOption = () =>
  Option.String("--environment-name", {
    description:
      "Force specific environment display name to all tests in the run. Has lower priority than --environment and higher than the config value (default: empty string)",
  });

const throwCliUsageError = (error: unknown): never => {
  if (isAgentUsageError(error)) {
    throw new UsageError((error as Error).message);
  }

  throw error;
};

const normalizeAgentHumanReportMode = (value: string | undefined): AgentHumanReportMode => {
  if (value === undefined) {
    return "auto";
  }

  if ((AGENT_HUMAN_REPORT_MODES as readonly string[]).includes(value)) {
    return value as AgentHumanReportMode;
  }

  throw new UsageError(`Unsupported --report mode ${JSON.stringify(value)}. Use auto, off, awesome, or config.`);
};

export class AgentCapabilitiesCommand extends Command {
  static paths = [["agent", "capabilities"]];

  static usage = Command.Usage({
    description: "Print structured Allure agent capability information",
    details:
      "This command prints the locally supported agent-mode commands, expectation controls, output files, rerun support, and known unsupported capability families as JSON.",
    examples: [
      ["agent capabilities", "Print agent capabilities as JSON"],
      ["agent capabilities --json", "Print agent capabilities as JSON explicitly"],
    ],
  });

  json = Option.Boolean("--json", true, {
    description: "Print capabilities as JSON (default: true)",
  });

  async execute() {
    console.log(JSON.stringify(createAgentCapabilities(), null, 2));
  }
}

export class AgentCommand extends Command {
  static paths = [["agent"]];

  static usage = Command.Usage({
    description: "Run specified command in Allure agent mode",
    details:
      "This command runs the specified command with an agent-mode Allure profile and optional human-readable report output. With the default --report auto mode, runs with 1000 or fewer stored visible logical results also write a single-file Awesome report at <output>/awesome/index.html and record its status in <output>/manifest/human-report.json. If a user asks for the report after a run, use `allure agent latest` to recover the output directory and check the human-report manifest before regenerating anything.",
    examples: [
      ["agent -- npm test", "Run npm test and capture agent-mode output with the default human report policy"],
      ["agent --report off -- npm test", "Run npm test and capture only the agent-mode artifacts"],
      [
        "agent --expectations ./expected.yaml -- npm test",
        "Run npm test with agent-mode expectations loaded from ./expected.yaml",
      ],
    ],
  });

  config = Option.String("--config,-c", {
    description: "The path Allure config file",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  output = Option.String("--output,-o", {
    description:
      "The output directory for agent artifacts. Absolute paths are accepted. Explicit output is caller-managed; remove or archive it when no longer needed so later state compaction can drop its record",
  });

  report = Option.String("--report", {
    description:
      "Human report mode: auto, off, awesome, or config. Auto writes awesome/index.html for 1000 or fewer stored visible results and records manifest/human-report.json (default: auto)",
  });

  expectations = Option.String("--expectations", {
    description: "The path to a YAML or JSON expectations file",
  });

  goal = Option.Array("--goal", {
    description: "The review goal to record in inline agent expectations",
  });

  taskId = Option.Array("--task-id", {
    description: "The task or feature id to record in inline agent expectations",
  });

  expectTests = Option.Array("--expect-tests", {
    description: "The expected number of visible logical tests in the intended scope",
  });

  expectLabels = Option.Array("--expect-label", {
    description: "Expected label selector in name=value form. Repeat the option for multiple selectors",
  });

  expectEnvironments = Option.Array("--expect-env", {
    description: "Expected environment id. Repeat the option for multiple environments",
  });

  expectFullNames = Option.Array("--expect-test", {
    description: "Expected full test name. Repeat the option for multiple tests",
  });

  expectPrefixes = Option.Array("--expect-prefix", {
    description: "Expected full-name prefix. Repeat the option for multiple prefixes",
  });

  forbidLabels = Option.Array("--forbid-label", {
    description: "Forbidden label selector in name=value form. Repeat the option for multiple selectors",
  });

  expectStepContains = Option.Array("--expect-step-containing", {
    description: "Require a test-scoped step name containing this text per evidence-target logical test",
  });

  expectSteps = Option.Array("--expect-steps", {
    description: "Require at least this many meaningful steps per expected logical test",
  });

  expectAttachments = Option.Array("--expect-attachments", {
    description: "Require at least this many non-missing attachments per expected logical test",
  });

  expectAttachmentFilters = Option.Array("--expect-attachment", {
    description:
      "Require a matching non-missing attachment per expected logical test. Use a file name or name=value/content-type=value",
  });

  environment = agentEnvironmentOption();

  environmentName = agentEnvironmentNameOption();

  silent = Option.Boolean("--silent", {
    description: "Don't pipe the process output logs to console (default: false)",
  });

  rerunFrom = Option.String("--rerun-from", {
    description: "Select tests for rerun from an existing agent output directory",
  });

  rerunLatest = Option.Boolean("--rerun-latest", {
    description: "Select tests for rerun from the latest recorded agent output for the current project",
  });

  rerunPreset = Option.String("--rerun-preset", {
    description: "The rerun selection preset: review, failed, unsuccessful, or all (default: review)",
  });

  rerunEnvironments = Option.Array("--rerun-environment", {
    description: "Filter rerun selection by environment id. Repeat the option for multiple environments",
  });

  rerunLabels = Option.Array("--rerun-label", {
    description: "Filter rerun selection by exact label name=value. Repeat the option for multiple filters",
  });

  commandToRun = Option.Rest();

  async execute() {
    const args = this.commandToRun.filter((arg) => arg !== "--") as string[];
    const configPath = readOptionalString(this.config);
    const configuredCwd = readOptionalString(this.cwd);
    const output = readOptionalString(this.output);
    const reportMode = normalizeAgentHumanReportMode(readOptionalString(this.report));
    const expectations = readOptionalString(this.expectations);

    if (!args.length) {
      throw new UsageError("expecting command to be specified after --, e.g. allure agent -- npm run test");
    }

    try {
      const inlineExpectations = buildInlineExpectationsFromOptions({
        goal: this.goal,
        taskId: this.taskId,
        expectTests: this.expectTests,
        expectLabels: this.expectLabels,
        expectEnvironments: this.expectEnvironments,
        expectFullNames: this.expectFullNames,
        expectPrefixes: this.expectPrefixes,
        forbidLabels: this.forbidLabels,
        expectStepContains: this.expectStepContains,
        expectSteps: this.expectSteps,
        expectAttachments: this.expectAttachments,
        expectAttachmentFilters: this.expectAttachmentFilters,
      });

      if (expectations && inlineExpectations) {
        throw new AgentExpectationUsageError(
          "Use either --expectations <file> or inline expectation flags, not both",
          "--expectations",
        );
      }

      await validateAgentExpectationsFile({
        cwd: await realpath(configuredCwd ?? process.cwd()),
        output,
        expectations,
      });

      const { executeAgentMode } = await import("./agent-run.js");

      await executeAgentMode({
        configPath,
        cwd: configuredCwd,
        output,
        expectations,
        inlineExpectations: inlineExpectations as AgentExpectationsInput | undefined,
        environment: readOptionalString(this.environment),
        environmentName: readOptionalString(this.environmentName),
        silent: readOptionalBoolean(this.silent),
        rerunFrom: readOptionalString(this.rerunFrom),
        rerunLatest: readOptionalBoolean(this.rerunLatest),
        rerunPreset: readOptionalString(this.rerunPreset),
        rerunEnvironments: readOptionalStringArray(this.rerunEnvironments),
        rerunLabels: readOptionalStringArray(this.rerunLabels),
        reportMode,
        args,
      });
    } catch (error) {
      if (!isAgentExpectationUsageError(error)) {
        throwCliUsageError(error);
      }

      const expectationError = error as AgentExpectationUsageError;
      const cwd = await realpath(configuredCwd ?? process.cwd());
      const runId = randomUUID();
      const managedOutput = !output;
      const outputDir = output ? resolve(cwd, output) : await mkdtemp(join(tmpdir(), "allure-agent-"));
      const commandString = formatAgentCommand(args);
      const { generatedAt } = await writeInvalidAgentExpectationOutput({
        outputDir,
        command: commandString,
        error: expectationError,
      });
      const generatedAtMs = Date.parse(generatedAt);
      const generatedAtTimestamp = Number.isFinite(generatedAtMs) ? generatedAtMs : Date.now();

      await persistAgentRunState({
        runId,
        cwd,
        outputDir,
        managedOutput,
        command: commandString,
        startedAt: generatedAtTimestamp,
        finishedAt: generatedAtTimestamp,
        status: "finished",
        exitCode: 1,
        pid: process.pid,
      });
      await cleanupManagedAgentOutputs({ cwd, runId, managedOutput });

      printAgentOutputLinks(outputDir);
      console.error(expectationError.message);
      exit(1);
    }
  }
}

export class AgentInspectCommand extends Command {
  static paths = [["agent", "inspect"]];

  static usage = Command.Usage({
    description: "Inspect existing Allure results or dump archives in Allure agent mode",
    details:
      "This command restores dump archives and reads existing Allure results directories, then writes agent-mode output and optional human-readable report output without running a test command. With the default --report auto mode, inputs with 1000 or fewer stored visible logical results also write a single-file Awesome report at <output>/awesome/index.html and record its status in <output>/manifest/human-report.json. If a user asks for the report after an inspect run, use `allure agent latest` to recover the output directory and check the human-report manifest before regenerating anything.",
    examples: [
      ["agent inspect ./allure-results", "Inspect an existing Allure results directory"],
      ["agent inspect ./packages/*/out/allure-results", "Inspect matching Allure results directories"],
      ["agent inspect --dump allure-results-linux.zip", "Inspect a dump archive downloaded from CI"],
      [
        "agent inspect --dump allure-results-linux.zip --dump allure-results-macos.zip",
        "Inspect multiple CI dump archives together",
      ],
      [
        "agent inspect --dump allure-results-linux.zip ./local/allure-results",
        "Inspect dump archives together with local results directories",
      ],
      [
        "agent inspect --config ./allurerc.mjs --output ./agent-output ./allure-results",
        "Inspect existing results with a config file and write agent artifacts to ./agent-output",
      ],
    ],
  });

  resultsDir = Option.Rest({
    name: "Patterns to match test results directories in the current working directory (default: ./**/allure-results)",
  });

  config = Option.String("--config,-c", {
    description: "The path Allure config file",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for resolving results and dumps (default: current working directory)",
  });

  output = Option.String("--output,-o", {
    description:
      "The output directory for agent artifacts. Absolute paths are accepted. Explicit output is caller-managed; remove or archive it when no longer needed so later state compaction can drop its record",
  });

  report = Option.String("--report", {
    description:
      "Human report mode: auto, off, awesome, or config. Auto writes awesome/index.html for 1000 or fewer stored visible results and records manifest/human-report.json (default: auto)",
  });

  reportName = Option.String("--report-name,--name", {
    description: "The report name to pass through configuration defaults (default: Allure Report)",
  });

  dump = Option.Array("--dump", {
    description:
      "Path or pattern that matches one or more archives created by `allure run --dump ...`. " +
      "This option can be specified multiple times.",
  });

  open = Option.Boolean("--open", {
    description: "Accepted for parity with generate. Agent inspect writes agent artifacts and prints their paths",
  });

  port = Option.String("--port", {
    description: "Accepted for parity with generate. Agent inspect doesn't serve the output",
  });

  historyLimit = Option.String("--history-limit", {
    description: "Limits the number of history entries to keep (default: unlimited)",
  });

  hideLabels = Option.Array("--hide-labels", {
    description: "Hide labels by exact name in generated data. Repeat the option for multiple labels",
  });

  expectations = Option.String("--expectations", {
    description: "The path to a YAML or JSON expectations file",
  });

  goal = Option.Array("--goal", {
    description: "The review goal to record in inline agent expectations",
  });

  taskId = Option.Array("--task-id", {
    description: "The task or feature id to record in inline agent expectations",
  });

  expectTests = Option.Array("--expect-tests", {
    description: "The expected number of visible logical tests in the intended scope",
  });

  expectLabels = Option.Array("--expect-label", {
    description: "Expected label selector in name=value form. Repeat the option for multiple selectors",
  });

  expectEnvironments = Option.Array("--expect-env", {
    description: "Expected environment id. Repeat the option for multiple environments",
  });

  expectFullNames = Option.Array("--expect-test", {
    description: "Expected full test name. Repeat the option for multiple tests",
  });

  expectPrefixes = Option.Array("--expect-prefix", {
    description: "Expected full-name prefix. Repeat the option for multiple prefixes",
  });

  forbidLabels = Option.Array("--forbid-label", {
    description: "Forbidden label selector in name=value form. Repeat the option for multiple selectors",
  });

  expectStepContains = Option.Array("--expect-step-containing", {
    description: "Require a test-scoped step name containing this text per evidence-target logical test",
  });

  expectSteps = Option.Array("--expect-steps", {
    description: "Require at least this many meaningful steps per expected logical test",
  });

  expectAttachments = Option.Array("--expect-attachments", {
    description: "Require at least this many non-missing attachments per expected logical test",
  });

  expectAttachmentFilters = Option.Array("--expect-attachment", {
    description:
      "Require a matching non-missing attachment per expected logical test. Use a file name or name=value/content-type=value",
  });

  environment = agentEnvironmentOption();

  environmentName = agentEnvironmentNameOption();

  async execute() {
    const configPath = readOptionalString(this.config);
    const configuredCwd = readOptionalString(this.cwd);
    const output = readOptionalString(this.output);
    const reportMode = normalizeAgentHumanReportMode(readOptionalString(this.report));
    const dumps = readOptionalStringArray(this.dump) ?? [];
    const resultsDir = this.resultsDir as string[];
    const expectations = readOptionalString(this.expectations);

    if (resultsDir.includes("--")) {
      throw new UsageError(
        "agent inspect does not run commands; pass result directories directly, e.g. allure agent inspect ./allure-results",
      );
    }

    try {
      const inlineExpectations = buildInlineExpectationsFromOptions({
        goal: this.goal,
        taskId: this.taskId,
        expectTests: this.expectTests,
        expectLabels: this.expectLabels,
        expectEnvironments: this.expectEnvironments,
        expectFullNames: this.expectFullNames,
        expectPrefixes: this.expectPrefixes,
        forbidLabels: this.forbidLabels,
        expectStepContains: this.expectStepContains,
        expectSteps: this.expectSteps,
        expectAttachments: this.expectAttachments,
        expectAttachmentFilters: this.expectAttachmentFilters,
      });

      if (expectations && inlineExpectations) {
        throw new AgentExpectationUsageError(
          "Use either --expectations <file> or inline expectation flags, not both",
          "--expectations",
        );
      }

      await validateAgentExpectationsFile({
        cwd: await realpath(configuredCwd ?? process.cwd()),
        output,
        expectations,
      });

      const { executeAgentInspectMode } = await import("./agent-run.js");

      await executeAgentInspectMode({
        configPath,
        cwd: configuredCwd,
        output,
        expectations,
        inlineExpectations: inlineExpectations as AgentExpectationsInput | undefined,
        environment: readOptionalString(this.environment),
        environmentName: readOptionalString(this.environmentName),
        reportName: readOptionalString(this.reportName),
        open: readOptionalBoolean(this.open),
        port: readOptionalString(this.port),
        historyLimit: readOptionalString(this.historyLimit),
        hideLabels: readOptionalStringArray(this.hideLabels),
        dumps,
        reportMode,
        resultsDir,
      });
    } catch (error) {
      if (!isAgentExpectationUsageError(error)) {
        throwCliUsageError(error);
      }

      const expectationError = error as AgentExpectationUsageError;
      const cwd = await realpath(configuredCwd ?? process.cwd());
      const runId = randomUUID();
      const managedOutput = !output;
      const outputDir = output ? resolve(cwd, output) : await mkdtemp(join(tmpdir(), "allure-agent-"));
      const commandString = formatAgentInspectCommand({ dumps, resultsDir });
      const { generatedAt } = await writeInvalidAgentExpectationOutput({
        outputDir,
        command: commandString,
        error: expectationError,
      });
      const generatedAtMs = Date.parse(generatedAt);
      const generatedAtTimestamp = Number.isFinite(generatedAtMs) ? generatedAtMs : Date.now();

      await persistAgentRunState({
        runId,
        cwd,
        outputDir,
        managedOutput,
        command: commandString,
        startedAt: generatedAtTimestamp,
        finishedAt: generatedAtTimestamp,
        status: "finished",
        exitCode: 1,
        pid: process.pid,
      });
      await cleanupManagedAgentOutputs({ cwd, runId, managedOutput });

      printAgentOutputLinks(outputDir);
      console.error(expectationError.message);
      exit(1);
    }
  }
}

export class AgentLatestCommand extends Command {
  static paths = [["agent", "latest"]];

  static usage = Command.Usage({
    description: "Print the latest Allure agent output directory and index path for the current project",
    details:
      "This command prints the latest agent output directory and index.md path recorded for the resolved project cwd. When a user asks for a human-readable report from the last run, use this output directory to check manifest/human-report.json; if its status is generated, the report path is relative to that same output directory, usually awesome/index.html.",
    examples: [
      ["agent latest", "Print the latest agent output directory and index path for the current project"],
      [
        "agent latest --cwd ./packages/cli",
        "Print the latest agent output directory and index path for a specific project cwd",
      ],
    ],
  });

  cwd = Option.String("--cwd", {
    description: "The project directory used to resolve the latest agent output (default: current working directory)",
  });

  async execute() {
    const cwd = await realpath(this.cwd ?? process.cwd());
    let latestState;

    try {
      latestState = await readLatestAgentState(cwd);
    } catch (error) {
      console.error(`Could not read the latest agent output for ${cwd}: ${(error as Error).message}`);
      exit(1);
      return;
    }

    if (!latestState) {
      console.error(`No latest agent output found for ${cwd}`);
      exit(1);
      return;
    }

    printAgentOutputLinks(latestState.outputDir);
  }
}

export class AgentStateDirCommand extends Command {
  static paths = [["agent", "state-dir"]];

  static usage = Command.Usage({
    description: "Print the shared Allure agent state directory",
    details: "This command prints the resolved state directory used to persist per-project agent run registries.",
    examples: [
      ["agent state-dir", "Print the resolved shared state directory"],
      ["agent state-dir --cwd ./packages/cli", "Print the shared state directory using a specific project cwd"],
    ],
  });

  cwd = Option.String("--cwd", {
    description: "The project directory used to resolve the agent state directory (default: current working directory)",
  });

  async execute() {
    const cwd = await realpath(readOptionalString(this.cwd) ?? process.cwd());

    console.log(resolveAgentStateDir(cwd));
  }
}

export class AgentQueryCommand extends Command {
  static paths = [["agent", "query"]];

  static usage = Command.Usage({
    description: "Query an existing Allure agent output directory as focused JSON",
    details:
      "This command reads a prior agent output directory and prints focused JSON for a run summary, test list, findings list, or one test. Use --latest to query the latest recorded output for the project, or --from to query a specific output directory.",
    examples: [
      ["agent query --latest summary", "Print a summary for the latest agent output"],
      ["agent query --from ./out/agent-output tests --status failed", "List failed tests from a prior output"],
      [
        "agent query --from ./out/agent-output findings --severity high",
        "List high-severity findings from a prior output",
      ],
      [
        'agent query --latest test --test "suite should pass" --include-markdown',
        "Print one test summary with its per-test markdown",
      ],
    ],
  });

  view = Option.String({
    required: false,
    name: "Query view: summary, tests, findings, or test (default: summary)",
  });

  cwd = Option.String("--cwd", {
    description:
      "The project directory used to resolve --latest and relative paths (default: current working directory)",
  });

  from = Option.String("--from", {
    description: "The prior agent output directory to query",
  });

  latest = Option.Boolean("--latest", {
    description: "Use the latest recorded agent output for the current project cwd",
  });

  statuses = Option.Array("--status", {
    description: "Filter tests by status: failed, broken, unknown, skipped, or passed. Repeat for multiple statuses",
  });

  environments = Option.Array("--environment", {
    description: "Filter tests by environment id. Repeat the option for multiple environments",
  });

  labels = Option.Array("--label", {
    description: "Filter tests by exact label name=value. Repeat the option for multiple filters",
  });

  severities = Option.Array("--severity", {
    description: "Filter findings by severity: high, warning, or info. Repeat for multiple severities",
  });

  categories = Option.Array("--category", {
    description: "Filter findings by category. Repeat the option for multiple categories",
  });

  checks = Option.Array("--check", {
    description: "Filter findings by check name. Repeat the option for multiple checks",
  });

  test = Option.String("--test", {
    description: "Filter to one test by full name, test result id, history id, or markdown path",
  });

  limit = Option.String("--limit", {
    description: "Limit returned tests or findings to this non-negative count",
  });

  includeMarkdown = Option.Boolean("--include-markdown", {
    description: "Include the per-test markdown content for the test view",
  });

  async execute() {
    try {
      const cwd = await realpath(readOptionalString(this.cwd) ?? process.cwd());
      const view = normalizeAgentQueryView(readOptionalString(this.view));
      const outputDir = await resolveAgentSelectionOutputDir({
        cwd,
        from: readOptionalString(this.from),
        latest: readOptionalBoolean(this.latest),
      });
      const output = await loadAgentOutput(outputDir);
      const payload = await buildAgentQueryPayload(output, view, {
        environments: normalizeRepeatedStringValues(readOptionalStringArray(this.environments)),
        labelFilters: parseAgentLabelFilters(readOptionalStringArray(this.labels)),
        statuses: normalizeRepeatedEnumValues(readOptionalStringArray(this.statuses), AGENT_TEST_STATUSES, "--status"),
        severities: normalizeRepeatedEnumValues(
          readOptionalStringArray(this.severities),
          AGENT_FINDING_SEVERITIES,
          "--severity",
        ),
        categories: normalizeRepeatedEnumValues(
          readOptionalStringArray(this.categories),
          AGENT_FINDING_CATEGORIES,
          "--category",
        ),
        checks: normalizeRepeatedStringValues(readOptionalStringArray(this.checks)),
        test: readOptionalString(this.test),
        limit: normalizeAgentQueryLimit(readOptionalString(this.limit)),
        includeMarkdown: readOptionalBoolean(this.includeMarkdown),
      });

      console.log(JSON.stringify(payload, null, 2));
    } catch (error) {
      throwCliUsageError(error);
    }
  }
}

export class AgentSelectCommand extends Command {
  static paths = [["agent", "select"]];

  static usage = Command.Usage({
    description: "Select tests from an existing agent output and emit a test plan",
    details:
      "This command resolves a set of tests from a prior agent run and prints or writes a testplan.json payload. When --output is used, stdout contains the written test plan path, source output directory, preset, and selected test count.",
    examples: [
      ["agent select --from ./out/agent-output", "Print a test plan for the default review-targeted tests"],
      ["agent select --latest --preset failed", "Print a test plan for failed tests from the latest project run"],
      ["agent select --from ./out/agent-output --output ./testplan.json", "Write the selected test plan to a file"],
    ],
  });

  cwd = Option.String("--cwd", {
    description:
      "The project directory used to resolve --latest and relative paths (default: current working directory)",
  });

  from = Option.String("--from", {
    description: "The prior agent output directory to select tests from",
  });

  latest = Option.Boolean("--latest", {
    description: "Use the latest recorded agent output for the current project cwd",
  });

  preset = Option.String("--preset", {
    description: "The selection preset: review, failed, unsuccessful, or all (default: review)",
  });

  environments = Option.Array("--environment", {
    description: "Filter selected tests by environment id. Repeat the option for multiple environments",
  });

  labels = Option.Array("--label", {
    description: "Filter selected tests by exact label name=value. Repeat the option for multiple filters",
  });

  output = Option.String("--output,-o", {
    description: "Write the resulting test plan to this file instead of printing it to stdout",
  });

  async execute() {
    try {
      const cwd = await realpath(readOptionalString(this.cwd) ?? process.cwd());
      const environments = readOptionalStringArray(this.environments);
      const labels = readOptionalStringArray(this.labels);
      const outputDir = await resolveAgentSelectionOutputDir({
        cwd,
        from: readOptionalString(this.from),
        latest: readOptionalBoolean(this.latest),
      });
      const selection = await selectAgentTestPlan({
        outputDir,
        preset: normalizeAgentRerunPreset(readOptionalString(this.preset)),
        environments: environments?.length ? environments : undefined,
        labelFilters: parseAgentLabelFilters(labels),
      });

      if (!selection.testPlan.tests.length) {
        console.error(`No tests matched selection in ${selection.outputDir}`);
        exit(1);
        return;
      }

      const serialized = `${JSON.stringify(selection.testPlan, null, 2)}\n`;
      const output = readOptionalString(this.output);

      if (!output) {
        console.log(serialized.trimEnd());
        return;
      }

      const outputPath = resolve(cwd, output);

      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, serialized, "utf-8");
      console.log(`agent testplan: ${outputPath}`);
      console.log(`agent selection source: ${selection.outputDir}`);
      console.log(`agent selection preset: ${selection.preset}`);
      console.log(`agent selection tests: ${selection.selectedTests.length}`);
    } catch (error) {
      throwCliUsageError(error);
    }
  }
}
