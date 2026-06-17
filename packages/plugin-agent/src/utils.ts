import { createHash } from "node:crypto";
import { mkdir, open, readdir, rename, rm, stat, writeFile, type FileHandle } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

export const ALLURE_AGENT_STATE_DIR_ENV = "ALLURE_AGENT_STATE_DIR";
export const AGENT_MANAGED_OUTPUT_DIR_PREFIX = "allure-agent-";

const AGENT_STATE_LOCK_STALE_MS = 10 * 60 * 1000;
const AGENT_STATE_LOCK_RETRIES = 100;
const AGENT_STATE_LOCK_RETRY_MS = 20;

export const isFileNotFoundError = (error: unknown): error is NodeJS.ErrnoException =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

const isFileExistsError = (error: unknown): error is NodeJS.ErrnoException =>
  typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";

const projectHash = (cwd: string) => createHash("sha256").update(cwd).digest("hex").slice(0, 16);

export const resolveAgentStateDir = (_cwd?: string) => {
  const configuredDir = process.env[ALLURE_AGENT_STATE_DIR_ENV]?.trim();

  if (configuredDir) {
    return resolve(configuredDir);
  }

  return join(tmpdir(), "allure-agent-state");
};

export const projectStatePath = (cwd: string) => join(resolveAgentStateDir(cwd), `${projectHash(resolve(cwd))}.jsonl`);

const projectLockPath = (cwd: string) => join(resolveAgentStateDir(cwd), `${projectHash(resolve(cwd))}.lock`);

export const listAgentStatePaths = async (cwd?: string) => {
  const stateDir = resolveAgentStateDir(cwd);

  try {
    const entries = await readdir(stateDir, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
      .map((entry) => join(stateDir, entry.name));
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return [];
    }

    throw error;
  }
};

export const listAgentManagedTempOutputDirs = async () => {
  const tempRoot = tmpdir();

  try {
    const entries = await readdir(tempRoot, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(AGENT_MANAGED_OUTPUT_DIR_PREFIX))
      .map((entry) => join(tempRoot, entry.name));
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return [];
    }

    throw error;
  }
};

export const writeJsonlAtomic = async (filePath: string, values: readonly unknown[]) => {
  await mkdir(dirname(filePath), { recursive: true });

  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const content = values.map((value) => JSON.stringify(value)).join("\n") + (values.length ? "\n" : "");

  await writeFile(tempPath, content, "utf-8");
  await rename(tempPath, filePath);
};

const removeLockIfStale = async (lockPath: string) => {
  try {
    const lockStat = await stat(lockPath);

    if (Date.now() - lockStat.mtimeMs > AGENT_STATE_LOCK_STALE_MS) {
      await rm(lockPath, { force: true });

      return true;
    }

    return false;
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return true;
    }

    throw error;
  }
};

const openAgentStateLock = async (lockPath: string) => {
  let lockHandle: FileHandle | undefined;

  try {
    lockHandle = await open(lockPath, "wx");
    await lockHandle.writeFile(`${process.pid}\n${Date.now()}\n`, "utf-8");

    return lockHandle;
  } catch (error) {
    if (lockHandle) {
      await lockHandle.close().catch(() => undefined);
      await rm(lockPath, { force: true }).catch(() => undefined);
    }

    throw error;
  }
};

const runWithAgentStateLock = async <T>(lockPath: string, lockHandle: FileHandle, operation: () => Promise<T>) => {
  try {
    return await operation();
  } finally {
    await lockHandle.close().catch(() => undefined);
    await rm(lockPath, { force: true }).catch(() => undefined);
  }
};

export const withAgentStateLock = async <T>(cwd: string, operation: () => Promise<T>): Promise<T> => {
  const normalizedCwd = resolve(cwd);
  const stateDir = resolveAgentStateDir(normalizedCwd);
  const lockPath = projectLockPath(normalizedCwd);
  let lastError: unknown;

  await mkdir(stateDir, { recursive: true });

  for (let attempt = 0; attempt < AGENT_STATE_LOCK_RETRIES; attempt += 1) {
    try {
      const lockHandle = await openAgentStateLock(lockPath);

      return await runWithAgentStateLock(lockPath, lockHandle, operation);
    } catch (error) {
      if (!isFileExistsError(error)) {
        throw error;
      }

      lastError = error;
      await removeLockIfStale(lockPath);
      await sleep(AGENT_STATE_LOCK_RETRY_MS);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Could not acquire agent state lock: ${lockPath}`);
};

export const tryWithAgentStateLock = async <T>(
  cwd: string,
  operation: () => Promise<T>,
): Promise<{ acquired: true; result: T } | { acquired: false }> => {
  const normalizedCwd = resolve(cwd);
  const stateDir = resolveAgentStateDir(normalizedCwd);
  const lockPath = projectLockPath(normalizedCwd);

  await mkdir(stateDir, { recursive: true });

  try {
    const lockHandle = await openAgentStateLock(lockPath);

    return {
      acquired: true,
      result: await runWithAgentStateLock(lockPath, lockHandle, operation),
    };
  } catch (error) {
    if (!isFileExistsError(error)) {
      throw error;
    }

    if (!(await removeLockIfStale(lockPath))) {
      return { acquired: false };
    }
  }

  try {
    const lockHandle = await openAgentStateLock(lockPath);

    return {
      acquired: true,
      result: await runWithAgentStateLock(lockPath, lockHandle, operation),
    };
  } catch (error) {
    if (isFileExistsError(error)) {
      return { acquired: false };
    }

    throw error;
  }
};

export const pathExists = async (path: string) => {
  try {
    await stat(path);

    return true;
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return false;
    }

    return true;
  }
};

export const readPathMtimeMs = async (path: string) => {
  const pathStat = await stat(path);

  return pathStat.mtimeMs;
};
