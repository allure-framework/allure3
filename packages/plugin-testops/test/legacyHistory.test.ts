import type { TestParameter } from "@allurereport/core-api";
import { epic, feature, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { calculateLegacyHistoryId } from "../src/utils/legacyHistory.js";

const parameter = (name: string, value: string, excluded = false): TestParameter => ({
  name,
  value,
  excluded,
  hidden: false,
  masked: false,
});

beforeEach(async () => {
  await epic("coverage");
  await feature("testops-integration");
  await story("legacy history compatibility");
});

describe("calculateLegacyHistoryId", () => {
  it("preserves an existing top-level legacy history ID from restored input", () => {
    expect(
      calculateLegacyHistoryId({
        historyId: "existing-legacy-history-id",
        sourceMetadata: { legacyTestCaseHash: "ignored-test-case-hash" },
        parameters: [],
      }),
    ).toBe("existing-legacy-history-id");
  });

  it("uses the legacy ALLURE_ID-prefixed test-case identity", () => {
    expect(
      calculateLegacyHistoryId({
        testCase: { allureId: "123", externalId: "ignored-test-id" },
        fullName: "ignored full name",
        parameters: [],
      }),
    ).toBe("094bc5de67cbc4ea04b49808c98bbf69.d41d8cd98f00b204e9800998ecf8427e");
  });

  it("prefers the exact per-result compatibility hash over shared test-case metadata", () => {
    expect(
      calculateLegacyHistoryId({
        sourceMetadata: { legacyTestCaseHash: "361dc45aacd2d2a1961554d12a2d666b" },
        testCase: { allureId: "123", externalId: "test-id" },
        parameters: [],
      }),
    ).toBe("361dc45aacd2d2a1961554d12a2d666b.d41d8cd98f00b204e9800998ecf8427e");
  });

  it("ignores the legacy -1 Allure ID sentinel and falls back to testId", () => {
    expect(
      calculateLegacyHistoryId({
        testCase: { allureId: "-1", externalId: "test-id" },
        parameters: [],
      }),
    ).toBe("361dc45aacd2d2a1961554d12a2d666b.d41d8cd98f00b204e9800998ecf8427e");
  });

  it("falls back to fullName and preserves the old unknown-value sentinel", () => {
    expect(
      calculateLegacyHistoryId({
        fullName: "suite test",
        parameters: [parameter("missing", "#___unknown_value___#")],
      }),
    ).toBe("2de31311ba8c72a631f32551de454dc9.3bf9dbcebd98256fba82c63e37384e7d");
  });

  it("uses legacy parameter sorting without deduplicating exact pairs", () => {
    expect(
      calculateLegacyHistoryId({
        testCase: { externalId: "test-id" },
        parameters: [
          parameter("argument", "second"),
          parameter("duplicate", "value"),
          parameter("excluded", "ignored", true),
          parameter("argument", "first"),
          parameter("duplicate", "value"),
        ],
      }),
    ).toBe("361dc45aacd2d2a1961554d12a2d666b.773fa12a69aa295796d79fc32f9547e3");
  });

  it("does not create legacy identity for a dynamic result", () => {
    expect(calculateLegacyHistoryId({ parameters: [] })).toBeUndefined();
  });
});
