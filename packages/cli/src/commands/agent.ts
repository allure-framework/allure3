import * as console from "node:console";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import process, { exit } from "node:process";

import { AllureReport, isFileNotFoundError, readConfig } from "@allurereport/core";
import { Command, Option, UsageError } from "clipanion";

import {
  createAgentTestPlanContext,
  normalizeAgentRerunPreset,
  parseAgentLabelFilters,
  resolveAgentSelectionOutputDir,
  selectAgentTestPlan,
} from "../utils/agent-select.js";
import { readLatestAgentState, resolveAgentStateDir, writeLatestAgentState } from "../utils/agent-state.js";
import {
  environmentNameOption,
  environmentOption,
  normalizeCommandEnvironmentOptions,
  resolveCommandEnvironment,
} from "../utils/environment.js";
import { createChildAllureCliEnvironment, getActiveAllureCliCommand } from "../utils/execution-context.js";
import { executeAllureRun, executeNestedAllureCommand } from "./commons/run.js";

const withProcessEnv = async <T>(overrides: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> => {
  const previousValues = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(overrides)) {
    previousValues.set(key, process.env[key]);

    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previousValues) {
      if (value === undefined) {
        delete process.env[key];
        continue;
      }

      process.env[key] = value;
    }
  }
};

const isPathInside = (parentPath: string, candidatePath: string) => {
  const rel = relative(parentPath, candidatePath);

  return rel === "" || (!rel.startsWith("..") && rel !== "." && !rel.startsWith("../"));
};

const persistLatestAgentState = async (value: Parameters<typeof writeLatestAgentState>[0]) => {
  try {
    await writeLatestAgentState(value);
  } catch (error) {
    console.error(
      `Could not update latest agent output in ${resolveAgentStateDir(value.cwd)}: ${(error as Error).message}`,
    );
  }
};

const readOptionalString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

const readOptionalBoolean = (value: unknown): boolean => value === true;

const readOptionalStringArray = (value: unknown): string[] | undefined => (Array.isArray(value) ? value : undefined);

export class AgentCommand extends Command {
  static paths = [["agent"]];

  static usage = Command.Usage({
    description: "Run specified command in Allure agent mode",
    details: "This command runs the specified command with an agent-only Allure profile.",
    examples: [
      ["agent -- npm test", "Run npm test and capture only the agent-mode output"],
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
    description: "The output directory for agent artifacts. Absolute paths are accepted as well",
  });

  expectations = Option.String("--expectations", {
    description: "The path to a YAML or JSON expectations file",
  });

  environment = environmentOption();

  environmentName = environmentNameOption();

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
    const args = this.commandToRun.filter((arg) => arg !== "--") as string[] | undefined;

    await executeAgentMode({
      configPath: readOptionalString(this.config),
      cwd: readOptionalString(this.cwd),
      output: readOptionalString(this.output),
      expectations: readOptionalString(this.expectations),
      environment: readOptionalString(this.environment),
      environmentName: readOptionalString(this.environmentName),
      silent: readOptionalBoolean(this.silent),
      rerunFrom: readOptionalString(this.rerunFrom),
      rerunLatest: readOptionalBoolean(this.rerunLatest),
      rerunPreset: readOptionalString(this.rerunPreset),
      rerunEnvironments: readOptionalStringArray(this.rerunEnvironments),
      rerunLabels: readOptionalStringArray(this.rerunLabels),
      args,
    });
  }
}

export class AgentLatestCommand extends Command {
  static paths = [["agent", "latest"]];

