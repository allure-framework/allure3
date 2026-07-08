import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

import { epic, feature, label, story } from "allure-js-commons";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ALLURE_AGENT_STATE_DIR_ENV,
  cleanupAgentRunState,
  cleanupStaleAgentRunStates,
  readLatestAgentState,
  resolveAgentStateDir,
  writeAgentRunState,
} from "../src/state.js";
import { attachJsonEvidence } from "./evidence.js";

const { lockHandle } = vi.hoisted(() => ({
  lockHandle: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  },
}));

const testTmpRoot = tmpdir();
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal()),
  appendFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  open: vi.fn().mockResolvedValue(lockHandle),
  readdir: vi.fn().mockResolvedValue([]),
  readFile: vi.fn(),
  rename: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ mtimeMs: Date.now() }),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(async () => {
  await epic("coverage");
  await feature("agent-state");
  await story("agent-state");
  await label("coverage", "agent-state");
  vi.clearAllMocks();
  const fsModule = await import("node:fs/promises");

  (fsModule.appendFile as Mock).mockResolvedValue(undefined);
  (fsModule.mkdir as Mock).mockResolvedValue(undefined);
  (fsModule.open as Mock).mockResolvedValue(lockHandle);
  (fsModule.readdir as Mock).mockResolvedValue([]);
  (fsModule.readFile as Mock).mockReset();
  (fsModule.rename as Mock).mockResolvedValue(undefined);
  (fsModule.rm as Mock).mockResolvedValue(undefined);
  (fsModule.stat as Mock).mockResolvedValue({ mtimeMs: Date.now() });
  (fsModule.writeFile as Mock).mockResolvedValue(undefined);
  lockHandle.writeFile.mockClear();
  lockHandle.close.mockClear();
  delete process.env[ALLURE_AGENT_STATE_DIR_ENV];
});

const repoStatePath = (cwd: string) => {
  const normalizedCwd = resolve(cwd);
  const projectHash = createHash("sha256").update(normalizedCwd).digest("hex").slice(0, 16);

  return join(testTmpRoot, "allure-agent-state", `${projectHash}.jsonl`);
};

const repoLockPath = (cwd: string) => {
  const normalizedCwd = resolve(cwd);
  const projectHash = createHash("sha256").update(normalizedCwd).digest("hex").slice(0, 16);

  return join(testTmpRoot, "allure-agent-state", `${projectHash}.lock`);
};

const tempOutputPath = (name: string) => join(testTmpRoot, name);

const repoStateEntry = (cwd: string) => ({
  name: basename(repoStatePath(cwd)),
  isFile: () => true,
});

const tempOutputEntry = (name: string) => ({
  name,
  isDirectory: () => true,
});

