import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const commandsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(commandsDir, "../../../..");
const cliPath = join(repoRoot, "packages", "cli", "cli.js");
const simpleResultFixture = join(repoRoot, "packages", "reader", "test", "resources", "allure2data", "simple.json");
const maxBuffer = 10 * 1024 * 1024;

type RunCommandOptions = Parameters<typeof execFileAsync>[2];

const runCommand = async (command: string, args: string[], options: RunCommandOptions = {}) => {
  return await execFileAsync(command, args, {
    cwd: repoRoot,
    env: process.env,
    maxBuffer,
    ...options,
  });
};

describe("run command integration", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "allure-cli-agent-"));

    await runCommand("yarn", ["workspace", "@allurereport/core", "build"]);
    await runCommand("yarn", ["workspace", "@allurereport/plugin-log", "build"]);
    await runCommand("yarn", ["workspace", "@allurereport/plugin-agent", "build"]);
    await runCommand("yarn", ["workspace", "allure", "build"]);
  }, 240_000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it(
    "writes the full agent directory contract in the built CLI path",
    async () => {
      const fixtureDir = join(tempDir, "built-run");
      const outputDir = join(fixtureDir, "agent-output");
      const reportDir = join(fixtureDir, "report");
      const expectationsPath = join(fixtureDir, "expected.yaml");
      const configPath = join(fixtureDir, "allurerc.mjs");
      const emitResultsPath = join(fixtureDir, "emit-results.mjs");
      const expectationsSource = `goal: Validate built CLI agent output
task_id: cli-integration
expected:
  environments:
    - default
notes:
  - The built CLI path should produce the same manifest contract as source tests.
`;
      const configSource = `
export default {
  name: "CLI Integration Report",
  output: ${JSON.stringify(reportDir)},
  plugins: {
    awesome: {
      options: {
        reportName: "CLI Integration Report"
      }
    }
  }
};
`.trimStart();
      const emitResultsSource = `
import { cp, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

const fixture = process.argv[2];
const outDir = join(process.cwd(), "allure-results");

await mkdir(outDir, { recursive: true });
await cp(fixture, join(outDir, \`\${randomUUID()}-result.json\`));
console.log("emitted simple result");
`.trimStart();

      await mkdir(fixtureDir, { recursive: true });
      await writeFile(expectationsPath, expectationsSource, "utf-8");
      await writeFile(configPath, configSource, "utf-8");
      await writeFile(emitResultsPath, emitResultsSource, "utf-8");

      const { stdout } = await runCommand(
        process.execPath,
        [cliPath, "run", "--config", configPath, "--cwd", fixtureDir, "--", "node", emitResultsPath, simpleResultFixture],
        {
          env: {
            ...process.env,
            ALLURE_AGENT_OUTPUT: outputDir,
            ALLURE_AGENT_EXPECTATIONS: expectationsPath,
          },
        },
      );

      await expect(stat(join(outputDir, "index.md"))).resolves.toBeTruthy();
      await expect(stat(join(outputDir, "AGENTS.md"))).resolves.toBeTruthy();
      await expect(stat(join(outputDir, "manifest", "run.json"))).resolves.toBeTruthy();
      await expect(stat(join(outputDir, "manifest", "tests.jsonl"))).resolves.toBeTruthy();
      await expect(stat(join(outputDir, "manifest", "findings.jsonl"))).resolves.toBeTruthy();

      const runManifest = JSON.parse(await readFile(join(outputDir, "manifest", "run.json"), "utf-8")) as {
        command: string | null;
        expectations_present: boolean;
        paths: {
          expected_manifest: string | null;
          project_guide: string | null;
        };
        check_summary: {
          total: number;
        };
      };
      const indexContent = await readFile(join(outputDir, "index.md"), "utf-8");
      const findingsContent = await readFile(join(outputDir, "manifest", "findings.jsonl"), "utf-8");
      const expectedCopy = await readFile(join(outputDir, "manifest", "expected.json"), "utf-8");
      const agentsGuide = await readFile(join(outputDir, "AGENTS.md"), "utf-8");

      expect(runManifest.command).toBeNull();
      expect(runManifest.expectations_present).toBe(true);
      expect(runManifest.paths.expected_manifest).toBe("manifest/expected.json");
      expect(runManifest.paths.project_guide).toBe("project/docs/allure-agent-mode.md");
      expect(runManifest.check_summary.total).toBe(0);
      expect(expectedCopy).toContain('"task_id": "cli-integration"');
      expect(agentsGuide).toContain("[project guidance](project/docs/allure-agent-mode.md)");
      expect(indexContent).toContain("# CLI Integration Report");
      expect(indexContent).toContain("## Expected Scope");
      expect(indexContent).toContain("## Advisory Check Summary");
      expect(indexContent).toContain("## Passed");
      expect(findingsContent).toBe("");
      expect(stdout).toContain(`node ${emitResultsPath} ${simpleResultFixture}`);
      expect(stdout).toContain("emitted simple result");
    },
    240_000,
  );
});
