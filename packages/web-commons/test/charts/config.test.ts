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
  it.each(invalidOptions)("rejects invalid %s=%s", (field, value) => {
    const options: ChartOptions[] = [{ type: ChartType.StabilityDistribution, [field]: value }];

    const act = () => validateChartsOptions(options);

    expect(act).toThrow(field);
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
