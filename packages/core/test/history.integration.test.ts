import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { attachment, epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const corePackageDir = resolve(testDir, "..");
const coreApiPackageDir = resolve(corePackageDir, "../core-api");

const workspaces = new Set<string>();

/**
 * Yarn's PnP runtime replaces `fs` (including `fs/promises.open`) with its own ZipFS-aware
 * implementation, whose `FileHandle.close()` doesn't wait for stream references. That hides
 * handle lifecycle bugs from every in-process test and from anything started via `yarn node`.
 * To exercise the real Node implementation, the history code has to run in a plain `node`
 * process without the PnP preload — which in turn needs a real `node_modules` tree.
 */
const createStandaloneWorkspace = async () => {
  const workspace = await mkdtemp(join(tmpdir(), "allure-history-standalone-"));

  workspaces.add(workspace);

  const modulesDir = join(workspace, "node_modules", "@allurereport");

  await mkdir(modulesDir, { recursive: true });

  for (const [name, packageDir] of [
    ["core", corePackageDir],
    ["core-api", coreApiPackageDir],
  ] as const) {
    const distDir = join(packageDir, "dist");

    try {
      await stat(join(distDir, "index.js"));
    } catch {
      throw new Error(
        `${distDir} is missing, run \`yarn workspaces foreach -Rpt --from @allurereport/core run build\``,
      );
    }

    await cp(distDir, join(modulesDir, name, "dist"), { recursive: true });
    await writeFile(
      join(modulesDir, name, "package.json"),
      `${JSON.stringify({ name: `@allurereport/${name}`, version: "0.0.0", type: "module", main: "./dist/index.js" })}\n`,
      "utf-8",
    );
  }

  return workspace;
};

const runWithoutPnp = (scriptPath: string, cwd: string, timeoutMs = 30_000) =>
  new Promise<{ code: number | null; signal: NodeJS.Signals | null; output: string; timedOut: boolean }>(
    (resolvePromise) => {
      const env = { ...process.env, NODE_NO_WARNINGS: "" };

      // the whole point is to run without `--require .pnp.cjs`
      delete env.NODE_OPTIONS;

      const child = spawn(process.execPath, [scriptPath], { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
      let output = "";

      child.stdout.on("data", (chunk) => (output += chunk.toString()));
      child.stderr.on("data", (chunk) => (output += chunk.toString()));

      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        resolvePromise({ code: null, signal: "SIGKILL", output, timedOut: true });
      }, timeoutMs);

      child.once("exit", (code, signal) => {
        clearTimeout(timeout);
        resolvePromise({ code, signal, output, timedOut: false });
      });
    },
  );

beforeEach(async () => {
  await epic("coverage");
  await feature("history");
  await story("history.integration");
  await label("coverage", "history");
});

afterEach(async () => {
  await Promise.all(
    [...workspaces].map(async (workspace) => {
      await rm(workspace, { recursive: true, force: true });
    }),
  );
  workspaces.clear();
});

describe("AllureLocalHistory", () => {
  describe("outside of Yarn PnP", () => {
    it("should settle append and read operations in a plain node process", async () => {
      const workspace = await createStandaloneWorkspace();
      const scriptPath = join(workspace, "history.mjs");

      await writeFile(
        scriptPath,
        `import { AllureLocalHistory } from "@allurereport/core/dist/history.js";

const dataPoint = (uuid) => ({
  uuid,
  name: \`Report \${uuid}\`,
  timestamp: 1,
  knownTestCaseIds: [],
  testResults: {},
  metrics: {},
});
const params = { historyPath: new URL("./history.jsonl", import.meta.url).pathname, limit: 5 };

// writing a new file, appending to an existing one and reading it back all open streams on a
// FileHandle with \`autoClose: false\`; leaving one behind makes \`close()\` never settle
await new AllureLocalHistory(params).appendHistory(dataPoint("1"));
await new AllureLocalHistory(params).appendHistory(dataPoint("2"));

const entries = await new AllureLocalHistory(params).readHistory();

console.log(\`history-complete:\${entries.length}\`);
`,
        "utf-8",
      );

      const result = await runWithoutPnp(scriptPath, workspace);

      await attachment("standalone history output", result.output || "<empty>", "text/plain");

      expect(result.timedOut, "the history operations never settled").toBe(false);
      expect(result.output).toContain("history-complete:2");
      expect(result.code).toBe(0);
    }, 60_000);
  });
});
