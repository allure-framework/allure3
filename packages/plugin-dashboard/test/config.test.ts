import { ChartType, type ChartOptions } from "@allurereport/charts-api";
import { describe, expect, it } from "vitest";

import { DashboardPlugin } from "../src/plugin.js";

describe("Dashboard chart configuration", () => {
  it.each([
    ["limit", -1],
    ["stabilizationPeriod", 0],
  ] as const)("rejects invalid %s during setup", (field, value) => {
    const layout: ChartOptions[] = [{ type: ChartType.StabilityDistribution, [field]: value }];

    const act = () => new DashboardPlugin({ layout });

    expect(act).toThrow(field);
  });
});
