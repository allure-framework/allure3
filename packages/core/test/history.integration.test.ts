import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

import { attachment, epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

const historyModuleUrl = new URL("../dist/history.js", import.meta.url).href;
const workspaces = new Set<string>();

// Use a separate Node process to exercise native FileHandle behavior outside Vitest's module mocks.
const runNodeScript = (scriptPath: string, cwd: string, timeoutMs = 30_000) =>
  new Promise<{ code: number | null; signal: NodeJS.Signals | null; output: string; timedOut: boolean }>(
    (resolvePromise) => {
      const child = spawn(process.execPath, [scriptPath], { cwd, stdio: ["ignore", "pipe", "pipe"] });
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
  describe("in a standalone Node process", () => {
    it("should settle append and read operations in a plain node process", async () => {
      const workspace = await mkdtemp(join(tmpdir(), "allure-history-standalone-"));

      workspaces.add(workspace);

      const scriptPath = join(workspace, "history.mjs");

      await writeFile(
        scriptPath,
        `import { fileURLToPath } from "node:url";

import { AllureLocalHistory } from ${JSON.stringify(historyModuleUrl)};

const dataPoint = (uuid) => ({
  uuid,
  name: \`Report \${uuid}\`,
  timestamp: 1,
  knownTestCaseIds: [],
  testResults: {},
  metrics: {},
});
// \`URL#pathname\` keeps the leading slash and the percent-encoding on Windows (\`/C:/Users/RUNNER%7E1/...\`),
// which \`path.resolve\` then turns into \`C:\\C:\\...\`; \`fileURLToPath\` yields a proper platform path
const params = { historyPath: fileURLToPath(new URL("./history.jsonl", import.meta.url)), limit: 5 };

// writing a new file, appending to an existing one and reading it back all open streams on a
// FileHandle with \`autoClose: false\`; leaving one behind makes \`close()\` never settle
await new AllureLocalHistory(params).appendHistory(dataPoint("1"));
await new AllureLocalHistory(params).appendHistory(dataPoint("2"));

const entries = await new AllureLocalHistory(params).readHistory();

console.log(\`history-complete:\${entries.length}\`);
`,
        "utf-8",
      );

      const result = await runNodeScript(scriptPath, workspace);

      await attachment("standalone history output", result.output || "<empty>", "text/plain");

      expect(result.timedOut, "the history operations never settled").toBe(false);
      expect(result.output).toContain("history-complete:2");
      expect(result.code).toBe(0);
    }, 60_000);
  });
});
