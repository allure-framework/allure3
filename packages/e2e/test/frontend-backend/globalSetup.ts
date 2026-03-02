/**
 * Global setup for frontend-backend Playwright project.
 * Starts Postgres (Testcontainers), runs migrations, starts backend and frontend;
 * writes API_BASE_URL, FRONTEND_URL and process/container ids to env file for tests and teardown.
 */
import { spawn, execFileSync, execSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = join(__dirname, "../../.."); // packages (parent of e2e)
const backendDir = join(rootDir, "backend");
const reportAppDir = join(rootDir, "report-app");
const repoRoot = join(rootDir, ".."); // monorepo root (allure3_custom)

const ENV_FILE = join(__dirname, "env.json");
const BACKEND_PORT = "30999";
const FRONTEND_PORT = "4173";

function getNodePath(): string {
  try {
    return execSync("which node", { encoding: "utf8", env: process.env }).trim();
  } catch {
    return process.execPath;
  }
}

const bin = (name: string) => join(repoRoot, "node_modules", ".bin", name);
const nodeBinDir = dirname(getNodePath());
const envWithNodePath = (env: Record<string, string> = {}) => ({
  ...process.env,
  ...env,
  PATH: `${nodeBinDir}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}`,
});

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(url: string, maxAttempts = 60): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // ignore
    }
    await sleep(1000);
  }
  throw new Error(`Health check failed: ${url}`);
}

async function runMigrations(env: Record<string, string>): Promise<void> {
  try {
    execFileSync(getNodePath(), [bin("tsx"), "src/scripts/run-migrations.ts"], {
      cwd: backendDir,
      env: envWithNodePath(env),
      stdio: "inherit",
    });
  } catch (err) {
    const msg =
      err && typeof err === "object" && "code" in err && err.code === "ENOENT"
        ? "spawn ENOENT: Run setup from terminal: cd packages/e2e && yarn setup:frontend-backend"
        : String(err);
    throw new Error(msg);
  }
}

async function envAlreadyRunning(): Promise<boolean> {
  if (!existsSync(ENV_FILE)) return false;
  try {
    const data = JSON.parse(readFileSync(ENV_FILE, "utf8")) as { API_BASE_URL?: string; FRONTEND_URL?: string };
    if (!data.API_BASE_URL || !data.FRONTEND_URL) return false;
    const [healthOk, frontOk] = await Promise.all([
      fetch(`${data.API_BASE_URL.replace(/\/$/, "")}/health`).then((r) => r.ok),
      fetch(data.FRONTEND_URL).then((r) => r.ok),
    ]);
    return healthOk && frontOk;
  } catch {
    return false;
  }
}

async function globalSetup(): Promise<void> {
  if (await envAlreadyRunning()) return;

  const { PostgreSqlContainer } = await import("@testcontainers/postgresql");

  const container = await new PostgreSqlContainer("postgres:16")
    .withDatabase("allure_backend")
    .withUsername("allure")
    .withPassword("allure")
    .start();

  const dbEnv = {
    DB_HOST: container.getHost(),
    DB_PORT: String(container.getPort()),
    DB_USERNAME: container.getUsername(),
    DB_PASSWORD: container.getPassword(),
    DB_DATABASE: container.getDatabase(),
  };

  await runMigrations(dbEnv);

  const backendEnv = {
    ...process.env,
    ...dbEnv,
    PORT: BACKEND_PORT,
  };

  const backendProc = spawn(getNodePath(), [bin("tsx"), "src/index.ts"], {
    cwd: backendDir,
    env: envWithNodePath(backendEnv),
    stdio: "pipe",
  });
  backendProc.on("error", (err) => {
    throw new Error(
      (err as NodeJS.ErrnoException).code === "ENOENT"
        ? "spawn ENOENT: Run setup from terminal first: cd packages/e2e && node --import tsx test/frontend-backend/globalSetup.ts"
        : String(err)
    );
  });

  const API_BASE_URL = `http://localhost:${BACKEND_PORT}`;
  await waitForHealth(`${API_BASE_URL}/health`);

  const reportAppBuild = spawn(getNodePath(), [bin("vite"), "build"], {
    cwd: reportAppDir,
    env: envWithNodePath({ VITE_API_BASE_URL: API_BASE_URL }),
    stdio: "inherit",
  });
  reportAppBuild.on("error", (err) => {
    throw new Error((err as NodeJS.ErrnoException).code === "ENOENT" ? "spawn ENOENT: Run setup from terminal first." : String(err));
  });
  await new Promise<void>((resolve, reject) => {
    reportAppBuild.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`report-app build exited ${code}`))));
  });

  const frontendProc = spawn(getNodePath(), [bin("vite"), "preview", "--port", FRONTEND_PORT], {
    cwd: reportAppDir,
    env: envWithNodePath(),
    stdio: "pipe",
  });
  frontendProc.on("error", (err) => {
    throw new Error((err as NodeJS.ErrnoException).code === "ENOENT" ? "spawn ENOENT: Run setup from terminal first." : String(err));
  });

  const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;
  await waitForHealth(FRONTEND_URL, 30);

  const containerId =
    typeof (container as unknown as { getId?: () => string }).getId === "function"
      ? (container as unknown as { getId: () => string }).getId()
      : (container as unknown as { id?: string }).id ?? "";
  mkdirSync(__dirname, { recursive: true });
  writeFileSync(
    ENV_FILE,
    JSON.stringify({
      API_BASE_URL,
      FRONTEND_URL,
      BACKEND_PID: backendProc.pid,
      FRONTEND_PID: frontendProc.pid,
      CONTAINER_ID: containerId,
    }),
    "utf8"
  );
}

export default globalSetup;
