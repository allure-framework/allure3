import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vite-plus/test";

const execute = promisify(execFile);
const cli = fileURLToPath(new URL("../../cli.js", import.meta.url));
const directories: string[] = [];
const runGate = async (config: string, flags: string[] = []) => {
  const cwd = await mkdtemp(join(tmpdir(), "allure-inline-quality-gate-"));
  directories.push(cwd);
  const results = join(cwd, "allure-results");
  await mkdir(results);
  await writeFile(
    join(results, "test-result.json"),
    JSON.stringify({ name: "Passed test", fullName: "Passed test", status: "passed", start: 1, stop: 2 }),
  );
  await writeFile(join(cwd, "allurerc.yml"), config);
  const env = { ...process.env };
  delete env.ALLURE_CLI_ACTIVE_COMMAND;
  try {
    const output = await execute(process.execPath, [cli, "quality-gate", "--cwd", cwd, ...flags, results], {
      env,
      timeout: 15000,
    });
    return { code: 0, ...output };
  } catch (error) {
    const failure = error as Error & { code: number; stdout: string; stderr: string };
    return { code: failure.code, stdout: failure.stdout, stderr: failure.stderr };
  }
};

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("serialized quality-gate command", () => {
  it("executes a YAML inline validator against real result files", async () => {
    const result = await runGate(`
qualityGate:
  rules:
    - count: 1
  use:
    - rule: count
      message: 'Unexpected count'
      validate: |
        return { success: trs.length === expected, actual: trs.length, testResults: [] };
`);

    expect(result.code).toBe(0);
  });

  it("replaces configured custom validators with explicit CLI thresholds", async () => {
    const result = await runGate(
      `
qualityGate:
  rules:
    - custom: 0
  use:
    - rule: custom
      message: 'Should not execute'
      validate: |
        throw new Error('configured custom validator executed');
`,
      ["--max-failures", "0"],
    );

    expect(result.code).toBe(0);
    expect(result.stdout + result.stderr).not.toContain("configured custom validator executed");
  });

  it.each([
    { input: "rules:\n    - maxFailures: \"${{ 'invalid' }}\"", path: "qualityGate.rules[0].maxFailures" },
    {
      input: 'rules:\n    - maxFailures: 0\n      filter: "${{ test.missing == true }}"',
      path: "qualityGate.rules[0].filter",
    },
    {
      input:
        "rules:\n    - custom: 0\n  use:\n    - rule: custom\n      message: 'Invalid script'\n      validate: |\n        throw new Error('validation failed');",
      path: "qualityGate.use[0].validate",
    },
  ])("returns a non-success exit for invalid configuration or execution: $path", async ({ input, path }) => {
    const result = await runGate(`qualityGate:\n  ${input}\n`);

    expect(result.code).toBe(1);
    expect(result.stdout + result.stderr).toContain(path);
  });
});
