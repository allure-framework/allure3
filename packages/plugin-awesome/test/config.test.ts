import { ChartType, type ChartOptions } from "@allurereport/charts-api";
import { describe, expect, it } from "vitest";

import { AwesomePlugin } from "../src/plugin.js";

describe("Awesome chart configuration", () => {
  it.each([
    ["limit", -1],
    ["stabilizationPeriod", 0],
  ] as const)("rejects invalid %s during setup", (field, value) => {
    const charts: ChartOptions[] = [{ type: ChartType.StabilityDistribution, [field]: value }];

    const act = () => new AwesomePlugin({ charts });

    expect(act).toThrow(field);
  });
});
