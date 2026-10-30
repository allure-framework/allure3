import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { TestResult, TestStatus } from "@allurereport/core-api";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { readConfig } from "../../src/config.js";
import { QualityGate, QualityGateState } from "../../src/qualityGate/qualityGate.js";

const directories: string[] = [];
const load = async (source: string) => {
  const cwd = await mkdtemp(join(tmpdir(), "allure-quality-gate-config-"));
  directories.push(cwd);
  await writeFile(join(cwd, "allurerc.yml"), source);
  return readConfig(cwd, undefined, { plugins: {} });
};
const loadJavaScript = async (source: string) => {
  const cwd = await mkdtemp(join(tmpdir(), "allure-quality-gate-config-"));
  directories.push(cwd);
  await writeFile(join(cwd, "allurerc.mjs"), source);
  return readConfig(cwd, undefined, { plugins: {} });
};
const testResult = (id: string, status: TestStatus = "passed", extra: Partial<TestResult> = {}): TestResult => ({
  id,
  name: id,
  status,
  testCaseHash: null,
  parametersHash: "",
  environmentHash: null,
  retryHash: null,
  flaky: false,
  muted: false,
  known: false,
  isRetry: false,
  labels: [],
  parameters: [],
  links: [],
  steps: [],
  sourceMetadata: { readerId: "test", metadata: {} },
  ...extra,
});

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("quality-gate configuration lifecycle", () => {
  it.each([
    {
      field: "id",
      type: "string",
      source: `
qualityGate:
  rules:
    - id: 42
      maxFailures: 0
`,
    },
    {
      field: "fastFail",
      type: "boolean",
      source: `
qualityGate:
  rules:
    - maxFailures: 0
      fastFail: "\${{ env.CI == 'true' }}"
`,
    },
  ])("rejects a non-$type ruleset $field", async ({ source, field, type }) => {
    const config = load(source);

    await expect(config).rejects.toThrow(`Invalid configuration at qualityGate.rules[0].${field}: expected a ${type}`);
  });

  it("requires validator functions in rule definitions", async () => {
    const config = load(`
qualityGate:
  use:
    - rule: custom
      message: 'Custom rule failed'
      validate: validator
`);

    await expect(config).rejects.toThrow("qualityGate.use[0].validate: expected a validator function");
  });

  it.each([
    {
      registry: "default",
      rule: "maxFailurez",
      source: `
qualityGate:
  rules:
    - maxFailurez: 0
`,
    },
    {
      registry: "restricted",
      rule: "maxFailures",
      source: `
qualityGate:
  use:
    - minTestsCount
  rules:
    - maxFailures: 0
`,
    },
    {
      registry: "empty",
      rule: "maxFailures",
      source: `
qualityGate:
  use: []
  rules:
    - maxFailures: 0
`,
    },
  ])("rejects rules absent from the $registry registry during config loading", async ({ source, rule }) => {
    const config = load(source);

    await expect(config).rejects.toThrow(
      `Invalid configuration at qualityGate.rules[0].${rule}: no implementation registered for rule "${rule}"`,
    );
  });

  it("accumulates failure and total counts across overlapping batches and recomputes a final snapshot", async () => {
    const config = await load(`
qualityGate:
  rules:
    - maxFailures: 1
      minTestsCount: 3
  use:
    - rule: maxFailures
      message: "\${{ 'Failures: ' + string(actual) }}"
      successMessage: 'No unexpected failures'
    - minTestsCount
`);
    const gate = new QualityGate(config.qualityGate!);
    const state = new QualityGateState();
    const first = testResult("1");
    const failed = testResult("2", "failed");
    const broken = testResult("3", "broken");
    const retry = testResult("retry", "failed", { isRetry: true });
    const ignored = testResult("ignored", "failed", { resolution: "muted" });

    const initial = await gate.validate({ trs: [first, failed], state });
    const live = await gate.validate({ trs: [failed, broken, retry, ignored], state });
    const final = await gate.validate({ trs: [first, failed, broken, retry, ignored] });
    const rerun = await gate.validate({ trs: [first, failed], state: new QualityGateState() });

    expect(initial.results).toMatchObject([
      { actual: 1, success: true, message: "No unexpected failures" },
      { actual: 2, success: false },
    ]);
    expect(live.results).toMatchObject([
      { actual: 2, success: false, testResults: ["2", "3"], message: "Failures: 2" },
      { actual: 3, success: true },
    ]);
    expect(final.results).toMatchObject([
      { actual: 2, success: false, testResults: ["2", "3"] },
      { actual: 3, success: true },
    ]);
    expect(rerun.results).toMatchObject([
      { actual: 1, success: true },
      { actual: 2, success: false },
    ]);
  });

  it("loads folded filters and stops after a failed critical ruleset", async () => {
    const config = await load(`
qualityGate:
  rules:
    - id: critical
      maxFailures: 0
      fastFail: true
      filter: >-
        \${{ test.labels.exists(l,
          l.name == 'severity' && l.value == 'critical') }}
    - minTestsCount: 100
`);

    const result = await new QualityGate(config.qualityGate!).validate({
      trs: [
        testResult("ordinary", "failed"),
        testResult("critical", "failed", { labels: [{ name: "severity", value: "critical" }] }),
      ],
    });

    expect(result.fastFailed).toBe(true);
    expect(result.results).toMatchObject([{ rule: "critical/maxFailures", actual: 1, testResults: ["critical"] }]);
    expect(result.results).toHaveLength(1);
  });

  it("loads async native validators with metrics, history and environment from JavaScript configuration", async () => {
    const config = await loadJavaScript(`
export default {
  qualityGate: {
    rules: [{ comparison: 3 }],
    use: [{
      rule: 'comparison',
      message: 'Metric mismatch',
      successMessage: "\${{ actual.environment + ': ' + string(actual.delta) }}",
      validate: async ({ metrics, previousHistory, environment, expected }) => {
        const delta = await Promise.resolve(metrics[0].value - previousHistory[0].metrics.duration);
        return { success: delta === expected, actual: { delta, environment }, testResults: [] };
      },
    }],
  },
};
`);

    const result = await new QualityGate(config.qualityGate!).validate({
      trs: [],
      metrics: [{ id: "duration", key: "duration", value: 5, start: 0, stop: 5 }],
      previousHistory: [{ metrics: { duration: 2 } }],
      environment: "qa",
    });

    expect(result.results[0]).toMatchObject({
      success: true,
      actual: { delta: 3, environment: "qa" },
      message: "qa: 3",
    });
  });
});
