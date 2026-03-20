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
  environments?: string[];
  testResults: TestResult[];
  historyDataPoints: HistoryDataPoint[];
  testResultsByEnvironment?: Record<string, TestResult[]>;
  historyDataPointsByEnvironment?: Record<string, HistoryDataPoint[]>;
  statistic?: Statistic;
}): AllureStore => {
  const {
    environments,
    testResults,
    historyDataPoints,
    testResultsByEnvironment,
    historyDataPointsByEnvironment,
    statistic,
  } = params;

  return {
    allEnvironments: async () => environments ?? [DEFAULT_ENVIRONMENT],
    allTestResults: async () => testResults,
    testResultsByEnvironment: async (env: string) => testResultsByEnvironment?.[env] ?? [],
    allHistoryDataPoints: async () => historyDataPoints,
    allHistoryDataPointsByEnvironment: async (env: string) => historyDataPointsByEnvironment?.[env] ?? [],
    testsStatistic: async () => statistic ?? { total: testResults.length, failed: testResults.length },
  } as unknown as AllureStore;
};

describe("generateCharts", () => {
  it("should map fallback history alias to current historyId for status age pyramid", async () => {
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

  it("should not map ambiguous fallback aliases to current history ids", async () => {
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

  it("should use environment-specific history data for environment charts", async () => {
    const chromeHistoryId = "chrome-history-id";
    const firefoxHistoryId = "firefox-history-id";
    const chromeTestResult = createTestResult({
      id: "chrome-tr",
      name: "chrome test",
      status: "failed",
      historyId: chromeHistoryId,
      environment: "chrome",
      stop: 1_700_000_001_000,
    });
    const firefoxTestResult = createTestResult({
      id: "firefox-tr",
      name: "firefox test",
      status: "failed",
      historyId: firefoxHistoryId,
      environment: "firefox",
      stop: 1_700_000_002_000,
    });
    const store = createStore({
      environments: ["chrome", "firefox"],
      testResults: [chromeTestResult, firefoxTestResult],
      testResultsByEnvironment: {
        chrome: [chromeTestResult],
        firefox: [firefoxTestResult],
      },
      historyDataPoints: [
        {
          uuid: "chrome-run",
          name: "chrome-run",
          timestamp: 1_700_000_000_000,
          knownTestCaseIds: [],
          metrics: {},
          testResults: {
            [chromeHistoryId]: {
              id: "chrome-history-result",
              historyId: chromeHistoryId,
              name: "chrome test",
              status: "failed",
            },
          },
        },
        {
          uuid: "firefox-run",
          name: "firefox-run",
          timestamp: 1_700_000_000_100,
          knownTestCaseIds: [],
          metrics: {},
          testResults: {
            [firefoxHistoryId]: {
              id: "firefox-history-result",
              historyId: firefoxHistoryId,
              name: "firefox test",
              status: "failed",
            },
          },
        },
      ],
      historyDataPointsByEnvironment: {
        chrome: [
          {
            uuid: "chrome-run",
            name: "chrome-run",
            timestamp: 1_700_000_000_000,
            knownTestCaseIds: [],
            metrics: {},
            testResults: {
              [chromeHistoryId]: {
                id: "chrome-history-result",
                historyId: chromeHistoryId,
                name: "chrome test",
                status: "failed",
              },
            },
          },
        ],
        firefox: [
          {
            uuid: "firefox-run",
            name: "firefox-run",
            timestamp: 1_700_000_000_100,
            knownTestCaseIds: [],
            metrics: {},
            testResults: {
              [firefoxHistoryId]: {
                id: "firefox-history-result",
                historyId: firefoxHistoryId,
                name: "firefox test",
                status: "failed",
              },
            },
          },
        ],
      },
    });

    const charts = await generateCharts(
      [{ type: ChartType.StatusAgePyramid }],
      store,
      "Sample report",
      () => "chart-1",
    );
    const chromeChart = charts.byEnv.chrome["chart-1"] as StatusAgePyramidChartData;

    expect(chromeChart.data.map(({ id }) => id)).toEqual(["chrome-run", "current"]);
    expect(chromeChart.data.find(({ id }) => id === "chrome-run")?.failed).toBe(1);
  });
});
