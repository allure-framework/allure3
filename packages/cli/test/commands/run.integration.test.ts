import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const commandsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(commandsDir, "../../../..");
const yarnRcPath = join(repoRoot, ".yarnrc.yml");
const cliPath = join(repoRoot, "packages", "cli", "cli.js");
const simpleResultFixture = join(repoRoot, "packages", "reader", "test", "resources", "allure2data", "simple.json");
const maxBuffer = 10 * 1024 * 1024;

type RunCommandOptions = Parameters<typeof execFileAsync>[2];

const runCommand = async (command: string, args: string[], options: RunCommandOptions = {}) => {
  const { env: customEnv, ...restOptions } = options;
  const env = { ...process.env, ...customEnv };

  delete env.ALLURE_CLI_ACTIVE_COMMAND;

  return await execFileAsync(command, args, {
    cwd: repoRoot,
    env,
    maxBuffer,
    ...restOptions,
  });
};

const pathExists = async (filePath: string) => {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
};

const writeJson = async (filePath: string, value: unknown) => {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const writeJsonl = async (filePath: string, lines: unknown[]) => {
  await writeFile(filePath, lines.map((line) => JSON.stringify(line)).join("\n"), "utf-8");
};

const resolveYarnInvocation = async () => {
  const yarnRc = await readFile(yarnRcPath, "utf-8");
  const configuredYarnPath = /^yarnPath:\s+(.+)$/m.exec(yarnRc)?.[1]?.trim();

  if (configuredYarnPath) {
    const resolvedYarnPath = resolve(repoRoot, configuredYarnPath);

    if (await pathExists(resolvedYarnPath)) {
      return {
        command: process.execPath,
        args: [resolvedYarnPath],
      };
    }
  }

  if (process.env.npm_execpath) {
    if (/\.(?:c|m)?js$/u.test(process.env.npm_execpath)) {
      return {
        command: process.execPath,
        args: [process.env.npm_execpath],
      };
    }

    if (process.platform === "win32" && !/\.[^./\\]+$/u.test(process.env.npm_execpath)) {
      const windowsShimPath = `${process.env.npm_execpath}.cmd`;

      if (await pathExists(windowsShimPath)) {
        return {
          command: windowsShimPath,
          args: [],
        };
      }
    }

    return {
      command: process.env.npm_execpath,
      args: [],
    };
  }

  return {
    command: process.platform === "win32" ? "yarn.cmd" : "yarn",
    args: [],
  };
};

const runYarnCommand = async (args: string[], options: RunCommandOptions = {}) => {
  const yarnInvocation = await resolveYarnInvocation();

  return await runCommand(yarnInvocation.command, [...yarnInvocation.args, ...args], options);
};

describe("run command integration", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "allure-cli-agent-"));

    await runYarnCommand(["workspace", "allure", "build"]);
  }, 240_000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("writes the full agent directory contract in the built CLI path", async () => {
    const fixtureDir = join(tempDir, "built-run");
    const outputDir = join(fixtureDir, "agent-output");
    const reportDir = join(fixtureDir, "report");
    const expectationsPath = join(fixtureDir, "expected.yaml");
    const configPath = join(fixtureDir, "allurerc.mjs");
    const emitResultsPath = join(fixtureDir, "emit-results.mjs");
    const projectGuidePath = join(fixtureDir, "docs", "allure-agent-mode.md");
    const expectationsSource = `goal: Validate built CLI agent output
task_id: cli-integration
expected:
  environments:
    - default
notes:
  - The legacy run invocation should delegate to the agent command contract.
`;
    const projectGuideSource = `# Fixture Agent Guide

- This guide belongs to the fixture cwd used by the legacy run compatibility test.
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
    },
    dashboard: {
      options: {
        reportName: "CLI Integration Dashboard"
      }
    },
    testops: {
      options: {}
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

    await mkdir(join(fixtureDir, "docs"), { recursive: true });
    await writeFile(expectationsPath, expectationsSource, "utf-8");
    await writeFile(configPath, configSource, "utf-8");
    await writeFile(emitResultsPath, emitResultsSource, "utf-8");
    await writeFile(projectGuidePath, projectGuideSource, "utf-8");

    const { stdout, stderr } = await runCommand(
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
    };
    const indexContent = await readFile(join(outputDir, "index.md"), "utf-8");
    const findingsContent = await readFile(join(outputDir, "manifest", "findings.jsonl"), "utf-8");
    const expectedCopy = await readFile(join(outputDir, "manifest", "expected.json"), "utf-8");
    const agentsGuide = await readFile(join(outputDir, "AGENTS.md"), "utf-8");
    const copiedProjectGuide = await readFile(join(outputDir, "project", "docs", "allure-agent-mode.md"), "utf-8");

    expect(runManifest.command).toBe(`node ${emitResultsPath} ${simpleResultFixture}`);
    expect(runManifest.expectations_present).toBe(true);
    expect(runManifest.paths.expected_manifest).toBe("manifest/expected.json");
    expect(runManifest.paths.project_guide).toBe("project/docs/allure-agent-mode.md");
    expect(expectedCopy).toContain('"task_id": "cli-integration"');
    expect(agentsGuide).toContain("[project guidance](project/docs/allure-agent-mode.md)");
    expect(copiedProjectGuide).toContain("# Fixture Agent Guide");
    expect(indexContent).toContain("# CLI Integration Report");
    expect(indexContent).toContain("## Expected Scope");
    expect(indexContent).toContain("## Advisory Check Summary");
    expect(indexContent).toContain("## Passed");
    expect(findingsContent).toBe("");
    expect(await pathExists(join(outputDir, "awesome"))).toBe(false);
    expect(await pathExists(join(outputDir, "dashboard"))).toBe(false);
    expect(stdout).toContain(`agent output: ${outputDir}`);
    expect(stdout).toContain(`agent expectations: ${expectationsPath}`);
    expect(stdout).toContain(`node ${emitResultsPath} ${simpleResultFixture}`);
    expect(stdout).toContain("emitted simple result");
    expect(stdout).not.toContain("process finished with code");
    expect(stdout).not.toContain("exit code ");
    expect(stdout).not.toContain("[DEP0190]");
    expect(stdout).not.toContain("NO_COLOR");
    expect(stderr).not.toContain("[DEP0190]");
    expect(stderr).not.toContain("NO_COLOR");
    expect(stderr).not.toContain("Allure TestOps");
  }, 240_000);

  it("runs the built agent command with an agent-only profile", async () => {
    const fixtureDir = join(tempDir, "built-agent");
    const homeDir = join(fixtureDir, "home");
    const outputDir = join(fixtureDir, "agent-output");
    const reportDir = join(fixtureDir, "report");
    const expectationsPath = join(fixtureDir, "expected.yaml");
    const configPath = join(fixtureDir, "allurerc.mjs");
    const emitResultsPath = join(fixtureDir, "emit-results.mjs");
    const projectGuidePath = join(fixtureDir, "docs", "allure-agent-mode.md");
    const expectationsSource = `goal: Validate built CLI agent command
task_id: cli-agent-integration
expected:
  environments:
    - default
notes:
  - The agent command should ignore configured report and export plugins.
`;
    const projectGuideSource = `# Fixture Agent Guide

- This guide belongs to the fixture cwd used by the built agent integration test.
`;
    const configSource = `
export default {
  name: "CLI Agent Report",
  output: ${JSON.stringify(reportDir)},
  plugins: {
    awesome: {
      options: {
        reportName: "CLI Agent Report"
      }
    },
    dashboard: {
      options: {
        reportName: "CLI Agent Dashboard"
      }
    },
    testops: {
      options: {}
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

    await mkdir(join(fixtureDir, "docs"), { recursive: true });
    const resolvedFixtureDir = await realpath(fixtureDir);
    const expectedStateDir = join(
      tmpdir(),
      `allure-agent-state-${createHash("sha256").update(resolvedFixtureDir).digest("hex").slice(0, 16)}`,
    );
    await writeFile(expectationsPath, expectationsSource, "utf-8");
    await writeFile(configPath, configSource, "utf-8");
    await writeFile(emitResultsPath, emitResultsSource, "utf-8");
    await writeFile(projectGuidePath, projectGuideSource, "utf-8");

    const { stdout, stderr } = await runCommand(
      process.execPath,
      [
        cliPath,
        "agent",
        "--config",
        configPath,
        "--cwd",
        fixtureDir,
        "--output",
        outputDir,
        "--expectations",
        expectationsPath,
        "--",
        "node",
        emitResultsPath,
        simpleResultFixture,
      ],
      {
        env: {
          ...process.env,
          HOME: homeDir,
        },
      },
    );
    const { stdout: latestStdout, stderr: latestStderr } = await runCommand(
      process.execPath,
      [cliPath, "agent", "latest", "--cwd", fixtureDir],
      {
        env: {
          ...process.env,
          HOME: homeDir,
        },
      },
    );
    const { stdout: stateDirStdout, stderr: stateDirStderr } = await runCommand(
      process.execPath,
      [cliPath, "agent", "state-dir", "--cwd", fixtureDir],
      {
        env: {
          ...process.env,
          HOME: homeDir,
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
    };
    const agentsGuide = await readFile(join(outputDir, "AGENTS.md"), "utf-8");
    const copiedProjectGuide = await readFile(join(outputDir, "project", "docs", "allure-agent-mode.md"), "utf-8");
    const findingsContent = await readFile(join(outputDir, "manifest", "findings.jsonl"), "utf-8");

    expect(runManifest.command).toBe(`node ${emitResultsPath} ${simpleResultFixture}`);
    expect(runManifest.expectations_present).toBe(true);
    expect(runManifest.paths.expected_manifest).toBe("manifest/expected.json");
    expect(runManifest.paths.project_guide).toBe("project/docs/allure-agent-mode.md");
    expect(agentsGuide).toContain("[project guidance](project/docs/allure-agent-mode.md)");
    expect(copiedProjectGuide).toContain("# Fixture Agent Guide");
    expect(findingsContent).toBe("");
    expect(await pathExists(join(outputDir, "awesome"))).toBe(false);
    expect(await pathExists(join(outputDir, "dashboard"))).toBe(false);
    expect(stdout).toContain(`node ${emitResultsPath} ${simpleResultFixture}`);
    expect(stdout).toContain(`agent output: ${outputDir}`);
    expect(stdout).toContain(`agent expectations: ${expectationsPath}`);
    expect(stdout).toContain("emitted simple result");
    expect(stdout).not.toContain("process finished with code");
    expect(stdout).not.toContain("exit code ");
    expect(stdout).not.toContain("[DEP0190]");
    expect(stdout).not.toContain("NO_COLOR");
    expect(stderr).not.toContain("[DEP0190]");
    expect(stderr).not.toContain("NO_COLOR");
    expect(stderr).not.toContain("Allure TestOps");
    expect(latestStdout.trim()).toBe(outputDir);
    expect(latestStderr).toBe("");
    expect(stateDirStdout.trim()).toBe(expectedStateDir);
    expect(stateDirStderr).toBe("");
  }, 240_000);

  it("supports agent select and rerun-from with the default review preset", async () => {
    const fixtureDir = join(tempDir, "agent-select-rerun");
    const homeDir = join(fixtureDir, "home");
    const previousOutputDir = join(fixtureDir, "previous-agent-output");
    const outputDir = join(fixtureDir, "agent-output");
    const reportDir = join(fixtureDir, "report");
    const configPath = join(fixtureDir, "allurerc.mjs");
    const emitResultsPath = join(fixtureDir, "emit-plan-results.mjs");
    const fixturesManifestPath = join(fixtureDir, "fixtures.json");
    const featureAFixturePath = join(fixtureDir, "feature-a-result.json");
    const featureBFixturePath = join(fixtureDir, "feature-b-result.json");
    const previousManifestDir = join(previousOutputDir, "manifest");
    const configSource = `
export default {
  name: "CLI Agent Select Report",
  output: ${JSON.stringify(reportDir)},
  plugins: {
    awesome: {
      options: {
        reportName: "CLI Agent Select Report"
      }
    }
  }
};
`.trimStart();
    const emitResultsSource = `
import { cp, mkdir, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

const fixtures = JSON.parse(await readFile(process.argv[2], "utf-8"));
const outDir = join(process.cwd(), "allure-results");
const testPlanPath = process.env.ALLURE_TESTPLAN_PATH;
const testPlan = testPlanPath ? JSON.parse(await readFile(testPlanPath, "utf-8")) : { tests: [] };
const selectors = new Set(testPlan.tests.flatMap((entry) => (entry.selector ? [entry.selector] : [])));

await mkdir(outDir, { recursive: true });

for (const fixture of fixtures) {
  if (selectors.size && !selectors.has(fixture.selector)) {
    continue;
  }

  await cp(fixture.file, join(outDir, \`\${randomUUID()}-result.json\`));
}

console.log(\`selected selectors: \${Array.from(selectors).join(",")}\`);
`.trimStart();

    await mkdir(previousManifestDir, { recursive: true });
    await writeFile(configPath, configSource, "utf-8");
    await writeFile(emitResultsPath, emitResultsSource, "utf-8");

    const baseResult = JSON.parse(await readFile(simpleResultFixture, "utf-8")) as Record<string, unknown>;
    const featureAResult = {
      ...baseResult,
      uuid: "feature-a-uuid",
      historyId: "feature-a-history",
      name: "feature A",
      fullName: "suite feature A",
      status: "passed",
      labels: [
        { name: "suite", value: "suite" },
        { name: "feature", value: "checkout" },
        { name: "priority", value: "high" },
      ],
    };
    const featureBResult = {
      ...baseResult,
      uuid: "feature-b-uuid",
      historyId: "feature-b-history",
      name: "feature B",
      fullName: "suite feature B",
      status: "passed",
      labels: [
        { name: "suite", value: "suite" },
        { name: "feature", value: "payments" },
        { name: "priority", value: "low" },
      ],
    };

    await writeJson(featureAFixturePath, featureAResult);
    await writeJson(featureBFixturePath, featureBResult);
    await writeJson(fixturesManifestPath, [
      {
        selector: "suite feature A",
        file: featureAFixturePath,
      },
      {
        selector: "suite feature B",
        file: featureBFixturePath,
      },
    ]);

    await writeJson(join(previousManifestDir, "run.json"), {
      schema_version: "allure-agent-output/v1",
      report_uuid: "previous-report",
      generated_at: "2026-04-15T18:00:00.000Z",
      command: "node prior-run",
      actual_exit_code: 0,
      original_exit_code: 0,
      exit_code: {
        original: 0,
        actual: 0,
      },
      summary: {
        stats: {
          total: 2,
          failed: 1,
          broken: 0,
          skipped: 0,
          unknown: 0,
          passed: 1,
        },
        duration_ms: {
          total: 10,
          average: 5,
          max: 5,
        },
        environments: [
          {
            environmentId: "default",
            total: 2,
            failed: 1,
            broken: 0,
            skipped: 0,
            unknown: 0,
            passed: 1,
          },
        ],
      },
      paths: {
        index_md: "index.md",
        agents_md: "AGENTS.md",
        tests_manifest: "manifest/tests.jsonl",
        findings_manifest: "manifest/findings.jsonl",
        expected_manifest: null,
        project_guide: null,
        process_logs: {
          stdout: null,
          stderr: null,
        },
      },
      expectations_present: false,
      check_summary: {
        total: 1,
        countsBySeverity: {
          high: 1,
          warning: 0,
          info: 0,
        },
        countsByCategory: {
          bootstrap: 0,
          scope: 0,
          metadata: 0,
          evidence: 1,
          smells: 0,
        },
      },
      agent_context: {
        agent_name: null,
        loop_id: null,
        task_id: null,
        conversation_id: null,
      },
    });
    await writeJsonl(join(previousManifestDir, "tests.jsonl"), [
      {
        environment_id: "default",
        history_id: "feature-a-history",
        test_result_id: "feature-a-tr",
        full_name: "suite feature A",
        package: "suite",
        labels: [
          { name: "feature", value: "checkout" },
          { name: "priority", value: "high" },
        ],
        status: "failed",
        duration_ms: 5,
        retries: 0,
        flaky: false,
        scope_match: "match",
        finding_counts: {
          total: 1,
          high: 1,
          warning: 0,
          info: 0,
        },
        markdown_path: "tests/default/feature-a.md",
        assets_dir: "tests/default/feature-a.assets",
      },
      {
        environment_id: "default",
        history_id: "feature-b-history",
        test_result_id: "feature-b-tr",
        full_name: "suite feature B",
        package: "suite",
        labels: [
          { name: "feature", value: "payments" },
          { name: "priority", value: "low" },
        ],
        status: "passed",
        duration_ms: 5,
        retries: 0,
        flaky: false,
        scope_match: "match",
        finding_counts: {
          total: 0,
          high: 0,
          warning: 0,
          info: 0,
        },
        markdown_path: "tests/default/feature-b.md",
        assets_dir: "tests/default/feature-b.assets",
      },
    ]);
    await writeJsonl(join(previousManifestDir, "findings.jsonl"), [
      {
        finding_id: "finding-feature-a",
        subject: "tests/default/feature-a.md",
        severity: "high",
        category: "evidence",
        check_name: "failed-without-useful-steps",
        message: "Feature A needs focused rerun coverage",
        explanation: "Feature A should be the only review-targeted rerun candidate.",
        evidence_paths: [],
        remediation_hint: "Rerun only feature A.",
      },
    ]);

    const { stdout: selectStdout, stderr: selectStderr } = await runCommand(
      process.execPath,
      [cliPath, "agent", "select", "--from", previousOutputDir],
      {
        env: {
          ...process.env,
          HOME: homeDir,
        },
      },
    );
    const { stdout, stderr } = await runCommand(
      process.execPath,
      [
        cliPath,
        "agent",
        "--config",
        configPath,
        "--cwd",
        fixtureDir,
        "--output",
        outputDir,
        "--rerun-from",
        previousOutputDir,
        "--",
        "node",
        emitResultsPath,
        fixturesManifestPath,
      ],
      {
        env: {
          ...process.env,
          HOME: homeDir,
        },
      },
    );

    expect(JSON.parse(selectStdout)).toEqual({
      version: "1.0",
      tests: [
        {
          selector: "suite feature A",
        },
      ],
    });
    expect(selectStderr).toBe("");
    expect(stdout).toContain("selected selectors: suite feature A");
    expect(stderr).toBe("");

    const selectedTests = (await readFile(join(outputDir, "manifest", "tests.jsonl"), "utf-8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { full_name: string });

    expect(selectedTests).toEqual([
      expect.objectContaining({
        full_name: "suite feature A",
      }),
    ]);
  }, 240_000);
});
