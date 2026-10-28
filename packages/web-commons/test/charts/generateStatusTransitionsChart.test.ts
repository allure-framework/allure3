import { type AllureChartsStoreData, ChartType } from "@allurereport/charts-api";
import type { HistoryDataPoint, HistoryTestResult, TestResult } from "@allurereport/core-api";
import { allureId, epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { generateStatusTransitionsChart } from "../../src/charts/generateStatusTransitionsChart.js";

const historical = (id: string, status: HistoryTestResult["status"], retryHash = id): HistoryTestResult => ({
  id,
  retryHash,
  status,
  name: id,
  url: "",
});

const point = (uuid: string, timestamp: number, testResults: HistoryDataPoint["testResults"]): HistoryDataPoint => ({
  uuid,
  timestamp,
  testResults,
  name: uuid,
  knownTestCaseIds: [],
  metrics: {},
  url: "",
});

const current = (id: string, status: TestResult["status"], stop = 300): TestResult => ({
  id,
  name: id,
  retryHash: id,
  testCaseHash: id,
  environmentHash: null,
  parametersHash: "",
  status,
  stop,
  flaky: false,
  muted: false,
  known: false,
  isRetry: false,
  labels: [],
  parameters: [],
  links: [],
  steps: [],
  sourceMetadata: { readerId: "test", metadata: {} },
});

beforeEach(async () => {
  await epic("coverage");
  await feature("charts");
  await story("status-transitions");
  await label("coverage", "status-transitions");
});

describe("generateStatusTransitionsChart", () => {
  it("should aggregate transitions chronologically, exclude irrelevant results, and apply the history limit", async () => {
    await allureId("304049");
    const storeData: AllureChartsStoreData = {
      statistic: { total: 5 },
      historyDataPoints: [
        point("middle", 200, {
          fixed: historical("fixed", "passed"),
          regressed: historical("regressed", "failed"),
          malfunctioned: historical("malfunctioned", "unknown"),
          unchanged: historical("unchanged", "passed"),
          fresh: historical("fresh", "passed"),
        }),
        point("earliest", 100, {
          fixed: historical("fixed", "failed"),
          regressed: historical("regressed", "passed"),
          malfunctioned: historical("malfunctioned", "passed"),
          unchanged: historical("unchanged", "passed"),
        }),
      ],
      testResults: [
        current("fixed", "passed"),
        current("regressed", "failed"),
        current("malfunctioned", "broken"),
        current("unchanged", "passed"),
        current("current-new", "failed"),
      ],
    };

    const chart = generateStatusTransitionsChart({ options: { type: ChartType.StatusTransitions }, storeData });

    expect(chart.data).toEqual([
      { id: "middle", timestamp: 200, prevItemTimestamp: 100, fixed: 1, regressed: 1, malfunctioned: 0 },
      { id: "current", timestamp: 300, prevItemTimestamp: 200, fixed: 0, regressed: 0, malfunctioned: 1 },
    ]);
    const limitedStoreData: AllureChartsStoreData = {
      statistic: { total: 1 },
      historyDataPoints: [
        point("latest", 200, { changed: historical("changed", "failed") }),
        point("oldest", 100, { changed: historical("changed", "passed") }),
      ],
      testResults: [current("changed", "passed")],
    };

    const limitedChart = generateStatusTransitionsChart({
      options: { type: ChartType.StatusTransitions, limit: 1 },
      storeData: limitedStoreData,
    });

    expect(limitedChart.data).toEqual([
      { id: "current", timestamp: 300, prevItemTimestamp: 200, fixed: 1, regressed: 0, malfunctioned: 0 },
    ]);
  });
});