  static usage = Command.Usage({
    description: "Print the latest Allure agent output directory for the current project",
    details: "This command prints the latest agent output directory recorded for the resolved project cwd.",
    examples: [
      ["agent latest", "Print the latest agent output directory for the current project"],
      ["agent latest --cwd ./packages/cli", "Print the latest agent output directory for a specific project cwd"],
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

    console.log(latestState.outputDir);
  }
}

export class AgentStateDirCommand extends Command {
  static paths = [["agent", "state-dir"]];

  static usage = Command.Usage({
    description: "Print the Allure agent state directory for the current project",
    details:
      "This command prints the resolved state directory used to persist latest-agent pointers for the current project cwd.",
    examples: [
      ["agent state-dir", "Print the resolved state directory for the current project"],
      ["agent state-dir --cwd ./packages/cli", "Print the resolved state directory for a specific project cwd"],
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

export class AgentSelectCommand extends Command {
  static paths = [["agent", "select"]];

  static usage = Command.Usage({
    description: "Select tests from an existing agent output and emit a test plan",
    details:
      "This command resolves a set of tests from a prior agent run and prints or writes a testplan.json payload.",
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
    console.log(outputPath);
  }
}

export const executeAgentMode = async (params: {
  configPath?: string;
  cwd?: string;
  output?: string;
  expectations?: string;
  environment?: string;
  environmentName?: string;
  silent?: boolean;
  rerunFrom?: string;
  rerunLatest?: boolean;
  rerunPreset?: string;
  rerunEnvironments?: string[];
  rerunLabels?: string[];
  args?: string[];
}) => {
  const {
    configPath,
    cwd: configuredCwd,
    output,
    expectations,
    environment,
    environmentName,
    silent,
    rerunFrom,
    rerunLatest,
    rerunPreset,
    rerunEnvironments,
    rerunLabels,
    args,
  } = params;

  if (!args || !args.length) {
    throw new UsageError("expecting command to be specified after --, e.g. allure agent -- npm run test");
  }

  const command = args[0];
  const commandArgs = args.slice(1);
  const cwd = await realpath(configuredCwd ?? process.cwd());
  const commandString = `${command} ${commandArgs.join(" ")}`;
  const hasRerunSource = !!rerunFrom || !!rerunLatest;
  const hasRerunFilters = !!rerunPreset || !!rerunEnvironments?.length || !!rerunLabels?.length;

  if (!hasRerunSource && hasRerunFilters) {
    throw new UsageError("Use rerun filters only together with --rerun-from <path> or --rerun-latest");
  }

  const rerunContext = await createAgentTestPlanContext({
    cwd,
    from: rerunFrom,
    latest: rerunLatest,
    preset: normalizeAgentRerunPreset(rerunPreset),
    environments: rerunEnvironments?.length ? rerunEnvironments : undefined,
    labelFilters: parseAgentLabelFilters(rerunLabels),
  });
  const childEnvironmentVariables = {
    ...createChildAllureCliEnvironment("agent"),
    ...(rerunContext ? { ALLURE_TESTPLAN_PATH: rerunContext.testPlanPath } : {}),
  };

  try {
    if (getActiveAllureCliCommand()) {
      console.log(commandString);

      const exitCode = await executeNestedAllureCommand({
        command,
        commandArgs,
        cwd,
        ...(rerunContext ? { environmentVariables: { ALLURE_TESTPLAN_PATH: rerunContext.testPlanPath } } : {}),
        silent,
      });

      exit(exitCode ?? -1);
      return;
    }

    const outputDir = output ? resolve(cwd, output) : await mkdtemp(join(tmpdir(), "allure-agent-"));
    const expectationsPath = expectations ? resolve(cwd, expectations) : undefined;
    const environmentOptions = {
      environment,
      environmentName,
    };

    normalizeCommandEnvironmentOptions(environmentOptions);

    if (expectationsPath && isPathInside(outputDir, expectationsPath)) {
      throw new UsageError(
        `--expectations path ${JSON.stringify(expectationsPath)} must not be inside the agent output directory ${JSON.stringify(outputDir)}`,
      );
    }

    const config = await readConfig(cwd, configPath, {
      output: outputDir,
      plugins: {
        agent: {
          options: {
            outputDir,
          },
        },
      },
    });
    const resolvedEnvironment = resolveCommandEnvironment(config, environmentOptions);

    try {
      await rm(outputDir, { recursive: true });
    } catch (error) {
      if (!isFileNotFoundError(error)) {
        console.error("could not clean output directory", error);
      }
    }

    const startedAt = new Date().toISOString();

    await persistLatestAgentState({
      cwd,
      outputDir,
      expectationsPath,
      command: commandString,
      startedAt,
      status: "running",
    });

    console.log(`agent output: ${outputDir}`);
    if (expectationsPath) {
      console.log(`agent expectations: ${expectationsPath}`);
    }
    console.log(commandString);

    const allureReport = new AllureReport({
      ...config,
      output: outputDir,
      environment: resolvedEnvironment?.id,
      open: false,
      port: undefined,
      qualityGate: undefined,
      allureService: undefined,
      realTime: false,
      plugins: config.plugins,
    });
    const knownIssues = await allureReport.store.allKnownIssues();

    const { globalExitCode } = await withProcessEnv(
      {
        ALLURE_AGENT_OUTPUT: outputDir,
        ALLURE_AGENT_EXPECTATIONS: expectationsPath,
        ALLURE_AGENT_COMMAND: commandString,
        ALLURE_AGENT_PROJECT_ROOT: cwd,
        ALLURE_AGENT_NAME: undefined,
        ALLURE_AGENT_LOOP_ID: undefined,
        ALLURE_AGENT_TASK_ID: undefined,
        ALLURE_AGENT_CONVERSATION_ID: undefined,
      },
      async () =>
        await executeAllureRun({
          allureReport,
          knownIssues,
          cwd,
          command,
          commandArgs,
          environmentVariables: childEnvironmentVariables,
          environment: resolvedEnvironment?.id,
          withQualityGate: false,
          logs: "pipe",
          silent,
          ignoreLogs: false,
          logProcessExit: false,
        }),
    );

    await persistLatestAgentState({
      cwd,
      outputDir,
      expectationsPath,
      command: commandString,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: "finished",
      exitCode: globalExitCode.actual ?? globalExitCode.original,
    });

    exit(globalExitCode.actual ?? globalExitCode.original);
  } finally {
    await rerunContext?.cleanup();
  }
};
