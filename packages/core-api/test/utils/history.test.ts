import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import type { HistoryDataPoint } from "../../src/index.js";
import {
  normalizeHistoryDataPoint,
  normalizeHistoryDataPointUrls,
  selectHistoryTestResults,
} from "../../src/utils/history.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("history");
  await story("history");
  await label("coverage", "history");
});

describe("history utils", () => {
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

  it("should ignore missing history test results while selecting candidates", () => {
    const historyDataPoints = [
      {
        uuid: "first",
        name: "Entry 1",
        timestamp: 1,
        knownTestCaseIds: [],
        metrics: {},
        url: "",
      } as unknown as HistoryDataPoint,
    ];

    expect(selectHistoryTestResults(historyDataPoints, ["primary"])).toEqual([]);
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

  it("should normalize nested history urls from datapoint url when needed", () => {
    const historyTestResult = { id: "primary", name: "primary", status: "passed", url: "" };
    const historyDataPoint = {
      uuid: "first",
      name: "Entry 1",
      timestamp: 1,
      knownTestCaseIds: [],
      metrics: {},
      url: "https://history",
      testResults: {
        primary: historyTestResult,
      },
    };

    expect(normalizeHistoryDataPointUrls(historyDataPoint)).toEqual({
      ...historyDataPoint,
      testResults: {
        primary: {
          ...historyTestResult,
          retryHash: "primary",
          url: "https://history",
        },
      },
    });
  });

  it("normalizes legacy history entries to their map retry hash", () => {
    const normalized = normalizeHistoryDataPoint({
      uuid: "first",
      name: "Entry 1",
      timestamp: 1,
      knownTestCaseIds: [],
      metrics: {},
      url: "",
      testResults: {
        canonical: {
          id: "result",
          name: "test",
          status: "passed",
          url: "",
          historyId: "legacy",
        } as never,
      },
    });

    expect(normalized.testResults.canonical).toMatchObject({ retryHash: "canonical" });
    expect(normalized.testResults.canonical).not.toHaveProperty("historyId");
  });

  it("should normalize missing history fields", () => {
    const historyDataPoint = {
      uuid: "first",
      name: "Entry 1",
      timestamp: 1,
    } as unknown as HistoryDataPoint;

    expect(normalizeHistoryDataPoint(historyDataPoint)).toEqual({
      ...historyDataPoint,
      knownTestCaseIds: [],
      metrics: {},
      testResults: {},
      url: "",
    });
  });
});