describe("agent-state utils", () => {
  it("should append run state under the shared temp state dir for each project cwd", async () => {
    const fsModule = await import("node:fs/promises");
    const cwd = "/repo";
    const normalizedCwd = resolve(cwd);
    const statePath = repoStatePath(cwd);
    const latestState = {
      runId: "run-1",
      cwd,
      outputDir: tempOutputPath("allure-agent-123"),
      managedOutput: true,
      command: "npm test",
      startedAt: 1776276000000,
      status: "running" as const,
      pid: 42,
    };

    await writeAgentRunState(latestState);

    await attachJsonEvidence("run state append contract", {
      normalizedCwd,
      statePath,
      latestState,
    });

    expect(fsModule.mkdir).toHaveBeenCalledWith(dirname(statePath), { recursive: true });
    expect(fsModule.open).toHaveBeenCalledWith(repoLockPath(cwd), "wx");
    expect(fsModule.appendFile).toHaveBeenCalledWith(
      statePath,
      expect.stringContaining('"schema":"allure-agent-run/v1"'),
      "utf-8",
    );
    expect(fsModule.appendFile).toHaveBeenCalledWith(
      statePath,
      expect.stringContaining('"startedAt":1776276000000'),
      "utf-8",
    );
  });

  it("should resolve an explicit global state dir override from the environment", () => {
    process.env[ALLURE_AGENT_STATE_DIR_ENV] = "/custom-agent-state";

    expect(resolveAgentStateDir("/repo")).toBe(resolve("/custom-agent-state"));
  });

  it("should return undefined when no latest state exists for the project", async () => {
    const fsModule = await import("node:fs/promises");

    (fsModule.readFile as Mock).mockRejectedValueOnce(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

    await expect(readLatestAgentState("/repo")).resolves.toBeUndefined();
  });

  it("should read the newest usable run from the per-repo JSONL state", async () => {
    const fsModule = await import("node:fs/promises");
    const cwd = resolve("/repo");
    const oldState = {
      schema: "allure-agent-run/v1",
      runId: "old",
      cwd,
      outputDir: tempOutputPath("allure-agent-old"),
      managedOutput: true,
      command: "npm test old",
      startedAt: 1776276000000,
      status: "finished",
      finishedAt: 1776276001000,
      exitCode: 0,
    };
    const latestState = {
      schema: "allure-agent-run/v1",
      runId: "latest",
      cwd,
      outputDir: tempOutputPath("allure-agent-latest"),
      managedOutput: true,
      command: "npm test latest",
      startedAt: 1776277000000,
      status: "finished",
      finishedAt: 1776277001000,
      exitCode: 0,
    };

    (fsModule.readFile as Mock).mockResolvedValueOnce(
      `${JSON.stringify(oldState)}\nnot json\n${JSON.stringify(latestState)}\n`,
    );

    await expect(readLatestAgentState("/repo")).resolves.toEqual(latestState);
  });

  it("should prune old managed finished outputs and compact removed records out of state", async () => {
    const fsModule = await import("node:fs/promises");
    const cwd = resolve("/repo");
    const statePath = repoStatePath(cwd);
    const oldManaged = {
      schema: "allure-agent-run/v1",
      runId: "old-managed",
      cwd,
      outputDir: tempOutputPath("allure-agent-old"),
      managedOutput: true,
      command: "npm test old",
      startedAt: 1776276000000,
      status: "finished",
      finishedAt: 1776276001000,
      exitCode: 0,
    };
    const currentManaged = {
      schema: "allure-agent-run/v1",
      runId: "current-managed",
      cwd,
      outputDir: tempOutputPath("allure-agent-current"),
      managedOutput: true,
      command: "npm test current",
      startedAt: 1776277000000,
      status: "finished",
      finishedAt: 1776277001000,
      exitCode: 0,
    };
    const explicitOutput = {
      schema: "allure-agent-run/v1",
      runId: "explicit",
      cwd,
      outputDir: "/repo/agent-output",
      managedOutput: false,
      command: "npm test explicit",
      startedAt: 1776278000000,
      status: "finished",
      finishedAt: 1776278001000,
      exitCode: 0,
    };

    (fsModule.readFile as Mock).mockResolvedValueOnce(
      [oldManaged, currentManaged, explicitOutput].map((state) => JSON.stringify(state)).join("\n") + "\n",
    );

    const result = await cleanupAgentRunState({
      cwd,
      currentRunId: "current-managed",
      keepManagedRuns: 1,
    });

    await attachJsonEvidence("cleanup compaction contract", {
      deletedOutput: oldManaged.outputDir,
      retainedOutputs: [currentManaged.outputDir, explicitOutput.outputDir],
      compactedStatePath: statePath,
    });

    expect(result.deleted).toEqual([oldManaged]);
    expect(result.retained).toEqual([currentManaged, explicitOutput]);
    expect(fsModule.rm).toHaveBeenCalledWith(oldManaged.outputDir, { recursive: true, force: true });
    expect(fsModule.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/\.tmp$/),
      `${JSON.stringify(currentManaged)}\n${JSON.stringify(explicitOutput)}\n`,
      "utf-8",
    );
    expect(fsModule.rename).toHaveBeenCalledWith(expect.stringMatching(/\.tmp$/), statePath);
  });

  it("should keep recently finished managed outputs so concurrent runs do not delete them", async () => {
    const fsModule = await import("node:fs/promises");
    const cwd = resolve("/repo");
    const now = 1778000000000;
    const oldSibling = {
      schema: "allure-agent-run/v1",
      runId: "old-sibling",
      cwd,
      outputDir: tempOutputPath("allure-agent-old-sibling"),
      managedOutput: true,
      command: "npm test old",
      startedAt: now - 2 * 60 * 60 * 1000 - 1000,
      status: "finished",
      finishedAt: now - 2 * 60 * 60 * 1000,
      exitCode: 0,
    };
    const recentSibling = {
      schema: "allure-agent-run/v1",
      runId: "recent-sibling",
      cwd,
      outputDir: tempOutputPath("allure-agent-recent-sibling"),
      managedOutput: true,
      command: "npm test recent",
      startedAt: now - 70_000,
      status: "finished",
      finishedAt: now - 60_000,
      exitCode: 0,
    };
    const currentRun = {
      schema: "allure-agent-run/v1",
      runId: "current",
      cwd,
      outputDir: tempOutputPath("allure-agent-current"),
      managedOutput: true,
      command: "npm test current",
      startedAt: now - 10_000,
      status: "finished",
      finishedAt: now,
      exitCode: 0,
    };

    (fsModule.readFile as Mock).mockResolvedValueOnce(
      [oldSibling, recentSibling, currentRun].map((state) => JSON.stringify(state)).join("\n") + "\n",
    );

    const result = await cleanupAgentRunState({
      cwd,
      currentRunId: "current",
      keepManagedRuns: 1,
      managedOutputGraceMs: 60 * 60 * 1000,
      now,
    });

    // Only the sibling finished beyond the grace window is removed; the recently finished sibling and
    // the current run survive so concurrent agents can still read their output.
    expect(result.deleted).toEqual([oldSibling]);
    expect(result.retained).toEqual([recentSibling, currentRun]);
    expect(fsModule.rm).toHaveBeenCalledWith(oldSibling.outputDir, { recursive: true, force: true });
    expect(fsModule.rm).not.toHaveBeenCalledWith(recentSibling.outputDir, { recursive: true, force: true });
  });

  it("should remove all managed finished outputs when retention is zero", async () => {
    const fsModule = await import("node:fs/promises");
    const cwd = resolve("/repo");
    const managedOutput = {
      schema: "allure-agent-run/v1",
      runId: "managed",
      cwd,
      outputDir: tempOutputPath("allure-agent-managed"),
      managedOutput: true,
      command: "npm test managed",
      startedAt: 1776276000000,
      status: "finished",
      finishedAt: 1776276001000,
      exitCode: 0,
    };
    const explicitOutput = {
      schema: "allure-agent-run/v1",
      runId: "explicit",
      cwd,
      outputDir: "/repo/agent-output",
      managedOutput: false,
      command: "npm test explicit",
      startedAt: 1776277000000,
      status: "finished",
      finishedAt: 1776277001000,
      exitCode: 0,
    };

    (fsModule.readFile as Mock).mockResolvedValueOnce(
      [managedOutput, explicitOutput].map((state) => JSON.stringify(state)).join("\n") + "\n",
    );

    const result = await cleanupAgentRunState({
      cwd,
      currentRunId: "explicit",
      keepManagedRuns: 0,
    });

    await attachJsonEvidence("explicit output cleanup contract", {
      deletedOutput: managedOutput.outputDir,
      retainedOutput: explicitOutput.outputDir,
    });

    expect(result.deleted).toEqual([managedOutput]);
    expect(result.retained).toEqual([explicitOutput]);
    expect(fsModule.rm).toHaveBeenCalledWith(managedOutput.outputDir, { recursive: true, force: true });
  });

  it("should cleanup stale managed outputs from other repo registries one by one", async () => {
    const fsModule = await import("node:fs/promises");
    const cwd = resolve("/repo");
    const otherCwd = resolve("/old-repo");
    const otherStatePath = repoStatePath(otherCwd);
    const currentManaged = {
      schema: "allure-agent-run/v1",
      runId: "current-managed",
      cwd,
      outputDir: tempOutputPath("allure-agent-current"),
      managedOutput: true,
      command: "npm test current",
      startedAt: 1777999999000,
      status: "finished",
      finishedAt: 1777999999000,
      exitCode: 0,
    };
    const staleManaged = {
      schema: "allure-agent-run/v1",
      runId: "stale-managed",
      cwd: otherCwd,
      outputDir: tempOutputPath("allure-agent-stale"),
      managedOutput: true,
      command: "npm test stale",
      startedAt: 1776276000000,
      status: "finished",
      finishedAt: 1776276001000,
      exitCode: 0,
    };
    const explicitOutput = {
      schema: "allure-agent-run/v1",
      runId: "explicit",
      cwd: otherCwd,
      outputDir: "/old-repo/agent-output",
      managedOutput: false,
      command: "npm test explicit",
      startedAt: 1776277000000,
      status: "finished",
      finishedAt: 1776277001000,
      exitCode: 0,
    };
    const now = 1778000000000;

    (fsModule.readdir as Mock).mockResolvedValueOnce([repoStateEntry(cwd), repoStateEntry(otherCwd)]);
    (fsModule.readFile as Mock)
      .mockResolvedValueOnce(`${JSON.stringify(currentManaged)}\n`)
      .mockResolvedValueOnce([staleManaged, explicitOutput].map((state) => JSON.stringify(state)).join("\n") + "\n")
      .mockResolvedValueOnce([staleManaged, explicitOutput].map((state) => JSON.stringify(state)).join("\n") + "\n");

    const result = await cleanupStaleAgentRunStates({
      cwd,
      now,
      staleOutputTtlMs: 1,
    });

    await attachJsonEvidence("global stale cleanup contract", {
      checked: result.checked,
      deletedOutput: staleManaged.outputDir,
      retainedOutput: explicitOutput.outputDir,
      compactedStatePath: otherStatePath,
    });

    expect(result.checked).toBe(2);
    expect(result.deleted).toEqual([staleManaged]);
    expect(result.orphaned).toEqual({ deleted: [], failed: [], retained: [] });
    expect(result.retained).toEqual([explicitOutput]);
    expect(result.skipped).toEqual([]);
    expect(fsModule.open).toHaveBeenCalledWith(repoLockPath(otherCwd), "wx");
    expect(fsModule.rm).toHaveBeenCalledWith(staleManaged.outputDir, { recursive: true, force: true });
    expect(fsModule.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/\.tmp$/),
      `${JSON.stringify(explicitOutput)}\n`,
      "utf-8",
    );
    expect(fsModule.rename).toHaveBeenCalledWith(expect.stringMatching(/\.tmp$/), otherStatePath);
  });

  it("should keep a still-running managed run whose process is alive but reap a crashed one", async () => {
    const fsModule = await import("node:fs/promises");
    const cwd = resolve("/repo");
    const otherCwd = resolve("/running-repo");
    const otherStatePath = repoStatePath(otherCwd);
    const currentManaged = {
      schema: "allure-agent-run/v1",
      runId: "current-managed",
      cwd,
      outputDir: tempOutputPath("allure-agent-current"),
      managedOutput: true,
      command: "npm test current",
      startedAt: 1777999999000,
      status: "finished",
      finishedAt: 1777999999000,
      exitCode: 0,
    };
    // status "running" with a live pid: the run is genuinely in progress and must not be deleted.
    const runningAlive = {
      schema: "allure-agent-run/v1",
      runId: "running-alive",
      cwd: otherCwd,
      outputDir: tempOutputPath("allure-agent-running-alive"),
      managedOutput: true,
      command: "npm test running",
      startedAt: 1776276000000,
      status: "running",
      pid: process.pid,
    };
    // status "running" with a dead pid: the run crashed without writing finishedAt and may be reaped.
    const runningCrashed = {
      schema: "allure-agent-run/v1",
      runId: "running-crashed",
      cwd: otherCwd,
      outputDir: tempOutputPath("allure-agent-running-crashed"),
      managedOutput: true,
      command: "npm test crashed",
      startedAt: 1776276000000,
      status: "running",
      pid: 2147483646,
    };
    const now = 1778000000000;

    (fsModule.readdir as Mock).mockResolvedValueOnce([repoStateEntry(cwd), repoStateEntry(otherCwd)]);
    (fsModule.readFile as Mock)
      .mockResolvedValueOnce(`${JSON.stringify(currentManaged)}\n`)
      .mockResolvedValueOnce([runningAlive, runningCrashed].map((state) => JSON.stringify(state)).join("\n") + "\n")
      .mockResolvedValueOnce([runningAlive, runningCrashed].map((state) => JSON.stringify(state)).join("\n") + "\n");

    const result = await cleanupStaleAgentRunStates({
      cwd,
      now,
      staleOutputTtlMs: 1,
    });

    expect(result.deleted).toEqual([runningCrashed]);
    expect(result.retained).toEqual([runningAlive]);
    expect(fsModule.rm).toHaveBeenCalledWith(runningCrashed.outputDir, { recursive: true, force: true });
    expect(fsModule.rm).not.toHaveBeenCalledWith(runningAlive.outputDir, { recursive: true, force: true });
    expect(fsModule.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/\.tmp$/),
      `${JSON.stringify(runningAlive)}\n`,
      "utf-8",
    );
    expect(fsModule.rename).toHaveBeenCalledWith(expect.stringMatching(/\.tmp$/), otherStatePath);
  });

  it("should skip locked stale registries unless the lock itself is stale", async () => {
    const fsModule = await import("node:fs/promises");
    const cwd = resolve("/repo");
    const lockedCwd = resolve("/locked-repo");
    const staleLockedCwd = resolve("/stale-locked-repo");
    const lockedStatePath = repoStatePath(lockedCwd);
    const staleLockedStatePath = repoStatePath(staleLockedCwd);
    const lockedManaged = {
      schema: "allure-agent-run/v1",
      runId: "locked-managed",
      cwd: lockedCwd,
      outputDir: tempOutputPath("allure-agent-locked"),
      managedOutput: true,
      command: "npm test locked",
      startedAt: 1776276000000,
      status: "finished",
      finishedAt: 1776276001000,
      exitCode: 0,
    };
    const staleLockedManaged = {
      schema: "allure-agent-run/v1",
      runId: "stale-locked-managed",
      cwd: staleLockedCwd,
      outputDir: tempOutputPath("allure-agent-stale-locked"),
      managedOutput: true,
      command: "npm test stale locked",
      startedAt: 1776276000000,
      status: "finished",
      finishedAt: 1776276001000,
      exitCode: 0,
    };
    const now = 1778000000000;

    (fsModule.readdir as Mock).mockResolvedValueOnce([repoStateEntry(lockedCwd), repoStateEntry(staleLockedCwd)]);
    (fsModule.readFile as Mock)
      .mockResolvedValueOnce(`${JSON.stringify(lockedManaged)}\n`)
      .mockResolvedValueOnce(`${JSON.stringify(staleLockedManaged)}\n`)
      .mockResolvedValueOnce(`${JSON.stringify(staleLockedManaged)}\n`);
    (fsModule.open as Mock)
      .mockRejectedValueOnce(Object.assign(new Error("locked"), { code: "EEXIST" }))
      .mockRejectedValueOnce(Object.assign(new Error("stale locked"), { code: "EEXIST" }))
      .mockResolvedValueOnce(lockHandle);
    (fsModule.stat as Mock).mockImplementation(async (path: string) => {
      if (path === repoLockPath(lockedCwd)) {
        return { mtimeMs: Date.now() };
      }

      if (path === repoLockPath(staleLockedCwd)) {
        return { mtimeMs: Date.now() - 11 * 60 * 1000 };
      }

      return { mtimeMs: Date.now() };
    });

    const result = await cleanupStaleAgentRunStates({
      cwd,
      now,
      staleOutputTtlMs: 1,
    });

    await attachJsonEvidence("global stale lock cleanup contract", {
      skipped: result.skipped,
      deletedOutput: staleLockedManaged.outputDir,
      liveLock: repoLockPath(lockedCwd),
      staleLock: repoLockPath(staleLockedCwd),
    });

    expect(result.deleted).toEqual([staleLockedManaged]);
    expect(result.skipped).toEqual([{ cwd: lockedCwd, statePath: lockedStatePath, reason: "locked" }]);
    expect(fsModule.rm).toHaveBeenCalledWith(repoLockPath(staleLockedCwd), { force: true });
    expect(fsModule.rm).toHaveBeenCalledWith(staleLockedManaged.outputDir, {
      recursive: true,
      force: true,
    });
    expect(fsModule.writeFile).toHaveBeenCalledWith(expect.stringMatching(/\.tmp$/), "", "utf-8");
    expect(fsModule.rename).toHaveBeenCalledWith(expect.stringMatching(/\.tmp$/), staleLockedStatePath);
  });

  it("should cleanup stale orphan managed temp output directories", async () => {
    const fsModule = await import("node:fs/promises");
    const cwd = resolve("/repo");
    const otherCwd = resolve("/old-repo");
    const referencedOutput = tempOutputPath("allure-agent-referenced");
    const staleOrphan = tempOutputPath("allure-agent-orphan-old");
    const freshOrphan = tempOutputPath("allure-agent-orphan-fresh");
    const fakePrefixedDir = tempOutputPath("allure-agent-not-output");
    const explicitOutput = {
      schema: "allure-agent-run/v1",
      runId: "explicit",
      cwd: otherCwd,
      outputDir: referencedOutput,
      managedOutput: false,
      command: "npm test explicit",
      startedAt: 1776277000000,
      status: "finished",
      finishedAt: 1776277001000,
      exitCode: 0,
    };
    const now = 1778000000000;

    (fsModule.readdir as Mock)
      .mockResolvedValueOnce([repoStateEntry(otherCwd)])
      .mockResolvedValueOnce([
        tempOutputEntry("allure-agent-referenced"),
        tempOutputEntry("allure-agent-orphan-old"),
        tempOutputEntry("allure-agent-orphan-fresh"),
        tempOutputEntry("allure-agent-not-output"),
        { name: "not-allure-agent", isDirectory: () => true },
      ]);
    (fsModule.readFile as Mock).mockResolvedValueOnce(`${JSON.stringify(explicitOutput)}\n`);
    (fsModule.stat as Mock).mockImplementation(async (path: string) => {
      if (path === staleOrphan) {
        return { mtimeMs: now - 2 };
      }

      if (path === join(staleOrphan, "manifest", "run.json")) {
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      }

      if (path === join(staleOrphan, "index.md")) {
        return { mtimeMs: now };
      }

      if (path === fakePrefixedDir) {
        return { mtimeMs: now - 2 };
      }

      if (path === join(fakePrefixedDir, "manifest", "run.json") || path === join(fakePrefixedDir, "index.md")) {
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      }

      return { mtimeMs: now };
    });

    const result = await cleanupStaleAgentRunStates({
      cwd,
      now,
      staleOutputTtlMs: 1,
    });

    await attachJsonEvidence("orphan temp output cleanup contract", {
      referencedOutput,
      staleOrphan,
      freshOrphan,
      fakePrefixedDir,
      orphaned: result.orphaned,
    });

    expect(result.deleted).toEqual([]);
    expect(result.orphaned.deleted).toEqual([staleOrphan]);
    expect(result.orphaned.failed).toEqual([]);
    expect(result.orphaned.retained).toEqual([referencedOutput, freshOrphan, fakePrefixedDir]);
    expect(fsModule.rm).toHaveBeenCalledWith(staleOrphan, { recursive: true, force: true });
    expect(fsModule.rm).not.toHaveBeenCalledWith(referencedOutput, { recursive: true, force: true });
    expect(fsModule.rm).not.toHaveBeenCalledWith(freshOrphan, { recursive: true, force: true });
    expect(fsModule.rm).not.toHaveBeenCalledWith(fakePrefixedDir, { recursive: true, force: true });
  });
});
