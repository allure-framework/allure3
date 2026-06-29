import { appendFile, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";

import {
  isFileNotFoundError,
  listAgentManagedTempOutputDirs,
  listAgentStatePaths,
  pathExists,
  projectStatePath,
  readPathMtimeMs,
  tryWithAgentStateLock,
  withAgentStateLock,
  writeJsonlAtomic,
} from "./utils.js";

export { ALLURE_AGENT_STATE_DIR_ENV, resolveAgentStateDir } from "./utils.js";

export type AgentRunState = {
  schema: "allure-agent-run/v1";
  runId: string;
  cwd: string;
  outputDir: string;
  managedOutput: boolean;
  expectationsPath?: string;
  command: string;
  startedAt: number;
  finishedAt?: number;
  status: "running" | "finished";
  exitCode?: number | null;
  pid?: number;
};

export type AgentLatestState = AgentRunState;

export type AgentStateCleanupResult = {
  deleted: AgentRunState[];
  failed: { state: AgentRunState; error: unknown }[];
  retained: AgentRunState[];
};

export type AgentOrphanOutputCleanupResult = {
  deleted: string[];
  failed: { outputDir: string; error: unknown }[];
  retained: string[];
};

export type AgentStaleStateCleanupResult = AgentStateCleanupResult & {
  checked: number;
  orphaned: AgentOrphanOutputCleanupResult;
  skipped: { cwd: string; statePath: string; reason: "locked" }[];
};

const AGENT_RUN_STATE_SCHEMA = "allure-agent-run/v1";
const AGENT_STALE_OUTPUT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Recently finished managed outputs are kept past the keep-newest limit so that concurrent agent
// runs in the same project do not delete output another run may still be reading.
const AGENT_MANAGED_OUTPUT_GRACE_MS = 60 * 60 * 1000;

const isAgentRunState = (value: unknown): value is AgentRunState => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<AgentRunState>;

  return (
    candidate.schema === AGENT_RUN_STATE_SCHEMA &&
    typeof candidate.runId === "string" &&
    typeof candidate.cwd === "string" &&
    typeof candidate.outputDir === "string" &&
    typeof candidate.managedOutput === "boolean" &&
    typeof candidate.command === "string" &&
    typeof candidate.startedAt === "number" &&
    Number.isSafeInteger(candidate.startedAt) &&
    (candidate.expectationsPath === undefined || typeof candidate.expectationsPath === "string") &&
    (candidate.finishedAt === undefined ||
      (typeof candidate.finishedAt === "number" && Number.isSafeInteger(candidate.finishedAt))) &&
    (candidate.status === "running" || candidate.status === "finished") &&
    (candidate.exitCode === undefined || typeof candidate.exitCode === "number" || candidate.exitCode === null) &&
    (candidate.pid === undefined || (typeof candidate.pid === "number" && Number.isSafeInteger(candidate.pid)))
  );
};

const normalizeAgentRunState = (value: Omit<AgentRunState, "schema">): AgentRunState => ({
  schema: AGENT_RUN_STATE_SCHEMA,
  runId: value.runId,
  cwd: resolve(value.cwd),
  outputDir: resolve(value.outputDir),
  managedOutput: value.managedOutput,
  expectationsPath: value.expectationsPath ? resolve(value.expectationsPath) : undefined,
  command: value.command,
  startedAt: value.startedAt,
  finishedAt: value.finishedAt,
  status: value.status,
  exitCode: value.exitCode,
  pid: value.pid,
});

const readAgentRunStateFile = async (statePath: string, cwd?: string): Promise<AgentRunState[]> => {
  const normalizedCwd = cwd === undefined ? undefined : resolve(cwd);
  let raw: string;

  try {
    raw = await readFile(statePath, "utf-8");
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return [];
    }

    throw error;
  }

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as unknown;

        if (!isAgentRunState(parsed)) {
          return [];
        }

        return normalizedCwd === undefined || parsed.cwd === normalizedCwd ? [parsed] : [];
      } catch {
        return [];
      }
    });
};

const readAgentRunStateLines = async (cwd: string): Promise<AgentRunState[]> => {
  const normalizedCwd = resolve(cwd);

  return readAgentRunStateFile(projectStatePath(normalizedCwd), normalizedCwd);
};

const foldAgentRunStates = (states: AgentRunState[]): AgentRunState[] => {
  const order: string[] = [];
  const latestByRunId = new Map<string, AgentRunState>();

  for (const state of states) {
    if (!latestByRunId.has(state.runId)) {
      order.push(state.runId);
    }

    latestByRunId.set(state.runId, state);
  }

  return order
    .map((runId) => latestByRunId.get(runId))
    .filter((state): state is AgentRunState => state !== undefined)
    .sort((a, b) => a.startedAt - b.startedAt || (a.finishedAt ?? a.startedAt) - (b.finishedAt ?? b.startedAt));
};

