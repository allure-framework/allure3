import { attachment, step } from "allure-js-commons";
import { describe, expect, it } from "vitest";

import { getSuccessRate, getSuccessRateTotal } from "../../src/utils/successRate.js";

describe("success rate eligibility", () => {
  it.each([
    { name: "issue 3489", stats: { total: 633, passed: 493, failed: 45, skipped: 95 }, eligible: 538, rate: 493 / 538 },
    {
      name: "all five statuses",
      stats: { total: 12, passed: 2, failed: 1, broken: 1, skipped: 3, unknown: 5 },
      eligible: 4,
      rate: 0.5,
    },
    { name: "only passed and excluded", stats: { total: 3, passed: 1, skipped: 1, unknown: 1 }, eligible: 1, rate: 1 },
    { name: "no passes", stats: { total: 3, failed: 1, broken: 1, skipped: 1 }, eligible: 2, rate: 0 },
    { name: "skipped only", stats: { total: 2, skipped: 2 }, eligible: 0, rate: 0 },
    { name: "unknown only", stats: { total: 2, unknown: 2 }, eligible: 0, rate: 0 },
    { name: "empty", stats: { total: 0 }, eligible: 0, rate: 0 },
  ])("$name", async ({ stats, eligible, rate }) => {
    const before = { ...stats };

    await attachment("input and expected metric", JSON.stringify({ stats, eligible, rate }), "application/json");
    await step("Count eligible statuses and preserve report totals", () => {
      expect(getSuccessRateTotal(stats)).toBe(eligible);
      expect(getSuccessRate(stats)).toBe(rate);
      expect(stats).toEqual(before);
    });
  });
});
