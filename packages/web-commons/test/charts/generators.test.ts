import { ChartType, type StatusAgePyramidChartData } from "@allurereport/charts-api";
import {
  DEFAULT_ENVIRONMENT,
  type HistoryDataPoint,
  type Statistic,
  type TestResult,
  fallbackTestCaseIdLabelName,
} from "@allurereport/core-api";
import { type AllureStore, md5 } from "@allurereport/plugin-api";
import { describe, expect, it } from "vitest";

import { generateCharts } from "../../src/charts/generators.js";

const baseTestResult: Pick<
  TestResult,
  | "id"
  | "name"
  | "flaky"
  | "muted"
  | "known"
  | "hidden"
  | "labels"
  | "parameters"
  | "links"
  | "steps"
  | "sourceMetadata"
> = {
  id: "tr-1",
  name: "Test",
  flaky: false,
  muted: false,
  known: false,
  hidden: false,
  labels: [],
  parameters: [],
  links: [],
  steps: [],
  sourceMetadata: { readerId: "", metadata: {} },
};

const createTestResult = (overrides: Partial<TestResult> & { status: TestResult["status"] }): TestResult => {
  const { status, ...rest } = overrides;

  return {
    ...baseTestResult,
    status,
    ...rest,
  };
};

const createStore = (params: {
  testResults: TestResult[];
  historyDataPoints: HistoryDataPoint[];
  statistic?: Statistic;
}): AllureStore => {
  const { testResults, historyDataPoints, statistic } = params;

  return {
    allEnvironments: async () => [DEFAULT_ENVIRONMENT],
    allTestResults: async () => testResults,
    allHistoryDataPoints: async () => historyDataPoints,
    testsStatistic: async () => statistic ?? { total: testResults.length, failed: testResults.length },
  } as unknown as AllureStore;
};

describe("generateCharts", () => {
  it("maps fallback history alias to current historyId for status age pyramid", async () => {
    const fallbackTestCaseId = md5("legacy-test-case-id");
    const fallbackHistoryId = `${fallbackTestCaseId}.${md5("")}`;
    const currentHistoryId = "new-history-id";
    const store = createStore({
      historyDataPoints: [
        {
          uuid: "run-1",
          name: "run-1",
          timestamp: 1_700_000_000_000,
          knownTestCaseIds: [],
          metrics: {},
          testResults: {
            [fallbackHistoryId]: {
              id: "legacy-result-id",
              historyId: fallbackHistoryId,
              name: "legacy test name",
              status: "failed",
            },
          },
        },
      ],
      testResults: [
        createTestResult({
          id: "tr-current",
          name: "migrated test",
          status: "failed",
          historyId: currentHistoryId,
          stop: 1_700_000_001_000,
          labels: [{ name: fallbackTestCaseIdLabelName, value: fallbackTestCaseId }],
        }),
      ],
    });

    const charts = await generateCharts(
      [{ type: ChartType.StatusAgePyramid }],
      store,
      "Sample report",
      () => "chart-1",
    );
    const chart = charts.general["chart-1"] as StatusAgePyramidChartData;
    const historyPoint = chart.data.find(({ id }) => id === "run-1");
    const currentPoint = chart.data.find(({ id }) => id === "current");

    expect(historyPoint).toBeDefined();
    expect(currentPoint).toBeDefined();
    expect(historyPoint?.failed).toBe(1);
    expect(currentPoint?.failed).toBe(1);
  });

  it("does not map ambiguous fallback aliases to current history ids", async () => {
    const fallbackTestCaseId = md5("legacy-test-case-id");
    const fallbackHistoryId = `${fallbackTestCaseId}.${md5("")}`;
    const store = createStore({
      historyDataPoints: [
        {
          uuid: "run-1",
          name: "run-1",
          timestamp: 1_700_000_000_000,
          knownTestCaseIds: [],
          metrics: {},
          testResults: {
            [fallbackHistoryId]: {
              id: "legacy-result-id",
              historyId: fallbackHistoryId,
              name: "legacy test name",
              status: "failed",
            },
          },
        },
      ],
      testResults: [
        createTestResult({
          id: "tr-current-1",
          name: "migrated test #1",
          status: "failed",
          historyId: "new-history-id-1",
          stop: 1_700_000_001_000,
          labels: [{ name: fallbackTestCaseIdLabelName, value: fallbackTestCaseId }],
        }),
        createTestResult({
          id: "tr-current-2",
          name: "migrated test #2",
          status: "failed",
          historyId: "new-history-id-2",
          stop: 1_700_000_002_000,
          labels: [{ name: fallbackTestCaseIdLabelName, value: fallbackTestCaseId }],
        }),
      ],
    });

    const charts = await generateCharts(
      [{ type: ChartType.StatusAgePyramid }],
      store,
      "Sample report",
      () => "chart-1",
    );
    const chart = charts.general["chart-1"] as StatusAgePyramidChartData;
    const historyPoint = chart.data.find(({ id }) => id === "run-1");
    const currentPoint = chart.data.find(({ id }) => id === "current");

    expect(historyPoint).toBeDefined();
    expect(currentPoint).toBeDefined();
    expect(historyPoint?.failed).toBe(0);
    expect(currentPoint?.failed).toBe(2);
  });
});
