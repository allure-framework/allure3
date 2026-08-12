import { afterEach, describe, expect, it } from "vitest";

import { ALLURE_NO_ANALYTICS_ENV, isAnalyticsEnabled } from "../src/utils/analytics.js";

describe("isAnalyticsEnabled", () => {
  const original = process.env[ALLURE_NO_ANALYTICS_ENV];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ALLURE_NO_ANALYTICS_ENV];
    } else {
      process.env[ALLURE_NO_ANALYTICS_ENV] = original;
    }
  });

  it("defaults to enabled when option and env are unset", () => {
    delete process.env[ALLURE_NO_ANALYTICS_ENV];
    expect(isAnalyticsEnabled()).toBe(true);
  });

  it("respects analyticsEnable: false", () => {
    delete process.env[ALLURE_NO_ANALYTICS_ENV];
    expect(isAnalyticsEnabled(false)).toBe(false);
  });

  it("respects analyticsEnable: true", () => {
    delete process.env[ALLURE_NO_ANALYTICS_ENV];
    expect(isAnalyticsEnabled(true)).toBe(true);
  });

  it.each(["true", "TRUE", "1", " 1 "])(
    "disables analytics when ALLURE_NO_ANALYTICS=%s (Allure 2 parity)",
    (value) => {
      process.env[ALLURE_NO_ANALYTICS_ENV] = value;
      expect(isAnalyticsEnabled(true)).toBe(false);
      expect(isAnalyticsEnabled()).toBe(false);
    },
  );

  it("does not treat unrelated env values as opt-out", () => {
    process.env[ALLURE_NO_ANALYTICS_ENV] = "false";
    expect(isAnalyticsEnabled()).toBe(true);
    expect(isAnalyticsEnabled(false)).toBe(false);
  });
});
