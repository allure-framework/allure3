import { getSuccessRate } from "@allurereport/core-api";
import { describe, expect, it } from "vite-plus/test";

import { formatChartPercentage } from "../SuccessRatePieChart/successRate";
import { getCenteredMetric, getChartSize, getPercentOf } from "./utils";

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

describe("getCenteredMetric", () => {
  it("shows the success rate for the default metric when skipped and unknown tests are present", () => {
    const data = { total: 12, passed: 6, failed: 1, broken: 1, skipped: 2, unknown: 2 };

    expect(getCenteredMetric(data)).toEqual({ kind: "successRate", percentage: "75" });
    expect(getCenteredMetric(data, "passed").percentage).toBe(formatChartPercentage(getSuccessRate(data) * 100));
  });

  it("matches the report overview for the data from the issue", () => {
    const data = { total: 3590, passed: 2720, failed: 451, broken: 319, skipped: 100 };

    expect(getCenteredMetric(data, "passed")).toEqual({ kind: "successRate", percentage: "77.93" });
  });

  it("shows zero success rate when there are no passed, failed or broken tests", () => {
    expect(getCenteredMetric({ total: 3, skipped: 3 })).toEqual({ kind: "successRate", percentage: "0" });
  });

  it("shows the share among all tests for other metrics", () => {
    const data = { total: 10, passed: 6, failed: 1, broken: 1, skipped: 2 };

    expect(getCenteredMetric(data, "skipped")).toEqual({ kind: "share", percentage: "20" });
    expect(getCenteredMetric(data, "failed")).toEqual({ kind: "share", percentage: "10" });
    expect(getCenteredMetric(data, "unknown")).toEqual({ kind: "share", percentage: "0" });
  });
});

describe("getPercentOf", () => {
  it("floors to two decimals like the report overview", () => {
    expect(getPercentOf(2720, 3590)).toBe("75.76");
    expect(getPercentOf(9999, 10000)).toBe("99.99");
    expect(getPercentOf(99999, 100000)).toBe("99.99");
    expect(getPercentOf(1, 3)).toBe("33.33");
    expect(getPercentOf(2, 3)).toBe("66.66");
  });

  it("returns whole numbers without decimals", () => {
    expect(getPercentOf(5, 10)).toBe("50");
    expect(getPercentOf(10, 10)).toBe("100");
  });

  it("returns zero for empty values", () => {
    expect(getPercentOf(0, 10)).toBe("0");
    expect(getPercentOf(5, 0)).toBe("0");
    expect(getPercentOf()).toBe("0");
  });
});
