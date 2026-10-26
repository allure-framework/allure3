import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { TestResult } from "@allurereport/core-api";
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
const testResult = (id: string, status = "passed", extra = {}) =>
  ({ id, name: id, status, labels: [], ...extra }) as TestResult;

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("YAML quality-gate lifecycle", () => {
  it("accumulates failure and total counts across overlapping batches and recomputes a final snapshot", async () => {
    const config = await load(`
qualityGate:
  rules:
    - failures: 1
      count: 3
  use:
    - rule: failures
      message: "\${{ 'Failures: ' + string(actual) }}"
      successMessage: 'No unexpected failures'
      validate: |
        const failed = trs.filter(tr => ['failed', 'broken'].includes(tr.status));
        const actual = Number(state.getResult() ?? 0) + failed.length;
        const testResults = failed.map(tr => tr.id);
        state.setResult(actual, testResults);
        return { success: actual <= expected, actual, testResults };
    - rule: count
      message: 'Wrong total count'
      validate: |
        const actual = Number(state.getResult() ?? 0) + trs.length;
        state.setResult(actual, []);
        return { success: actual === expected, actual, testResults: [] };
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

  it("passes metrics, history, environment and expected data to async scripts", async () => {
    const config = await load(`
qualityGate:
  rules:
    - comparison: 3
  use:
    - rule: comparison
      message: 'Metric mismatch'
      successMessage: "\${{ actual.environment + ': ' + string(actual.delta) }}"
      validate: |
        const delta = await Promise.resolve(metrics[0].value - previousHistory[0].metrics.duration);
        return { success: delta === expected, actual: { delta, environment }, testResults: [] };
`);

    const result = await new QualityGate(config.qualityGate!).validate({
      trs: [],
      metrics: [{ key: "duration", value: 5 }],
      previousHistory: [{ metrics: { duration: 2 } }],
      environment: "qa",
    });

    expect(result.results[0]).toMatchObject({
      success: true,
      actual: { delta: 3, environment: "qa" },
      message: "qa: 3",
    });
  });

  it("keeps expression-like content inside JavaScript source literal", async () => {
    const config = await load(`
qualityGate:
  rules:
    - literal: true
  use:
    - rule: literal
      message: 'Unexpected literal'
      validate: |
        return { success: true, actual: '\${{ not_an_expression }}', testResults: [] };
`);

    const result = await new QualityGate(config.qualityGate!).validate({ trs: [] });

    expect(result.results[0].actual).toBe("${{ not_an_expression }}");
  });
});
