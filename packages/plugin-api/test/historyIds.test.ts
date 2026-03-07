import { type TestParameter, fallbackTestCaseIdLabelName } from "@allurereport/core-api";
import { describe, expect, it } from "vitest";

import { getFallbackHistoryId, getHistoryIdCandidates, md5, stringifyHistoryParams } from "../src/index.js";

describe("historyIds", () => {
  it("stringifyHistoryParams should sort and exclude parameters", () => {
    const parameters: TestParameter[] = [
      { name: "b", value: "2" },
      { name: "a", value: "1" },
      { name: "c", value: "3", excluded: true },
    ];

    expect(stringifyHistoryParams(parameters)).toBe("a:1,b:2");
  });

  it("getFallbackHistoryId should build fallback history id from label and params", () => {
    const fallbackTestCaseId = md5("legacy-test-case-id");
    const fallbackHistoryId = getFallbackHistoryId({
      labels: [{ name: fallbackTestCaseIdLabelName, value: fallbackTestCaseId }],
      parameters: [
        { name: "z", value: "9" },
        { name: "a", value: "1" },
      ],
    });

    expect(fallbackHistoryId).toBe(`${fallbackTestCaseId}.${md5("a:1,z:9")}`);
  });

  it("getHistoryIdCandidates should return primary and fallback history ids in order", () => {
    const fallbackTestCaseId = md5("legacy-test-case-id");
    const primaryHistoryId = "primary-history-id";

    expect(
      getHistoryIdCandidates({
        historyId: primaryHistoryId,
        labels: [{ name: fallbackTestCaseIdLabelName, value: fallbackTestCaseId }],
      }),
    ).toEqual([primaryHistoryId, `${fallbackTestCaseId}.${md5("")}`]);
  });

  it("getHistoryIdCandidates should deduplicate equal values", () => {
    const fallbackTestCaseId = md5("legacy-test-case-id");
    const equalHistoryId = `${fallbackTestCaseId}.${md5("")}`;

    expect(
      getHistoryIdCandidates({
        historyId: equalHistoryId,
        labels: [{ name: fallbackTestCaseIdLabelName, value: fallbackTestCaseId }],
      }),
    ).toEqual([equalHistoryId]);
  });

  it("getHistoryIdCandidates should return empty array when both ids are missing", () => {
    expect(getHistoryIdCandidates({})).toEqual([]);
  });
});
