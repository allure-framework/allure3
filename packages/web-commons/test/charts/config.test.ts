import { ChartType, type ChartOptions } from "@allurereport/charts-api";
import { describe, expect, it } from "vitest";

import { validateChartsOptions } from "../../src/charts/config.js";

const invalidOptions = [
  ["limit", -1],
  ["limit", 1.5],
  ["limit", Number.NaN],
  ["limit", Number.POSITIVE_INFINITY],
  ["stabilizationPeriod", 0],
  ["stabilizationPeriod", -1],
  ["stabilizationPeriod", 1.5],
  ["stabilizationPeriod", Number.NaN],
  ["stabilizationPeriod", Number.POSITIVE_INFINITY],
] as const;

describe("chart configuration", () => {
  it.each([
    ["algorithm", "failure-rate"],
    ["retryFailureThreshold", Number.POSITIVE_INFINITY],
    ["retryFailureThreshold", -0.1],
    ["retryFailureThreshold", 1.1],
    ["retryFailureThreshold", "0.1"],
  ])("rejects invalid scoring setting %s=%s", (field, value) => {
    const options = [{ type: ChartType.StabilityDistribution, [field]: value }] as ChartOptions[];

    expect(() => validateChartsOptions(options)).toThrow(field);
  });
  it("accepts retry failure-rate cutoffs independently of the group threshold", () => {
    const options: ChartOptions[] = [
      {
        type: ChartType.StabilityDistribution,
        algorithm: "retry-failure-rate",
        retryFailureThreshold: 0,
        threshold: 90,
      },
      {
        type: ChartType.StabilityDistribution,
        algorithm: "retry-failure-rate",
        retryFailureThreshold: 1,
        threshold: 50,
      },
    ];

    const act = () => validateChartsOptions(options);

    expect(act).not.toThrow();
  });
  it.each(invalidOptions)("rejects invalid %s=%s", (field, value) => {
    const options: ChartOptions[] = [{ type: ChartType.StabilityDistribution, [field]: value }];

    const act = () => validateChartsOptions(options);

    expect(act).toThrow(field);
  });

  it.each([{ limit: 5 }, { limit: 3, stabilizationPeriod: 3 }, { limit: 3, stabilizationPeriod: 4 }])(
    "rejects stabilization periods that cannot fit below bounded limit $limit",
    (settings) => {
      const options: ChartOptions[] = [{ type: ChartType.StabilityDistribution, ...settings }];

      expect(() => validateChartsOptions(options)).toThrow("stabilityDistribution.stabilizationPeriod");
    },
  );
  it.each([
    { limit: 6 },
    { limit: 3, stabilizationPeriod: 2 },
    { limit: 0, stabilizationPeriod: 100 },
    { stabilizationPeriod: 100 },
  ])("accepts compatible bounded, unlimited and disabled limit $limit", (settings) => {
    const options: ChartOptions[] = [{ type: ChartType.StabilityDistribution, ...settings }];

    expect(() => validateChartsOptions(options)).not.toThrow();
  });
  it("accepts defaults, disabled charts, and valid stability settings", () => {
    const options: ChartOptions[] = [
      { type: ChartType.StabilityDistribution },
      { type: ChartType.StabilityDistribution, limit: 0, stabilizationPeriod: 1 },
      { type: ChartType.StabilityDistribution, limit: 10, stabilizationPeriod: 5 },
      { type: ChartType.CurrentStatus },
    ];
    const snapshot = structuredClone(options);

    const act = () => validateChartsOptions(options);

    expect(act).not.toThrow();
    expect(options).toEqual(snapshot);
  });
});
