import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { fallbackTestCaseIdLabelName, type TestParameter, type TestResult } from "../../src/index.js";
import {
  filterUnknownByKnownIssues,
  getFallbackHistoryId,
  getHistoryIdCandidates,
  selectHistoryTestResults,
  stringifyHistoryParams,
} from "../../src/utils/history.js";

const md5 = (data: string) => createHash("md5").update(data).digest("hex");

describe("history utils", () => {
  it("should sort and exclude parameters in stringifyHistoryParams", () => {
    const parameters: TestParameter[] = [
      { name: "b", value: "2" },
      { name: "a", value: "1" },
      { name: "c", value: "3", excluded: true },
    ];

    expect(stringifyHistoryParams(parameters)).toBe("a:1,b:2");
  });

  it("should build fallback history id from label and params", () => {
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

  it("should return primary and fallback history ids in order", () => {
    const fallbackTestCaseId = md5("legacy-test-case-id");
    const primaryHistoryId = "primary-history-id";

    expect(
      getHistoryIdCandidates({
        historyId: primaryHistoryId,
        labels: [{ name: fallbackTestCaseIdLabelName, value: fallbackTestCaseId }],
      }),
    ).toEqual([primaryHistoryId, `${fallbackTestCaseId}.${md5("")}`]);
  });

  it("should deduplicate equal history id candidates", () => {
    const fallbackTestCaseId = md5("legacy-test-case-id");
    const equalHistoryId = `${fallbackTestCaseId}.${md5("")}`;

    expect(
      getHistoryIdCandidates({
        historyId: equalHistoryId,
        labels: [{ name: fallbackTestCaseIdLabelName, value: fallbackTestCaseId }],
      }),
    ).toEqual([equalHistoryId]);
  });

  it("should return empty array when both history id candidates are missing", () => {
    expect(getHistoryIdCandidates({})).toEqual([]);
  });

  it("should filter unknown tests by known issue history candidates", () => {
    const fallbackTestCaseId = md5("legacy-test-case-id");
    const fallbackHistoryId = `${fallbackTestCaseId}.${md5("")}`;
    const trs = [
      {
        id: "1",
        name: "test 1",
        status: "failed",
        historyId: "new-history-id",
        labels: [{ name: fallbackTestCaseIdLabelName, value: fallbackTestCaseId }],
        parameters: [],
        flaky: false,
        muted: false,
        known: false,
        hidden: false,
        links: [],
        steps: [],
        sourceMetadata: { readerId: "", metadata: {} },
      } as TestResult,
      {
        id: "2",
        name: "test 2",
        status: "failed",
        historyId: "another-history-id",
        labels: [],
        parameters: [],
        flaky: false,
        muted: false,
        known: false,
        hidden: false,
        links: [],
        steps: [],
        sourceMetadata: { readerId: "", metadata: {} },
      } as TestResult,
    ];

    expect(filterUnknownByKnownIssues(trs, new Set([fallbackHistoryId]))).toEqual([trs[1]]);
  });

  it("should select the first matching history candidate for each datapoint", () => {
    const primaryHistoryResult = { id: "primary", name: "primary", status: "passed", url: "https://primary" };
    const fallbackHistoryResult = { id: "fallback", name: "fallback", status: "failed", url: "https://fallback" };
    const historyDataPoints = [
      {
        uuid: "first",
        name: "Entry 1",
        timestamp: 1,
        knownTestCaseIds: [],
        metrics: {},
        url: "",
        testResults: {
          primary: primaryHistoryResult,
          fallback: fallbackHistoryResult,
        },
      },
      {
        uuid: "second",
        name: "Entry 2",
        timestamp: 2,
        knownTestCaseIds: [],
        metrics: {},
        url: "",
        testResults: {
          fallback: fallbackHistoryResult,
        },
      },
    ];

    expect(selectHistoryTestResults(historyDataPoints, ["primary", "fallback"])).toEqual([
      primaryHistoryResult,
      fallbackHistoryResult,
    ]);
  });

  it("should not mutate selected history entries", () => {
    const historyTestResult = { id: "primary", name: "primary", status: "passed", url: "https://history" };
    const historyDataPoints = [
      {
        uuid: "first",
        name: "Entry 1",
        timestamp: 1,
        knownTestCaseIds: [],
        metrics: {},
        url: "https://report",
        testResults: {
          primary: historyTestResult,
        },
      },
    ];

    const [selectedHistoryTestResult] = selectHistoryTestResults(historyDataPoints, ["primary"]);

    expect(selectedHistoryTestResult).toBe(historyTestResult);
    expect(selectedHistoryTestResult.url).toBe("https://history");
  });
});