const getAgentRunStateAgeTimestamp = (state: AgentRunState) => state.finishedAt ?? state.startedAt;

const isProcessAlive = (pid: number) => {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    // ESRCH means the process is gone; EPERM means it exists but we may not signal it.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

// A run is active only while its process is still alive. A crashed run keeps status "running"
// forever (it never writes finishedAt), so we must check liveness, not just status, to avoid
// either deleting a live run's output or leaking a crashed run's output.
const isAgentRunActive = (state: AgentRunState) =>
  state.status === "running" && state.pid !== undefined && isProcessAlive(state.pid);

const isManagedOutputStale = (state: AgentRunState, now: number, staleOutputTtlMs: number) =>
  state.managedOutput &&
  !isAgentRunActive(state) &&
  now - getAgentRunStateAgeTimestamp(state) >= staleOutputTtlMs;

const isAgentOutputDirectory = async (outputDir: string) =>
  (await pathExists(join(outputDir, "manifest", "run.json"))) || (await pathExists(join(outputDir, "index.md")));

const cleanupStaleAgentRunState = async (params: {
  cwd: string;
  now: number;
  staleOutputTtlMs: number;
}): Promise<AgentStateCleanupResult> => {
  const states = foldAgentRunStates(await readAgentRunStateLines(params.cwd));
  const retained: AgentRunState[] = [];
  const deleted: AgentRunState[] = [];
  const failed: AgentStateCleanupResult["failed"] = [];

  for (const state of states) {
    if (!(await pathExists(state.outputDir))) {
      continue;
    }

    if (!isManagedOutputStale(state, params.now, params.staleOutputTtlMs)) {
      retained.push(state);
      continue;
    }

    try {
      await rm(state.outputDir, { recursive: true, force: true });
      deleted.push(state);
    } catch (error) {
      retained.push(state);
      failed.push({ state, error });
    }
  }

  await writeJsonlAtomic(projectStatePath(params.cwd), retained);

  return {
    deleted,
    failed,
    retained,
  };
};

const cleanupStaleOrphanAgentOutputs = async (params: {
  referencedOutputDirs: Set<string>;
  now: number;
  staleOutputTtlMs: number;
}): Promise<AgentOrphanOutputCleanupResult> => {
  const outputDirs = await listAgentManagedTempOutputDirs();
  const deleted: string[] = [];
  const failed: AgentOrphanOutputCleanupResult["failed"] = [];
  const retained: string[] = [];

  for (const outputDir of outputDirs) {
    const normalizedOutputDir = resolve(outputDir);

    if (params.referencedOutputDirs.has(normalizedOutputDir)) {
      retained.push(normalizedOutputDir);
      continue;
    }

    let mtimeMs: number;

    try {
      mtimeMs = await readPathMtimeMs(normalizedOutputDir);
    } catch (error) {
      if (!isFileNotFoundError(error)) {
        failed.push({ outputDir: normalizedOutputDir, error });
      }

      continue;
    }

    if (params.now - mtimeMs < params.staleOutputTtlMs) {
      retained.push(normalizedOutputDir);
      continue;
    }

    if (!(await isAgentOutputDirectory(normalizedOutputDir))) {
      retained.push(normalizedOutputDir);
      continue;
    }

    try {
      await rm(normalizedOutputDir, { recursive: true, force: true });
      deleted.push(normalizedOutputDir);
    } catch (error) {
      failed.push({ outputDir: normalizedOutputDir, error });
    }
  }

  return {
    deleted,
    failed,
    retained,
  };
};

export const writeAgentRunState = async (value: Omit<AgentRunState, "schema">): Promise<AgentRunState> => {
  const normalizedState = normalizeAgentRunState(value);

  await withAgentStateLock(normalizedState.cwd, async () => {
    await appendFile(projectStatePath(normalizedState.cwd), `${JSON.stringify(normalizedState)}\n`, "utf-8");
  });

  return normalizedState;
};

export const writeLatestAgentState = writeAgentRunState;

export const readAgentRunStates = async (cwd: string): Promise<AgentRunState[]> =>
  foldAgentRunStates(await readAgentRunStateLines(cwd));

export const readLatestAgentState = async (cwd: string): Promise<AgentLatestState | undefined> => {
  const states = await readAgentRunStates(cwd);

  for (let i = states.length - 1; i >= 0; i -= 1) {
    const state = states[i];

    if (await pathExists(state.outputDir)) {
      return state;
    }
  }

  return undefined;
};

export const cleanupAgentRunState = async (params: {
  cwd: string;
  currentRunId?: string;
  keepManagedRuns?: number;
  managedOutputGraceMs?: number;
  now?: number;
}): Promise<AgentStateCleanupResult> =>
  withAgentStateLock(params.cwd, async () => {
    const keepManagedRuns = Math.max(0, params.keepManagedRuns ?? 1);
    const managedOutputGraceMs = Math.max(0, params.managedOutputGraceMs ?? AGENT_MANAGED_OUTPUT_GRACE_MS);
    const now = params.now ?? Date.now();
    const states = foldAgentRunStates(await readAgentRunStateLines(params.cwd));
    const existing: AgentRunState[] = [];

    for (const state of states) {
      if (await pathExists(state.outputDir)) {
        existing.push(state);
      }
    }

    const retainedManagedRunIds = new Set(
      existing
        .filter((state) => state.managedOutput && state.status === "finished")
        .sort((a, b) => (b.finishedAt ?? b.startedAt) - (a.finishedAt ?? a.startedAt) || b.startedAt - a.startedAt)
        .slice(0, keepManagedRuns)
        .map((state) => state.runId),
    );

    if (params.currentRunId) {
      retainedManagedRunIds.add(params.currentRunId);
    }

    const deleted: AgentRunState[] = [];
    const failed: AgentStateCleanupResult["failed"] = [];

    for (const state of existing) {
      if (!state.managedOutput || state.status !== "finished" || retainedManagedRunIds.has(state.runId)) {
        continue;
      }

      // Keep recently finished managed outputs so a concurrent run does not delete output that
      // another agent run in the same project may still be reading.
      if (now - (state.finishedAt ?? state.startedAt) <= managedOutputGraceMs) {
        continue;
      }

      try {
        await rm(state.outputDir, { recursive: true, force: true });
        deleted.push(state);
      } catch (error) {
        failed.push({ state, error });
      }
    }

    const deletedRunIds = new Set(deleted.map((state) => state.runId));
    const retained = existing.filter((state) => !deletedRunIds.has(state.runId));

    await writeJsonlAtomic(projectStatePath(params.cwd), retained);

    return {
      deleted,
      failed,
      retained,
    };
  });

export const cleanupStaleAgentRunStates = async (params: {
  cwd: string;
  currentRunId?: string;
  staleOutputTtlMs?: number;
  now?: number;
}): Promise<AgentStaleStateCleanupResult> => {
  const currentCwd = resolve(params.cwd);
  const currentStatePath = projectStatePath(currentCwd);
  const statePaths = await listAgentStatePaths(currentCwd);
  const staleOutputTtlMs = Math.max(0, params.staleOutputTtlMs ?? AGENT_STALE_OUTPUT_TTL_MS);
  const now = params.now ?? Date.now();
  const staleCwds = new Map<string, string>();
  const referencedOutputDirs = new Set<string>();

  for (const statePath of statePaths) {
    const states = foldAgentRunStates(await readAgentRunStateFile(statePath));

    for (const state of states) {
      referencedOutputDirs.add(resolve(state.outputDir));

      if (statePath === currentStatePath) {
        continue;
      }

      if (state.cwd === currentCwd || state.runId === params.currentRunId) {
        continue;
      }

      if (!(await pathExists(state.outputDir)) || isManagedOutputStale(state, now, staleOutputTtlMs)) {
        staleCwds.set(state.cwd, statePath);
        break;
      }
    }
  }

  const deleted: AgentRunState[] = [];
  const failed: AgentStaleStateCleanupResult["failed"] = [];
  const retained: AgentRunState[] = [];
  const skipped: AgentStaleStateCleanupResult["skipped"] = [];

  for (const [cwd, statePath] of staleCwds) {
    const lockResult = await tryWithAgentStateLock(cwd, () =>
      cleanupStaleAgentRunState({
        cwd,
        now,
        staleOutputTtlMs,
      }),
    );

    if (!lockResult.acquired) {
      skipped.push({ cwd, statePath, reason: "locked" });
      continue;
    }

    deleted.push(...lockResult.result.deleted);
    failed.push(...lockResult.result.failed);
    retained.push(...lockResult.result.retained);
  }

  const orphaned = await cleanupStaleOrphanAgentOutputs({
    referencedOutputDirs,
    now,
    staleOutputTtlMs,
  });

  return {
    checked: statePaths.length,
    deleted,
    failed,
    orphaned,
    retained,
    skipped,
  };
};
