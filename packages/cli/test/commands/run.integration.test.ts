import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { attachment, epic, feature, label, step, story } from "allure-js-commons";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

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

const attachCommandOutput = async (name: string, output: { stdout: string; stderr: string }) => {
  await attachment(`${name} stdout`, output.stdout || "<empty>", "text/plain");

  if (output.stderr) {
    await attachment(`${name} stderr`, output.stderr, "text/plain");
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

  beforeEach(async () => {
    await epic("coverage");
    await feature("cli-run");
    await story("run.integration");
    await label("coverage", "cli-run");
  });

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "allure-cli-agent-"));

    await runYarnCommand(["workspace", "allure", "build"]);
  }, 240_000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("prints the agent task map from built CLI help", async () => {
    let stdout = "";
    let stderr = "";

    await step("run built agent help", async () => {
      const helpResult = await runCommand(process.execPath, [cliPath, "agent", "--help"]);

      stdout = helpResult.stdout;
      stderr = helpResult.stderr;
      await attachCommandOutput("agent help", helpResult);
    });

    await step("verify agent task map help", async () => {
      expect(stderr).toBe("");
      expect(stdout).toContain("Multiple commands match your selection:");
      expect(stdout).toContain("Agent task map:");
      expect(stdout).toContain("allure --version");
      expect(stdout).toContain("allure agent --help");
      expect(stdout).toContain("allure agent capabilities");
      expect(stdout).toContain("allure agent --goal ... -- <command>");
      expect(stdout).toContain("allure agent inspect --dump <archive-or-glob>");
      expect(stdout).toContain("allure agent latest");
      expect(stdout).toContain("allure agent state-dir");
      expect(stdout).toContain("allure agent select --latest");
      expect(stdout).toContain("allure agent select --from <output-dir>");
      expect(stdout).toContain("allure agent --rerun-latest -- <command>");
      expect(stdout).toContain("allure agent --rerun-from <output-dir> -- <command>");
      expect(stdout).toContain("ALLURE_AGENT_STATE_DIR=<dir>");
    });
  }, 240_000);

  it("prints structured agent capabilities from the built CLI", async () => {
    let stdout = "";
    let stderr = "";

    await step("run built agent capabilities command", async () => {
      const result = await runYarnCommand(["allure", "agent", "capabilities", "--json"]);

      stdout = result.stdout;
      stderr = result.stderr;
      await attachCommandOutput("agent capabilities", result);
    });

    await step("verify built agent capabilities output", async () => {
      const capabilities = JSON.parse(stdout) as {
        schema: string;
        commands: {
          run: {
            supported: boolean;
            options: string[];
          };
          inspect: {
            supported: boolean;
            options: string[];
          };
          latest: {
            output: string[];
          };
          select: {
            supported: boolean;
            presets: string[];
            output: string[];
          };
          query: {
            supported: boolean;
          };
        };
        expectations: {
          inline: {
            expected: {
              fullNames: boolean;
            };
            forbidden: {
              labels: boolean;
              fullNames: boolean;
            };
            evidence: {
              attachmentFilters: string[];
            };
          };
        };
        output: {
          files: string[];
        };
        humanReports: {
          defaultMode: string;
          statusManifest: string;
          defaultGeneratedPath: string;
          discovery: string[];
        };
        unsupported: {
          discovery: boolean;
          localAgentService: boolean;
        };
      };

      expect(stderr).toBe("");
      expect(capabilities.schema).toBe("allure-agent-capabilities/v1");
      expect(capabilities.commands.run.supported).toBe(true);
      expect(capabilities.commands.inspect.supported).toBe(true);
      expect(capabilities.commands.inspect.options).toContain("--dump");
      expect(capabilities.commands.inspect.options).toContain("--config");
      expect(capabilities.commands.inspect.options).toContain("--output");
      expect(capabilities.commands.inspect.options).toContain("--report");
      expect(capabilities.commands.inspect.options).toContain("--report-name");
      expect(capabilities.commands.inspect.options).toContain("--history-limit");
      expect(capabilities.commands.inspect.options).toContain("--hide-labels");
      expect(capabilities.commands.run.options).toContain("--report");
      expect(capabilities.commands.run.options).toContain("--expect-test");
      expect(capabilities.commands.latest.output).toEqual(["agent output: <dir>", "agent index: <dir>/index.md"]);
      expect(capabilities.commands.select.supported).toBe(true);
      expect(capabilities.commands.select.output).toEqual([
        "stdout-testplan-json",
        "file-testplan-json",
        "file-summary",
      ]);
      expect(capabilities.commands.select.presets).toEqual(["review", "failed", "unsuccessful", "all"]);
      expect(capabilities.commands.query.supported).toBe(true);
      expect(capabilities.expectations.inline.expected.fullNames).toBe(true);
      expect(capabilities.expectations.inline.forbidden.labels).toBe(true);
      expect(capabilities.expectations.inline.forbidden.fullNames).toBe(false);
      expect(capabilities.expectations.inline.evidence.attachmentFilters).toEqual(["name", "content-type"]);
      expect(capabilities.output.files).toContain("manifest/run.json");
      expect(capabilities.output.files).toContain("manifest/human-report.json");
      expect(capabilities.output.files).toContain("awesome/index.html");
      expect(capabilities.humanReports.defaultMode).toBe("auto");
      expect(capabilities.humanReports.statusManifest).toBe("manifest/human-report.json");
      expect(capabilities.humanReports.defaultGeneratedPath).toBe("awesome/index.html");
      expect(capabilities.humanReports.discovery).toEqual(
        expect.arrayContaining([
          expect.stringContaining("allure agent latest"),
          expect.stringContaining("If the status is `generated`"),
        ]),
      );
      expect(capabilities.unsupported.discovery).toBe(true);
      expect(capabilities.unsupported).not.toHaveProperty("query");
      expect(capabilities.unsupported.localAgentService).toBe(true);
    });
  }, 240_000);

  it("runs the built agent command with default human report output", async () => {
    const fixtureDir = join(tempDir, "built-agent");
    const homeDir = join(fixtureDir, "home");
    const outputDir = join(fixtureDir, "agent-output");
    const reportDir = join(fixtureDir, "report");
    const expectationsPath = join(fixtureDir, "expected.yaml");
    const configPath = join(fixtureDir, "allurerc.mjs");
    const emitResultsPath = join(fixtureDir, "emit-results.mjs");
    const expectationsSource = `goal: Validate built CLI agent command
task_id: cli-agent-integration
expected:
  environments:
    - default
notes:
  - The agent command should generate the default single-file human report but ignore configured export plugins.
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

    let expectedStateDir = "";
    let stdout = "";
    let stderr = "";
    let latestStdout = "";
    let latestStderr = "";
    let stateDirStdout = "";
    let stateDirStderr = "";

    await step("prepare built agent fixture", async () => {
      await mkdir(fixtureDir, { recursive: true });
      expectedStateDir = join(tmpdir(), "allure-agent-state");
      await writeFile(expectationsPath, expectationsSource, "utf-8");
      await writeFile(configPath, configSource, "utf-8");
      await writeFile(emitResultsPath, emitResultsSource, "utf-8");
      await attachment(
        "fixture paths",
        JSON.stringify({ fixtureDir, outputDir, expectationsPath, expectedStateDir }, null, 2),
        "application/json",
      );
    });

    await step("run built agent command and state commands", async () => {
      const runResult = await runCommand(
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
      stdout = runResult.stdout;
      stderr = runResult.stderr;
      await attachCommandOutput("agent command", runResult);

      const latestResult = await runCommand(process.execPath, [cliPath, "agent", "latest", "--cwd", fixtureDir], {
        env: {
          ...process.env,
          HOME: homeDir,
        },
      });
      latestStdout = latestResult.stdout;
      latestStderr = latestResult.stderr;
      await attachCommandOutput("agent latest", latestResult);

      const stateDirResult = await runCommand(process.execPath, [cliPath, "agent", "state-dir", "--cwd", fixtureDir], {
        env: {
          ...process.env,
          HOME: homeDir,
        },
      });
      stateDirStdout = stateDirResult.stdout;
      stateDirStderr = stateDirResult.stderr;
      await attachCommandOutput("agent state-dir", stateDirResult);
    });

    await step("verify built agent output contract", async () => {
      await expect(stat(join(outputDir, "index.md"))).resolves.toBeTruthy();
      await expect(stat(join(outputDir, "AGENTS.md"))).resolves.toBeTruthy();
      await expect(stat(join(outputDir, "manifest", "run.json"))).resolves.toBeTruthy();
      await expect(stat(join(outputDir, "manifest", "tests.jsonl"))).resolves.toBeTruthy();
      await expect(stat(join(outputDir, "manifest", "findings.jsonl"))).resolves.toBeTruthy();
      await expect(stat(join(outputDir, "manifest", "human-report.json"))).resolves.toBeTruthy();
      await expect(stat(join(outputDir, "awesome", "index.html"))).resolves.toBeTruthy();

      const runManifest = JSON.parse(await readFile(join(outputDir, "manifest", "run.json"), "utf-8")) as {
        command: string | null;
        expectations_present: boolean;
        paths: {
          expected_manifest: string | null;
          human_report_manifest: string | null;
        };
        human_report: {
          mode: string;
          status: string;
          result_count: number | null;
          threshold: number;
          path: string | null;
          reports: Array<{ plugin_id: string; path: string }>;
        } | null;
      };
      const humanReportManifest = JSON.parse(
        await readFile(join(outputDir, "manifest", "human-report.json"), "utf-8"),
      ) as NonNullable<typeof runManifest.human_report>;
      const agentsGuide = await readFile(join(outputDir, "AGENTS.md"), "utf-8");
      const indexMarkdown = await readFile(join(outputDir, "index.md"), "utf-8");
      const findingsContent = await readFile(join(outputDir, "manifest", "findings.jsonl"), "utf-8");

      expect(runManifest.command).toBe(`node ${emitResultsPath} ${simpleResultFixture}`);
      expect(runManifest.expectations_present).toBe(true);
      expect(runManifest.paths.expected_manifest).toBe("manifest/expected.json");
      expect(runManifest.paths.human_report_manifest).toBe("manifest/human-report.json");
      expect(runManifest.human_report).toEqual(humanReportManifest);
      expect(humanReportManifest).toEqual(
        expect.objectContaining({
          mode: "auto",
          status: "generated",
          result_count: 1,
          threshold: 1000,
          path: "awesome/index.html",
          reports: [{ plugin_id: "awesome", path: "awesome/index.html" }],
        }),
      );
      expect(agentsGuide).toContain("## Command Task Map");
      expect(agentsGuide).toContain("manifest/run.json");
      expect(indexMarkdown).toContain("## Human Report");
      expect(indexMarkdown).toContain("- Status: generated");
      expect(indexMarkdown).toContain("- Path: [awesome/index.html](awesome/index.html)");
      expect(await pathExists(join(outputDir, "project"))).toBe(false);
      expect(findingsContent).toBe("");
      expect(await pathExists(join(outputDir, "dashboard"))).toBe(false);
      expect(stdout).toContain(`node ${emitResultsPath} ${simpleResultFixture}`);
      expect(stdout).toContain(`agent output: ${outputDir}`);
      expect(stdout).toContain(`agent index: ${join(outputDir, "index.md")}`);
      expect(stdout).toContain(`agent expectations: ${expectationsPath}`);
      expect(stdout).toContain("emitted simple result");
      expect(stdout).not.toContain("process finished with code");
      expect(stdout).not.toContain("exit code ");
      expect(stdout).not.toContain("[DEP0190]");
      expect(stdout).not.toContain("NO_COLOR");
      expect(stderr).not.toContain("[DEP0190]");
      expect(stderr).not.toContain("NO_COLOR");
      expect(stderr).not.toContain("Allure TestOps");
      expect(latestStdout).toContain(`agent output: ${outputDir}`);
      expect(latestStdout).toContain(`agent index: ${join(outputDir, "index.md")}`);
      expect(latestStderr).toBe("");
      expect(stateDirStdout.trim()).toBe(expectedStateDir);
      expect(stateDirStderr).toBe("");
    });
  }, 240_000);

  it("runs agent mode with --expect-test to require a newly added test", async () => {
    const fixtureDir = join(tempDir, "agent-expect-test");
    const homeDir = join(fixtureDir, "home");
    const outputDir = join(fixtureDir, "agent-output");
    const reportDir = join(fixtureDir, "report");
    const configPath = join(fixtureDir, "allurerc.mjs");
    const emitResultsPath = join(fixtureDir, "emit-new-test-result.mjs");
    const resultFixturePath = join(fixtureDir, "new-test-result.json");
    const expectedFullName = "agent flow reports the newly added test";
    const configSource = `
export default {
  name: "CLI Agent Expect Test Report",
  output: ${JSON.stringify(reportDir)}
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
console.log("emitted newly added test result");
`.trimStart();

    let stdout = "";
    let stderr = "";

    await step("prepare new test fixture", async () => {
      await mkdir(fixtureDir, { recursive: true });
      const baseResult = JSON.parse(await readFile(simpleResultFixture, "utf-8")) as Record<string, unknown>;
      const expectedResult = {
        ...baseResult,
        uuid: "agent-expect-test-uuid",
        historyId: "agent-expect-test-history",
        name: "reports the newly added test",
        fullName: expectedFullName,
        status: "passed",
        labels: [
          { name: "suite", value: "agent flow" },
          { name: "feature", value: "expect-test" },
        ],
      };

      await writeFile(configPath, configSource, "utf-8");
      await writeFile(emitResultsPath, emitResultsSource, "utf-8");
      await writeJson(resultFixturePath, expectedResult);
      await attachment(
        "expect-test fixture",
        JSON.stringify({ fixtureDir, outputDir, expectedFullName }, null, 2),
        "application/json",
      );
    });

    await step("run built agent command with expected full test name", async () => {
      const runResult = await runCommand(
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
          "--goal",
          "Validate newly added test is reported",
          "--expect-tests",
          "1",
          "--expect-test",
          expectedFullName,
          "--",
          "node",
          emitResultsPath,
          resultFixturePath,
        ],
        {
          env: {
            ...process.env,
            HOME: homeDir,
          },
        },
      );

      stdout = runResult.stdout;
      stderr = runResult.stderr;
      await attachCommandOutput("agent expect-test", runResult);
    });

    await step("verify expect-test output", async () => {
      const expectedManifest = JSON.parse(await readFile(join(outputDir, "manifest", "expected.json"), "utf-8")) as {
        expected: {
          full_names?: string[];
          test_count?: number;
        };
      };
      const runManifest = JSON.parse(await readFile(join(outputDir, "manifest", "run.json"), "utf-8")) as {
        expectations_present: boolean;
      };
      const tests = (await readFile(join(outputDir, "manifest", "tests.jsonl"), "utf-8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { full_name: string });
      const findingsContent = await readFile(join(outputDir, "manifest", "findings.jsonl"), "utf-8");
      const indexMarkdown = await readFile(join(outputDir, "index.md"), "utf-8");

      expect(runManifest.expectations_present).toBe(true);
      expect(expectedManifest.expected.test_count).toBe(1);
      expect(expectedManifest.expected.full_names).toEqual([expectedFullName]);
      expect(tests).toEqual([
        expect.objectContaining({
          full_name: expectedFullName,
        }),
      ]);
      expect(findingsContent).toBe("");
      expect(indexMarkdown).toContain(expectedFullName);
      expect(stdout).toContain("agent expectations: CLI options");
      expect(stdout).toContain("emitted newly added test result");
      expect(stderr).toBe("");
    });
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
    const selectedTestPlanPath = join(fixtureDir, "selected-testplan.json");
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

    await step("prepare previous agent output and rerun fixtures", async () => {
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
      await attachment(
        "previous run summary",
        JSON.stringify({ previousOutputDir, selected: "suite feature A", skipped: "suite feature B" }, null, 2),
        "application/json",
      );
    });

    let selectStdout = "";
    let selectStderr = "";
    let selectFileStdout = "";
    let selectFileStderr = "";
    let stdout = "";
    let stderr = "";

    await step("select tests and rerun built agent command", async () => {
      const selectResult = await runCommand(
        process.execPath,
        [cliPath, "agent", "select", "--from", previousOutputDir],
        {
          env: {
            ...process.env,
            HOME: homeDir,
          },
        },
      );
      selectStdout = selectResult.stdout;
      selectStderr = selectResult.stderr;
      await attachCommandOutput("agent select", selectResult);

      const selectFileResult = await runCommand(
        process.execPath,
        [cliPath, "agent", "select", "--from", previousOutputDir, "--output", selectedTestPlanPath],
        {
          env: {
            ...process.env,
            HOME: homeDir,
          },
        },
      );
      selectFileStdout = selectFileResult.stdout;
      selectFileStderr = selectFileResult.stderr;
      await attachCommandOutput("agent select output file", selectFileResult);

      const runResult = await runCommand(
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
      stdout = runResult.stdout;
      stderr = runResult.stderr;
      await attachCommandOutput("agent rerun-from", runResult);
    });

    await step("verify selected rerun output", async () => {
      expect(JSON.parse(selectStdout)).toEqual({
        version: "1.0",
        tests: [
          {
            selector: "suite feature A",
          },
        ],
      });
      expect(selectStderr).toBe("");
      expect(JSON.parse(await readFile(selectedTestPlanPath, "utf-8"))).toEqual({
        version: "1.0",
        tests: [
          {
            selector: "suite feature A",
          },
        ],
      });
      expect(selectFileStdout).toContain(`agent testplan: ${selectedTestPlanPath}`);
      expect(selectFileStdout).toContain(`agent selection source: ${previousOutputDir}`);
      expect(selectFileStdout).toContain("agent selection preset: review");
      expect(selectFileStdout).toContain("agent selection tests: 1");
      expect(selectFileStderr).toBe("");
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
    });
  }, 240_000);
});
