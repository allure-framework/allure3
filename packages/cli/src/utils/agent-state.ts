import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

export type AgentLatestState = {
  schema: "allure-agent-latest/v1";
  cwd: string;
  outputDir: string;
  expectationsPath?: string;
  command: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "finished";
  exitCode?: number | null;
};

const AGENT_STATE_SCHEMA = "allure-agent-latest/v1";
export const ALLURE_AGENT_STATE_DIR_ENV = "ALLURE_AGENT_STATE_DIR";

const isFileNotFoundError = (error: unknown): error is NodeJS.ErrnoException =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

const projectHash = (cwd: string) => createHash("sha256").update(cwd).digest("hex").slice(0, 16);

export const resolveAgentStateDir = (cwd: string) => {
  const configuredDir = process.env[ALLURE_AGENT_STATE_DIR_ENV]?.trim();

  if (configuredDir) {
    return resolve(configuredDir);
  }

  return join(tmpdir(), `allure-agent-state-${projectHash(resolve(cwd))}`);
};

const projectStatePath = (cwd: string) => join(resolveAgentStateDir(cwd), "latest.json");

const writeJsonAtomic = async (filePath: string, value: unknown) => {
  await mkdir(dirname(filePath), { recursive: true });

  const tempPath = `${filePath}.${process.pid}.tmp`;

  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
  await rename(tempPath, filePath);
};

const isAgentLatestState = (value: unknown): value is AgentLatestState => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<AgentLatestState>;

  return (
    candidate.schema === AGENT_STATE_SCHEMA &&
    typeof candidate.cwd === "string" &&
    typeof candidate.outputDir === "string" &&
    typeof candidate.command === "string" &&
    typeof candidate.startedAt === "string" &&
    (candidate.expectationsPath === undefined || typeof candidate.expectationsPath === "string") &&
    (candidate.finishedAt === undefined || typeof candidate.finishedAt === "string") &&
    (candidate.status === "running" || candidate.status === "finished") &&
    (candidate.exitCode === undefined || typeof candidate.exitCode === "number" || candidate.exitCode === null)
  );
};

export const writeLatestAgentState = async (
  value: Omit<AgentLatestState, "schema">,
): Promise<AgentLatestState> => {
  const normalizedState: AgentLatestState = {
    schema: AGENT_STATE_SCHEMA,
    cwd: resolve(value.cwd),
    outputDir: resolve(value.outputDir),
    expectationsPath: value.expectationsPath ? resolve(value.expectationsPath) : undefined,
    command: value.command,
    startedAt: value.startedAt,
    finishedAt: value.finishedAt,
    status: value.status,
    exitCode: value.exitCode,
  };

  await writeJsonAtomic(projectStatePath(normalizedState.cwd), normalizedState);

  return normalizedState;
};

export const readLatestAgentState = async (cwd: string): Promise<AgentLatestState | undefined> => {
  const normalizedCwd = resolve(cwd);
  const statePath = projectStatePath(normalizedCwd);
  let raw: string;

  try {
    raw = await readFile(statePath, "utf-8");
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return undefined;
    }

    throw error;
  }

  const parsed = JSON.parse(raw) as unknown;

  if (!isAgentLatestState(parsed)) {
    throw new Error(`Invalid latest agent state in ${statePath}`);
  }

  if (parsed.cwd !== normalizedCwd) {
    return undefined;
  }

  try {
    await stat(parsed.outputDir);
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return undefined;
    }

    throw error;
  }

  return parsed;
};
