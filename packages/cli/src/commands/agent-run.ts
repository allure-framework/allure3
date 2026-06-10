import * as console from "node:console";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process, { exit } from "node:process";

import { AllureReport, isFileNotFoundError, readConfig } from "@allurereport/core";
import {
  createAgentTestPlanContext,
  AgentUsageError,
  formatAgentOutputLinks,
  isPathInside,
  normalizeAgentRerunPreset,
  parseAgentLabelFilters,
  resolveAgentStateDir,
  writeLatestAgentState,
  type AgentExpectationsInput,
} from "@allurereport/plugin-agent";

import { normalizeCommandEnvironmentOptions, resolveCommandEnvironment } from "../utils/environment.js";
import { createChildAllureCliEnvironment, getActiveAllureCliCommand } from "../utils/execution-context.js";
import { executeAllureRun, executeNestedAllureCommand } from "./commons/run.js";

export const formatAgentCommand = (args: string[]) => args.join(" ");

export const printAgentOutputLinks = (outputDir: string) => {
  for (const line of formatAgentOutputLinks(outputDir)) {
    console.log(line);
  }
};

export const persistLatestAgentState = async (value: Parameters<typeof writeLatestAgentState>[0]) => {
  try {
    await writeLatestAgentState(value);
  } catch (error) {
    console.error(
      `Could not update latest agent output in ${resolveAgentStateDir(value.cwd)}: ${(error as Error).message}`,
    );
  }
};

export type ExecuteAgentModeParams = {
  configPath?: string;
  cwd?: string;
  output?: string;
  expectations?: string;
  inlineExpectations?: AgentExpectationsInput;
  environment?: string;
  environmentName?: string;
  silent?: boolean;
  rerunFrom?: string;
  rerunLatest?: boolean;
  rerunPreset?: string;
  rerunEnvironments?: string[];
  rerunLabels?: string[];
  args: string[];
};

export const executeAgentMode = async (params: ExecuteAgentModeParams) => {
  const {
    configPath,
    cwd: configuredCwd,
    output,
    expectations,
    inlineExpectations,
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
  const command = args[0];
  const commandArgs = args.slice(1);
  const cwd = await realpath(configuredCwd ?? process.cwd());
  const commandString = formatAgentCommand(args);
  const hasRerunSource = !!rerunFrom || !!rerunLatest;
  const hasRerunFilters = !!rerunPreset || !!rerunEnvironments?.length || !!rerunLabels?.length;

  if (!hasRerunSource && hasRerunFilters) {
    throw new AgentUsageError("Use rerun filters only together with --rerun-from <path> or --rerun-latest");
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
      throw new AgentUsageError(
        `--expectations path ${JSON.stringify(expectationsPath)} must not be inside the agent output directory ${JSON.stringify(outputDir)}`,
      );
    }

    const config = await readConfig(cwd, configPath, {
      output: outputDir,
      plugins: {
        agent: {
          options: {
            outputDir,
            command: commandString,
            ...(expectationsPath ? { expectationsPath } : {}),
            ...(inlineExpectations ? { expectations: inlineExpectations } : {}),
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

    printAgentOutputLinks(outputDir);
    if (expectationsPath) {
      console.log(`agent expectations: ${expectationsPath}`);
    } else if (inlineExpectations) {
      console.log("agent expectations: CLI options");
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

    const { globalExitCode } = await executeAllureRun({
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
    });

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
