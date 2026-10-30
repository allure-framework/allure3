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

  it.each([
    { enabled: "${{ 'false' }}" },
    { enabled: "not-an-expression" },
    { rules: [{ maxFailures: "${{ '3' }}" }] },
    { rules: [{ maxFailures: "${{ -1 }}" }] },
    { rules: [{ maxFailures: "${{ 9007199254740993 }}" }] },
    { rules: [{ newTests: "${{ 1 }}" }] },
    { rules: [{ successRate: "${{ 101 }}" }] },
    { rules: [{ metricMax: { key: "duration", value: "${{ 'ten' }}" } }] },
  ])("rejects invalid enablement or computed thresholds: %j", async (input) => {
    const result = resolve(input);

    await expect(result).rejects.toThrow("qualityGate.");
  });
});
