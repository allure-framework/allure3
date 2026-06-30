import * as console from "node:console";
import { randomUUID } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process, { exit } from "node:process";

import { AllureReport, isFileNotFoundError, readConfig } from "@allurereport/core";
import {
  createAgentTestPlanContext,
  AgentUsageError,
  assertExplicitAgentOutputDirIsSafe,
  formatAgentOutputLinks,
  formatAgentRunSummary,
  isPathInside,
  loadAgentOutput,
  normalizeAgentRerunPreset,
  parseAgentLabelFilters,
  cleanupAgentRunState,
  cleanupStaleAgentRunStates,
  resolveAgentStateDir,
  writeAgentRunState,
  type AgentExpectationsInput,
  type AgentHumanReportMode,
} from "@allurereport/plugin-agent";

import { normalizeCommandEnvironmentOptions, resolveCommandEnvironment } from "../utils/environment.js";
import { createChildAllureCliEnvironment, getActiveAllureCliCommand } from "../utils/execution-context.js";
import { findAllureResultDirectories, findFilesByGlobs } from "../utils/fileSystem.js";
import { createAgentHumanReportConfig } from "./agent-human-report.js";
import { executeAllureRun, executeNestedAllureCommand } from "./commons/run.js";

export const formatAgentCommand = (args: string[]) => args.join(" ");

export const formatAgentInspectCommand = (params: { dumps?: string[]; resultsDir?: string[] }) =>
  [
    "allure",
    "agent",
    "inspect",
    ...(params.dumps ?? []).flatMap((dump) => ["--dump", dump]),
    ...(params.resultsDir ?? []),
  ].join(" ");

export const printAgentOutputLinks = (outputDir: string) => {
  for (const line of formatAgentOutputLinks(outputDir)) {
    console.log(line);
  }
};

/**
 * Before an agent run starts, print where the output goes and how to watch it. The agent plugin
 * appends manifest/test-events.jsonl per test and rewrites index.md live, so an agent can inspect
 * progress mid-run without waiting for the final summary.
 */
export const printAgentRunStart = (outputDir: string, commandString: string) => {
  console.log(`agent output: ${outputDir}`);
  console.log(commandString);
  console.log(
    "live: read manifest/test-events.jsonl (appended per test) in that directory to watch progress before the run finishes",
  );
};

/**
 * After an agent run, print a compact summary (status, links, and what to read where) instead of the
 * test command's own console output, which is captured into the agent output rather than echoed.
 */
export const printAgentRunSummary = async (
  outputDir: string,
  options: { durationMs?: number; rerunCommand?: string } = {},
) => {
  try {
    const bundle = await loadAgentOutput(outputDir);

    const summary = formatAgentRunSummary({
      outputDir,
      run: bundle.run,
      humanReport: bundle.humanReport,
      durationMs: options.durationMs,
      rerunCommand: options.rerunCommand,
    });

    for (const line of summary) {
      console.log(line);
    }
  } catch {
    // Best effort: fall back to the basic output links if the summary cannot be built.
    printAgentOutputLinks(outputDir);
  }
};

