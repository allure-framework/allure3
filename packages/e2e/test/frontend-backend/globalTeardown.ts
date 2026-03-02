/**
 * Global teardown for frontend-backend Playwright project.
 * Stops backend and frontend processes, stops Postgres container.
 */
import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ENV_FILE = join(__dirname, "env.json");

async function globalTeardown(): Promise<void> {
  if (!existsSync(ENV_FILE)) return;
  const state = JSON.parse(readFileSync(ENV_FILE, "utf8")) as {
    BACKEND_PID?: number;
    FRONTEND_PID?: number;
    CONTAINER_ID?: string;
  };
  try {
    if (state.BACKEND_PID) process.kill(state.BACKEND_PID, "SIGTERM");
  } catch {
    // ignore
  }
  try {
    if (state.FRONTEND_PID) process.kill(state.FRONTEND_PID, "SIGTERM");
  } catch {
    // ignore
  }
  if (state.CONTAINER_ID) {
    try {
      execSync(`docker stop ${state.CONTAINER_ID}`, { stdio: "ignore" });
    } catch {
      // ignore
    }
  }
  try {
    unlinkSync(ENV_FILE);
  } catch {
    // ignore
  }
}

export default globalTeardown;
