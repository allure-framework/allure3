import * as console from "node:console";
import { randomUUID } from "node:crypto";
import { mkdtemp, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

import {
  cleanupAgentRunState,
  cleanupStaleAgentRunStates,
  formatAgentOutputLinks,
  resolveAgentStateDir,
  writeAgentRunState,
  writeInvalidAgentExpectationOutput,
  type AgentExpectationUsageError,
} from "@allurereport/plugin-agent";

export const formatAgentCommand = (args: string[]) => args.join(" ");

export const formatAgentInspectCommand = (params: { dumps?: string[]; resultsDir?: string[] }) =>
  [
    "allure",
    "agent",
    "inspect",
    ...(params.dumps ?? []).flatMap((dump) => ["--dump", dump]),
    ...(params.resultsDir ?? []),
  ].join(" ");

export const resolveAgentOutputDir = (cwd: string, output?: string) =>
  output ? resolve(cwd, output) : mkdtemp(join(tmpdir(), "allure-agent-"));

export const printAgentOutputLinks = (outputDir: string) => {
  for (const line of formatAgentOutputLinks(outputDir)) {
    console.log(line);
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

export const writeInvalidAgentExpectationRun = async (params: {
  configuredCwd?: string;
  output?: string;
  command: string;
  error: AgentExpectationUsageError;
}) => {
  const cwd = await realpath(params.configuredCwd ?? process.cwd());
  const runId = randomUUID();
  const managedOutput = !params.output;
  const outputDir = await resolveAgentOutputDir(cwd, params.output);
  const { generatedAt } = await writeInvalidAgentExpectationOutput({
    outputDir,
    command: params.command,
    error: params.error,
  });
  const generatedAtMs = Date.parse(generatedAt);
  const generatedAtTimestamp = Number.isFinite(generatedAtMs) ? generatedAtMs : Date.now();

  await persistAgentRunState({
    runId,
    cwd,
    outputDir,
    managedOutput,
    command: params.command,
    startedAt: generatedAtTimestamp,
    finishedAt: generatedAtTimestamp,
    status: "finished",
    exitCode: 1,
    pid: process.pid,
  });
  await cleanupManagedAgentOutputs({ cwd, runId, managedOutput });

  printAgentOutputLinks(outputDir);
  console.error(params.error.message);
};
