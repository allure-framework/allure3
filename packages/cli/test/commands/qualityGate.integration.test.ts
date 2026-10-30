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
const runGate = async (config: string, flags: string[] = [], { withResults = true } = {}) => {
  const cwd = await mkdtemp(join(tmpdir(), "allure-quality-gate-"));
  directories.push(cwd);
  const results = join(cwd, "allure-results");
  if (withResults) {
    await mkdir(results);
    await writeFile(
      join(results, "test-result.json"),
      JSON.stringify({ name: "Passed test", fullName: "Passed test", status: "passed", start: 1, stop: 2 }),
    );
  }
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
  it("skips a disabled gate without requiring result directories", async () => {
    const result = await runGate(
      `
qualityGate:
  enabled: false
  rules:
    - minTestsCount: 2
`,
      [],
      { withResults: false },
    );

    expect(result.code).toBe(0);
    expect(result.stdout + result.stderr).toContain("Quality gate is disabled");
  });

  it("runs explicit CLI thresholds even when the configured gate is disabled", async () => {
    const result = await runGate(
      `
qualityGate:
  enabled: false
`,
      ["--min-tests-count", "2"],
    );

    expect(result.code).toBe(1);
    expect(result.stdout + result.stderr).toContain("minTestsCount");
  });

  it("runs a YAML builtin rule with an expression filter against real result files", async () => {
    const result = await runGate(`
qualityGate:
  rules:
    - minTestsCount: 1
      filter: "\${{ test.status == 'passed' }}"
  use:
    - minTestsCount
`);

    expect(result.code).toBe(0);
  });

  it("replaces configured rules with explicit CLI thresholds", async () => {
    const result = await runGate(
      `
qualityGate:
  rules:
    - minTestsCount: 2
`,
      ["--max-failures", "0"],
    );

    expect(result.code).toBe(0);
  });

  it.each([
    { input: "rules:\n    - maxFailures: \"${{ 'invalid' }}\"", path: "qualityGate.rules[0].maxFailures" },
    {
      input: 'rules:\n    - maxFailures: 0\n      filter: "${{ test.missing == true }}"',
      path: "qualityGate.rules[0].filter",
    },
  ])("returns a non-success exit for invalid configuration or execution: $path", async ({ input, path }) => {
    const result = await runGate(`qualityGate:\n  ${input}\n`);

    expect(result.code).toBe(1);
    expect(result.stdout + result.stderr).toContain(path);
  });
});
