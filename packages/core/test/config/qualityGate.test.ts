import type { TestResult, TestStatus } from "@allurereport/core-api";
import type { Config } from "@allurereport/plugin-api";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { resolveConfig } from "../../src/config.js";
import { QualityGate, QualityGateState } from "../../src/qualityGate/qualityGate.js";
import { maxFailuresRule, minTestsCountRule } from "../../src/qualityGate/rules.js";

const resolve = async (qualityGate: Config["qualityGate"]) =>
  (await resolveConfig({ qualityGate }, { plugins: {} })).qualityGate;
const tr = (id: string, status: TestStatus = "passed", critical = false) =>
  ({
    id,
    name: `Test ${id}`,
    status,
    labels: critical ? [{ name: "severity", value: "critical" }] : [],
  }) as TestResult;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("quality-gate configuration", () => {
  it("resolves a critical-test CEL filter with fast fail through the existing gate", async () => {
    const config = await resolve({
      rules: [
        {
          id: "critical",
          maxFailures: 0,
          fastFail: true,
          filter: "${{ test.labels.exists(l, l.name == 'severity' && l.value == 'critical') }}",
        },
      ],
    });

    const result = await new QualityGate(config!).validate({
      trs: [tr("ordinary", "failed"), tr("critical", "broken", true)],
    });

    expect(result.fastFailed).toBe(true);
    expect(result.results).toMatchObject([
      { rule: "critical/maxFailures", actual: 1, success: false, testResults: ["critical"] },
    ]);
  });

  it("filters using the environment snapshot captured during configuration resolution", async () => {
    vi.stubEnv("ALLURE_QG_TEST_SEVERITY", "critical");
    const config = await resolve({
      rules: [
        {
          maxFailures: 0,
          filter:
            "${{ has(env.ALLURE_QG_TEST_SEVERITY) && test.labels.exists(l, l.name == 'severity' && l.value == env.ALLURE_QG_TEST_SEVERITY) }}",
        },
      ],
    });
    vi.stubEnv("ALLURE_QG_TEST_SEVERITY", "minor");

    const result = await new QualityGate(config!).validate({
      trs: [tr("ordinary", "failed"), tr("critical", "failed", true)],
    });

    expect(result.results[0]).toMatchObject({ actual: 1, success: false, testResults: ["critical"] });
  });

  it("inherits builtin validation and success messages while overriding the failure message", async () => {
    const config = await resolve({
      rules: [{ maxFailures: 0 }],
      use: [{ rule: "maxFailures", message: "${{ 'Failures: ' + string(actual) }}" }],
    });

    const failed = await new QualityGate(config!).validate({ trs: [tr("1", "failed")] });
    const passed = await new QualityGate(config!).validate({ trs: [] });

    expect(config!.use?.[0].validate).toBe(maxFailuresRule.validate);
    expect(failed.results[0].message).toBe("Failures: 1");
    expect(passed.results[0].message).toBe(maxFailuresRule.successMessage!({ actual: 0, expected: 0 }));
  });

  it("selects builtin names and replaces the default implementation list", async () => {
    const config = await resolve({ rules: [{ minTestsCount: 1 }], use: ["minTestsCount"] });

    const result = await new QualityGate(config!).validate({ trs: [] });

    expect(config!.use).toEqual([minTestsCountRule]);
    expect(result.results[0].success).toBe(false);
  });

  it("uses native validators and generic success messages even when the rule name is a builtin", async () => {
    const config = await resolve({
      rules: [{ maxFailures: 1 }],
      use: [
        {
          rule: "maxFailures",
          message: () => "custom failure",
          validate: async () => ({ success: true, actual: 99, testResults: [] }),
        },
      ],
    });

    const result = await new QualityGate(config!).validate({ trs: [] });

    expect(result.results[0]).toMatchObject({ success: true, actual: 99 });
    expect(result.results[0].message).toContain("The rule has been passed");
  });

  it("requires a custom failure message when overriding a builtin validator", async () => {
    const config = resolve({
      use: [{ rule: "maxFailures", validate: async () => ({ success: false, actual: 1, testResults: [] }) }],
    });

    await expect(config).rejects.toThrow("qualityGate.use[0]: a custom rule requires validate and message");
  });

  it("executes custom validators with existing state and generic success messages", async () => {
    const config = await resolve({
      rules: [{ count: 2 }],
      use: [
        {
          rule: "count",
          message: "wrong count",
          validate: async ({ trs, state, expected }) => {
            const actual = Number(state.getResult() ?? 0) + trs.length;
            state.setResult(
              actual,
              trs.map((result) => result.id),
            );
            return { success: actual === expected, actual, testResults: [] };
          },
        },
      ],
    });
    const gate = new QualityGate(config!);
    const state = new QualityGateState();

    await gate.validate({ trs: [tr("1")], state });
    const result = await gate.validate({ trs: [tr("1"), tr("2")], state });

    expect(result.results[0]).toMatchObject({ success: true, actual: 2, testResults: ["1", "2"] });
    expect(result.results[0].message).toContain("The rule has been passed");
  });

  it("preserves native callback identities", async () => {
    const filter = () => true;
    const input = { rules: [{ minTestsCount: 1, filter }], use: [minTestsCountRule] };

    const config = await resolve(input);

    expect(config!.rules?.[0].filter).toBe(filter);
    expect(config!.use?.[0]).toBe(minTestsCountRule);
    expect(input.rules[0].filter).toBe(filter);
  });

  it("falls back to the inherited message when a CEL message fails at runtime", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = await resolve({
      rules: [{ maxFailures: 0 }],
      use: [{ rule: "maxFailures", message: "${{ actual.missing }}" }],
    });

    const result = await new QualityGate(config!).validate({ trs: [tr("1", "failed")] });

    expect(result.results[0].message).toBe(maxFailuresRule.message({ actual: 1, expected: 0 }));
    expect(result.results[0].success).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("qualityGate.use[0].message"));
  });

  it("warns once and retains a failed custom outcome when its message expression cannot evaluate", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = await resolve({
      rules: [{ custom: 0 }],
      use: [
        {
          rule: "custom",
          message: "${{ actual.missing }}",
          validate: async () => ({ success: false, actual: {}, testResults: [] }),
        },
      ],
    });
    const gate = new QualityGate(config!);

    const first = await gate.validate({ trs: [] });
    const second = await gate.validate({ trs: [] });

    expect(first.results[0]).toMatchObject({ success: false, message: "Quality gate rule custom failed" });
    expect(second.results[0].success).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it.each([
    { rules: [{ maxFailures: 0, filter: "${{ test. }}" }] },
    { rules: [{ maxFailures: 0, filter: "true" }] },
    { use: ["unknownRule"] },
    { use: [{ rule: "custom", message: "missing validator" }] },
  ])("rejects invalid gate configuration with its path: %j", async (input) => {
    const result = resolve(input);

    await expect(result).rejects.toThrow("qualityGate.");
  });

  it.each([
    { use: [null] },
    { use: [{ rule: "maxFailures", message: 123 }] },
    { use: [{ message: "missing name" }] },
    { use: [{ rule: "", message: "empty name" }] },
    { use: {} },
    { rules: {} },
    { rules: [null] },
    { rules: [{ maxFailures: 0, filter: 1 }] },
    { enabled: null },
  ])("rejects malformed serialized shapes with a configuration path: %j", async (input) => {
    const result = resolve(input as unknown as Config["qualityGate"]);

    await expect(result).rejects.toThrow("qualityGate.");
  });

  it("does not turn a runtime filter error into an empty successful selection", async () => {
    const config = await resolve({ rules: [{ maxFailures: 0, filter: "${{ test.missing == true }}" }] });

    const result = new QualityGate(config!).validate({ trs: [tr("1", "failed")] });

    await expect(result).rejects.toThrow("qualityGate.rules[0].filter");
  });
});
