import { describe, expect, it } from "vitest";

import { getChartSize } from "./utils";

describe("CurrentStatusChartWidget utils", () => {
  it("keeps chart size non-negative for narrow containers", () => {
    expect(getChartSize(0)).toBe(0);
    expect(getChartSize(8)).toBe(0);
    expect(getChartSize(16)).toBe(0);
  });

  it("caps chart size by the maximum pie width", () => {
    expect(getChartSize(32)).toBe(16);
    expect(getChartSize(300)).toBe(284);
    expect(getChartSize(400)).toBe(284);
  });
});