export const persistAgentRunState = async (value: Parameters<typeof writeAgentRunState>[0]) => {
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

export const cleanupManagedAgentOutputs = async (params: { cwd: string; runId: string; managedOutput: boolean }) => {
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
  reportMode: AgentHumanReportMode;
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
    reportMode,
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

  let resolvedExitCode = -1;
  let runCompleted = false;

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

      resolvedExitCode = exitCode ?? -1;
      runCompleted = true;

      return;
    }

    const runId = randomUUID();
    const managedOutput = !output;
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

    if (!managedOutput) {
      await assertExplicitAgentOutputDirIsSafe(outputDir);
    }

    const humanReport = await createAgentHumanReportConfig({
      mode: reportMode,
      cwd,
      configPath,
      outputDir,
    });
    const config = await readConfig(cwd, configPath, {
      output: outputDir,
      plugins: {
        agent: {
          options: {
            outputDir,
            command: commandString,
            humanReport: humanReport.statusProvider,
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

    const startedAt = Date.now();

    await persistAgentRunState({
      runId,
      cwd,
      outputDir,
      managedOutput,
      expectationsPath,
      command: commandString,
      startedAt,
      status: "running",
      pid: process.pid,
    });

    printAgentRunStart(outputDir, commandString);

    const allureReport = new AllureReport({
      ...config,
      output: outputDir,
      environment: resolvedEnvironment?.id,
      open: false,
      port: undefined,
      qualityGate: undefined,
      allureService: undefined,
      realTime: false,
      plugins: [...humanReport.plugins, ...(config.plugins ?? [])],
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
      // Capture the test command's output into the agent artifacts instead of echoing it to the
      // terminal; the post-run summary points at the captured logs.
      silent: true,
      ignoreLogs: false,
      logProcessExit: false,
    });

    await persistAgentRunState({
      runId,
      cwd,
      outputDir,
      managedOutput,
      expectationsPath,
      command: commandString,
      startedAt,
      finishedAt: Date.now(),
      status: "finished",
      exitCode: globalExitCode.actual ?? globalExitCode.original,
      pid: process.pid,
    });
    await cleanupManagedAgentOutputs({ cwd, runId, managedOutput });
    await printAgentRunSummary(outputDir, { durationMs: Date.now() - startedAt, rerunCommand: commandString });

    resolvedExitCode = globalExitCode.actual ?? globalExitCode.original;
    runCompleted = true;
  } finally {
    await rerunContext?.cleanup();

    // Defer exit() until after cleanup: process.exit() skips pending finally blocks, so calling it
    // inside the try would leak the rerun test-plan temp dir. On the error path runCompleted stays
    // false, so the original error propagates instead of being masked by an exit.
    if (runCompleted) {
      exit(resolvedExitCode);
    }
  }
};

export type ExecuteAgentInspectModeParams = {
  configPath?: string;
  cwd?: string;
  output?: string;
  expectations?: string;
  inlineExpectations?: AgentExpectationsInput;
  environment?: string;
  environmentName?: string;
  reportName?: string;
  open?: boolean;
  port?: string;
  historyLimit?: string;
  hideLabels?: string[];
  dumps?: string[];
  reportMode: AgentHumanReportMode;
  resultsDir: string[];
};

export const executeAgentInspectMode = async (params: ExecuteAgentInspectModeParams) => {
  const {
    configPath,
    cwd: configuredCwd,
    output,
    expectations,
    inlineExpectations,
    environment,
    environmentName,
    reportName,
    open,
    port,
    historyLimit,
    hideLabels,
    dumps = [],
    reportMode,
    resultsDir,
  } = params;
  const cwd = await realpath(configuredCwd ?? process.cwd());
  const dumpFiles = dumps.length ? await findFilesByGlobs(cwd, dumps) : [];
  const shouldReadResults = resultsDir.length > 0 || dumps.length === 0;
  const { resultDirectories = [], patterns = resultsDir } = shouldReadResults
    ? await findAllureResultDirectories(cwd, resultsDir)
    : {};

  if (dumps.length > 0 && dumpFiles.length === 0) {
    throw new AgentUsageError(`No dump files found matching pattern: ${dumps.join(", ")}`);
  }

  if (resultDirectories.length === 0 && dumpFiles.length === 0) {
    const inspectedPatterns = [...(patterns ?? []), ...dumps];

    throw new AgentUsageError(`No test results directories or dump files found matching pattern: ${inspectedPatterns}`);
  }

  const runId = randomUUID();
  const managedOutput = !output;
  const outputDir = output ? resolve(cwd, output) : await mkdtemp(join(tmpdir(), "allure-agent-"));
  const expectationsPath = expectations ? resolve(cwd, expectations) : undefined;
  const commandString = formatAgentInspectCommand({ dumps: dumpFiles, resultsDir: resultDirectories });
  const hiddenLabels = hideLabels?.length ? hideLabels : undefined;
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

  if (!managedOutput) {
    await assertExplicitAgentOutputDirIsSafe(outputDir);
  }

  const historyLimitValue = historyLimit ? parseInt(historyLimit, 10) : undefined;
  const humanReport = await createAgentHumanReportConfig({
    mode: reportMode,
    cwd,
    configPath,
    outputDir,
    configOverride: {
      name: reportName,
      open,
      port,
      hideLabels: hiddenLabels,
      historyLimit: historyLimitValue,
    },
  });
  const config = await readConfig(cwd, configPath, {
    name: reportName,
    output: outputDir,
    open,
    port,
    hideLabels: hiddenLabels,
    historyLimit: historyLimitValue,
    plugins: {
      agent: {
        options: {
          outputDir,
          command: commandString,
          humanReport: humanReport.statusProvider,
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

  const startedAt = Date.now();

  await persistAgentRunState({
    runId,
    cwd,
    outputDir,
    managedOutput,
    expectationsPath,
    command: commandString,
    startedAt,
    status: "running",
    pid: process.pid,
  });

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
    plugins: [...humanReport.plugins, ...(config.plugins ?? [])],
  });

  await allureReport.restoreState(Array.from(dumpFiles));
  await allureReport.start();

  for (const dir of resultDirectories) {
    await allureReport.readDirectory(dir);
  }

  await allureReport.done();

  await persistAgentRunState({
    runId,
    cwd,
    outputDir,
    managedOutput,
    expectationsPath,
    command: commandString,
    startedAt,
    finishedAt: Date.now(),
    status: "finished",
    exitCode: 0,
    pid: process.pid,
  });
  await cleanupManagedAgentOutputs({ cwd, runId, managedOutput });
  await printAgentRunSummary(outputDir, { durationMs: Date.now() - startedAt });

  exit(0);
};
