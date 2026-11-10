import type { Config } from "@allurereport/plugin-api";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { resolveConfig } from "../../src/config.js";

const resolve = async (qualityGate: Config["qualityGate"]) =>
  (await resolveConfig({ qualityGate }, { plugins: {} })).qualityGate;

afterEach(() => vi.unstubAllEnvs());

describe("quality-gate load-time expressions", () => {
  it("uses a fallback when an environment value is absent", async () => {
    vi.stubEnv("ALLURE_TEST_MAX_FAILURES", undefined);

    const config = await resolve({
      rules: [{ maxFailures: "${{ has(env.ALLURE_TEST_MAX_FAILURES) ? double(env.ALLURE_TEST_MAX_FAILURES) : 5.0 }}" }],
    });

    expect(config!.rules?.[0].maxFailures).toBe(5);
  });

  it("converts an environment value without interpreting other strings", async () => {
    vi.stubEnv("ALLURE_TEST_MAX_FAILURES", "3");

    const config = await resolve({
      rules: [{ id: "literal-id", maxFailures: "${{ int(env.ALLURE_TEST_MAX_FAILURES) }}", allTestsContainEnv: "qa" }],
    });

    expect(config!.rules?.[0]).toMatchObject({ id: "literal-id", maxFailures: 3, allTestsContainEnv: "qa" });
  });

  it("reports the threshold path when a numeric environment value cannot be converted", async () => {
    vi.stubEnv("ALLURE_TEST_MAX_FAILURES", "abc");

    const config = resolve({
      rules: [{ maxFailures: "${{ int(env.ALLURE_TEST_MAX_FAILURES) }}" }],
    });

    await expect(config).rejects.toThrow("qualityGate.rules[0].maxFailures");
  });

  it("resolves nested metric and custom expected structures", async () => {
    const config = await resolve({
      rules: [
        {
          metricMax: { key: "duration", value: "${{ 10 }}" },
          custom: { limit: "${{ 2 }}", names: "${{ ['qa', 'prod'] }}" },
          limits: "${{ {'lower': 2, 'upper': 3} }}",
        },
      ],
      use: [
        "metricMax",
        {
          rule: "custom",
          message: "Custom threshold exceeded",
          validate: async ({ expected }) => ({ success: true, actual: expected, testResults: [] }),
        },
        {
          rule: "limits",
          message: "Limits exceeded",
          validate: async ({ expected }) => ({ success: true, actual: expected, testResults: [] }),
        },
      ],
    });

    expect(config!.rules?.[0]).toMatchObject({
      metricMax: { key: "duration", value: 10 },
      custom: { limit: 2, names: ["qa", "prod"] },
      limits: { lower: 2, upper: 3 },
    });
  });

  it.each([false, "${{ has(env.ALLURE_TEST_GATE) && env.ALLURE_TEST_GATE == 'true' }}"])(
    "preserves disabled gates without evaluating thresholds: %s",
    async (enabled) => {
      vi.stubEnv("ALLURE_TEST_GATE", "false");
      vi.stubEnv("ALLURE_DISABLED_MIN_TESTS", undefined);

      const config = await resolve({
        enabled,
        rules: [{ minTestsCount: "${{ int(env.ALLURE_DISABLED_MIN_TESTS) }}" }],
      });

      expect(config).toEqual({ enabled: false });
    },
  );

  it("enables a gate from an environment condition", async () => {
    vi.stubEnv("ALLURE_TEST_GATE", "1");

    const config = await resolve({
      enabled: "${{ has(env.ALLURE_TEST_GATE) && env.ALLURE_TEST_GATE != '' }}",
      rules: [{ maxFailures: 0 }],
    });

    expect(config!.rules).toEqual([{ maxFailures: 0 }]);
  });

  it("resolves array leaves and environment-specific built-in values", async () => {
    const config = await resolve({
      rules: [
        {
          environmentsTested: ["${{ 'qa' }}", "prod"],
          allTestsContainEnv: "${{ 'qa' }}",
          newTests: "${{ false }}",
          metricMin: { key: "duration", value: "${{ 1.0 }}", title: "Duration", unit: "ms" },
        },
      ],
    });

    expect(config!.rules?.[0]).toMatchObject({
      environmentsTested: ["qa", "prod"],
      allTestsContainEnv: "qa",
      newTests: false,
      metricMin: { key: "duration", value: 1, title: "Duration", unit: "ms" },
    });
  });

  it("validates custom expected structures against the selected implementation rather than a namesake builtin", async () => {
    const config = await resolve({
      rules: [{ maxFailures: "${{ {'limit': 2} }}" }],
      use: [
        {
          rule: "maxFailures",
          message: "custom",
          validate: async ({ expected }) => ({ success: true, actual: expected, testResults: [] }),
        },
      ],
    });

    expect(config!.rules?.[0].maxFailures).toEqual({ limit: 2 });
  });

  it("rejects a computed success rate above one at the threshold path", async () => {
    const config = resolve({ rules: [{ successRate: "${{ 1.5 }}" }] });

    await expect(config).rejects.toThrow(
      "Invalid configuration at qualityGate.rules[0].successRate: computed value does not match the successRate rule's expected type or range",
    );
  });

  it.each([0, 1])("accepts the success-rate boundary %s", async (rate) => {
    const config = await resolve({ rules: [{ successRate: `\${{ ${rate} }}` }] });

    expect(config!.rules?.[0].successRate).toBe(rate);
  });

  it.each([
    {
      input: { enabled: "${{ unknown }}" },
      path: "qualityGate.enabled",
      detail: "Invalid expression",
    },
    {
      input: { rules: [{ maxFailures: "${{ env. }}" }] },
      path: "qualityGate.rules[0].maxFailures",
      detail: "Invalid expression",
    },
    {
      input: { rules: [{ maxFailures: "${{ int(env.ALLURE_TEST_MISSING_THRESHOLD) }}" }] },
      path: "qualityGate.rules[0].maxFailures",
      detail: "Invalid expression",
    },
    {
      input: { rules: [{ maxFailures: "${{ 9007199254740993 }}" }] },
      path: "qualityGate.rules[0].maxFailures",
      detail: "CEL integer exceeds JavaScript's safe integer range",
    },
    {
      input: { rules: [{ metricMax: { key: "duration", value: "${{ int(env.ALLURE_TEST_MISSING_THRESHOLD) }}" } }] },
      path: 'qualityGate.rules[0].metricMax["value"]',
      detail: "Invalid expression",
    },
    {
      input: { rules: [{ metricMax: { key: "duration", value: "${{ 10 }}", unit: undefined } }] },
      path: "qualityGate.rules[0].metricMax",
      detail: "expected JSON-compatible data without cycles",
    },
    {
      input: { rules: [{ maxFailures: "${{ -1 }}" }] },
      path: "qualityGate.rules[0].maxFailures",
      detail: "computed value does not match",
    },
  ])("reports $path once for $input", async ({ input, path, detail }) => {
    vi.stubEnv("ALLURE_TEST_MISSING_THRESHOLD", undefined);

    const error = await resolve(input).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(detail);
    expect((error as Error).message.split(path)).toHaveLength(2);
  });

  it.each([
    { enabled: "${{ 'false' }}" },
    { enabled: "false" },
    { rules: [{ maxFailures: "${{ '3' }}" }] },
    { rules: [{ newTests: "${{ 1 }}" }] },
    { rules: [{ metricMax: { key: "duration", value: "${{ 'ten' }}" } }] },
  ])("rejects invalid enablement or computed thresholds: %j", async (input) => {
    const result = resolve(input);

    await expect(result).rejects.toThrow("qualityGate.");
  });
});
