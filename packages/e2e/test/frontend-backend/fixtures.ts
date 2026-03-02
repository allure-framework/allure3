/**
 * Fixtures for frontend-backend UI tests: read env from globalSetup output and API helpers.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ENV_FILE = join(__dirname, "env.json");

export interface EnvState {
  API_BASE_URL: string;
  FRONTEND_URL: string;
}

export function getEnv(): EnvState {
  if (!existsSync(ENV_FILE)) {
    throw new Error(
      "frontend-backend env.json not found. Run tests with: yarn test:frontend-backend (or playwright test -c playwright.frontend-backend.config.ts)"
    );
  }
  const raw = JSON.parse(readFileSync(ENV_FILE, "utf8")) as { API_BASE_URL?: string; FRONTEND_URL?: string };
  if (!raw.API_BASE_URL || !raw.FRONTEND_URL) {
    throw new Error("env.json must contain API_BASE_URL and FRONTEND_URL");
  }
  return { API_BASE_URL: raw.API_BASE_URL, FRONTEND_URL: raw.FRONTEND_URL };
}

function minimalTestResult(overrides: { id?: string; name?: string; status?: string } = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    name: overrides.name ?? "E2E Test",
    status: overrides.status ?? "passed",
    flaky: false,
    muted: false,
    known: false,
    hidden: false,
    labels: [],
    parameters: [],
    links: [],
    steps: [],
    sourceMetadata: { readerId: "e2e", metadata: {} },
  };
}

/**
 * Delete all launches via API (for test isolation, e.g. before "empty list" test).
 */
export async function deleteAllLaunches(apiBase: string): Promise<void> {
  const base = apiBase.replace(/\/$/, "");
  const listRes = await fetch(`${base}/api/v1/launches?limit=100`);
  if (!listRes.ok) return;
  const listJson = (await listRes.json()) as { data?: Array<{ id?: string }> };
  const launches = listJson.data ?? [];
  for (const launch of launches) {
    if (launch.id) {
      await fetch(`${base}/api/v1/launches/${encodeURIComponent(launch.id)}`, { method: "DELETE" });
    }
  }
}

/**
 * Create a launch via API and return launchId.
 */
export async function createLaunch(apiBase: string, name = "E2E Launch", environment = "e2e"): Promise<string> {
  const base = apiBase.replace(/\/$/, "");
  const res = await fetch(`${base}/api/v1/launches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, environment }),
  });
  if (!res.ok) throw new Error(`Create launch failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data?: { id?: string } };
  const id = json.data?.id;
  if (!id) throw new Error("No launch id in response");
  return id;
}

/**
 * Upload test results to a launch. Returns the same launchId.
 */
export async function uploadResults(
  apiBase: string,
  launchId: string,
  results: Array<{ id?: string; name?: string; status?: string }> = [
    { name: "Test A", status: "passed" },
    { name: "Test B", status: "failed" },
  ]
): Promise<string> {
  const base = apiBase.replace(/\/$/, "");
  const payload = results.map((r) => minimalTestResult(r));
  const res = await fetch(`${base}/api/v1/launches/${launchId}/results`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Upload results failed: ${res.status} ${await res.text()}`);
  return launchId;
}

/**
 * Create a launch with two test results (passed + failed). Returns { launchId, apiBase, frontendUrl }.
 */
export async function createLaunchWithResults(env: EnvState): Promise<{ launchId: string } & EnvState> {
  const launchId = await createLaunch(env.API_BASE_URL);
  await uploadResults(env.API_BASE_URL, launchId);
  return { ...env, launchId };
}

/**
 * Convert a raw Allure 2 *-result.json object to API TestResult DTO (id, name, status, etc.).
 */
function allure2ToDTO(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    id: (raw.uuid ?? raw.id) as string,
    name: String(raw.name ?? ""),
    fullName: String(raw.fullName ?? raw.name ?? ""),
    status: (raw.status ?? "unknown") as string,
    flaky: Boolean(raw.flaky),
    muted: Boolean(raw.muted),
    known: Boolean(raw.known),
    hidden: Boolean(raw.hidden),
    labels: Array.isArray(raw.labels) ? raw.labels : [],
    parameters: Array.isArray(raw.parameters) ? raw.parameters : [],
    links: Array.isArray(raw.links) ? raw.links : [],
    steps: Array.isArray(raw.steps) ? raw.steps : [],
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    sourceMetadata: { readerId: "e2e-demo", metadata: {} },
  };
}

/**
 * Upload raw result DTOs (e.g. from demo JSON files). Payload is sent as-is.
 */
export async function uploadRawResults(apiBase: string, launchId: string, payload: unknown[]): Promise<void> {
  const base = apiBase.replace(/\/$/, "");
  const res = await fetch(`${base}/api/v1/launches/${launchId}/results`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Upload results failed: ${res.status} ${await res.text()}`);
}

/**
 * POST globals (exitCode, errors) for a launch.
 */
export async function postGlobals(
  apiBase: string,
  launchId: string,
  payload: { exitCode?: { original: number; actual?: number }; errors?: Array<{ message?: string; trace?: string; actual?: string; expected?: string }> }
): Promise<void> {
  const base = apiBase.replace(/\/$/, "");
  const res = await fetch(`${base}/api/v1/launches/${encodeURIComponent(launchId)}/globals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Post globals failed: ${res.status} ${await res.text()}`);
}

/**
 * Load *-result.json from backend test fixtures and convert to DTOs for upload.
 * Returns empty array if dir does not exist.
 */
export function loadDemoResultDTOs(demoResultsDir: string): Record<string, unknown>[] {
  if (!existsSync(demoResultsDir)) return [];
  const entries = readdirSync(demoResultsDir, { withFileTypes: true });
  const out: Record<string, unknown>[] = [];
  for (const e of entries) {
    const full = join(demoResultsDir, e.name);
    if (e.isFile() && e.name.endsWith("-result.json")) {
      const raw = JSON.parse(readFileSync(full, "utf8")) as Record<string, unknown>;
      out.push(allure2ToDTO(raw));
    }
  }
  return out;
}
