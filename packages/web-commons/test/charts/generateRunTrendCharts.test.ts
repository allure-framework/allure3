import type { AllureChartsStoreData } from "@allurereport/charts-api";
import { ChartType } from "@allurereport/charts-api";
import {
  type HistoryDataPoint,
  type HistoryTestResult,
  type TestResult,
  type TestStatus,
  normalizeCategoriesConfig,
} from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  generateCategoriesTrendChart,
  generateDurationTrendChart,
  generateRetriesTrendChart,
} from "../../src/charts/generateRunTrendCharts.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("charts");
  await story("generateRunTrendCharts");
  await label("coverage", "charts");
});

const createTestResult = (overrides: Partial<TestResult> & { id: string; status: TestStatus }): TestResult => ({
  name: overrides.id,
  flaky: false,
  muted: false,
  known: true,
  isRetry: false,
  labels: [],
  parameters: [],
  links: [],
  steps: [],
  sourceMetadata: { readerId: "", metadata: {} },
  ...overrides,
});

const createHistoryTestResult = (
  overrides: Partial<HistoryTestResult> & { id: string; status: TestStatus },
): HistoryTestResult => ({
  name: overrides.id,
  url: "",
  retryHash: overrides.id,
  ...overrides,
});

const createHistoryDataPoint = (
  uuid: string,
  timestamp: number,
  testResults: HistoryTestResult[],
): HistoryDataPoint => ({
  uuid,
  name: `Report ${uuid}`,
  timestamp,
  knownTestCaseIds: [],
  testResults: Object.fromEntries(testResults.map((tr) => [tr.retryHash!, tr])),
  metrics: {},
  url: "",
});

const createStoreData = (overrides: Partial<AllureChartsStoreData>): AllureChartsStoreData => ({
  historyDataPoints: [],
  testResults: [],
  statistic: { total: 0 },
  ...overrides,
});

describe("generateDurationTrendChart", () => {
  it("should show the time from the first test start to the last test stop of each run, oldest run first", () => {
    const storeData = createStoreData({
      // history is read newest first
      historyDataPoints: [
        createHistoryDataPoint("h2", 2000, [
          createHistoryTestResult({ id: "a", status: "passed", start: 100, stop: 400 }),
          createHistoryTestResult({ id: "b", status: "passed", start: 200, stop: 900 }),
        ]),
        // written by an older version without test timings
        createHistoryDataPoint("h1", 1000, [createHistoryTestResult({ id: "a", status: "passed" })]),
      ],
      testResults: [
        createTestResult({ id: "a", status: "passed", start: 5000, stop: 5100 }),
        createTestResult({ id: "b", status: "failed", start: 5050, stop: 5300 }),
      ],
    });

    const chart = generateDurationTrendChart({
      options: { type: ChartType.DurationTrend },
      storeData,
      reportName: "R",
    });

    expect(chart.type).toBe(ChartType.DurationTrend);
    expect(chart.data).toEqual([
      { id: "h1", name: "Report h1", timestamp: 1000, duration: 0 },
      { id: "h2", name: "Report h2", timestamp: 2000, duration: 800 },
      { id: "current", name: "R", timestamp: expect.any(Number), duration: 300 },
    ]);
  });

  it("should keep only the latest runs within the limit, the current run included", () => {
    const storeData = createStoreData({
      historyDataPoints: [
        createHistoryDataPoint("h3", 3000, []),
        createHistoryDataPoint("h2", 2000, []),
        createHistoryDataPoint("h1", 1000, []),
      ],
      testResults: [createTestResult({ id: "a", status: "passed", start: 0, stop: 10 })],
    });

    const chart = generateDurationTrendChart({
      options: { type: ChartType.DurationTrend, limit: 2 },
      storeData,
      reportName: "R",
    });

    expect(chart.data.map(({ id }) => id)).toEqual(["h3", "current"]);
  });
});

describe("generateRetriesTrendChart", () => {
  it("should count the tests and their earlier attempts of each run", () => {
    const storeData = createStoreData({
      historyDataPoints: [
        createHistoryDataPoint("h2", 2000, [
          createHistoryTestResult({ id: "a", status: "passed", retries: ["failed", "broken"] }),
          createHistoryTestResult({ id: "b", status: "passed", retries: [] }),
        ]),
        // written by an older version without retries
        createHistoryDataPoint("h1", 1000, [createHistoryTestResult({ id: "a", status: "failed" })]),
      ],
      testResults: [
        createTestResult({ id: "a", status: "passed", stop: 10 }),
        createTestResult({ id: "b", status: "passed", stop: 10 }),
        createTestResult({ id: "c", status: "passed", stop: 10 }),
      ],
      allTestResults: [
        createTestResult({ id: "a", status: "passed", stop: 10 }),
        createTestResult({ id: "a-retry", status: "failed", isRetry: true }),
        createTestResult({ id: "b", status: "passed", stop: 10 }),
        createTestResult({ id: "c", status: "passed", stop: 10 }),
      ],
    });

    const chart = generateRetriesTrendChart({ options: { type: ChartType.RetriesTrend }, storeData, reportName: "R" });

    expect(chart.data.map(({ id, run, retry }) => ({ id, run, retry }))).toEqual([
      { id: "h1", run: 1, retry: 0 },
      { id: "h2", run: 2, retry: 2 },
      { id: "current", run: 3, retry: 1 },
    ]);
  });
});

describe("generateCategoriesTrendChart", () => {
  it("should count the tests of each run by the default categories when no categories are given", () => {
    const storeData = createStoreData({
      historyDataPoints: [
        createHistoryDataPoint("h1", 1000, [
          createHistoryTestResult({ id: "a", status: "failed" }),
          createHistoryTestResult({ id: "b", status: "failed" }),
          createHistoryTestResult({ id: "c", status: "passed" }),
        ]),
      ],
      testResults: [
        createTestResult({ id: "a", status: "broken", stop: 10 }),
        createTestResult({ id: "b", status: "failed", stop: 10 }),
      ],
    });

    const chart = generateCategoriesTrendChart({
      options: { type: ChartType.CategoriesTrend },
      storeData,
      reportName: "R",
    });

    expect(chart.categories).toEqual(["Product errors", "Test errors"]);
    expect(chart.data.map(({ id, categories }) => ({ id, categories }))).toEqual([
      { id: "h1", categories: { "Product errors": 2 } },
      { id: "current", categories: { "Product errors": 1, "Test errors": 1 } },
    ]);
  });

  it("should match historical results by the error and flaky flag stored in the history", () => {
    const categories = normalizeCategoriesConfig([
      { name: "Hidden", matchers: { message: /ignored/ }, hide: true },
      { name: "Timeouts", matchers: { statuses: ["failed", "broken"], message: /timeout/i } },
      { name: "Flaky", matchers: { flaky: true } },
      { name: "Unused", matchers: { statuses: ["skipped"] } },
    ]);
    const storeData = createStoreData({
      categories,
      historyDataPoints: [
        createHistoryDataPoint("h2", 2000, [
          // history keeps the error message and trace as top-level fields
          createHistoryTestResult({ id: "a", status: "failed", message: "Timeout after 5s" }),
          createHistoryTestResult({ id: "b", status: "passed", flaky: true }),
          createHistoryTestResult({ id: "c", status: "failed", message: "ignored failure" }),
        ]),
        createHistoryDataPoint("h1", 1000, [
          createHistoryTestResult({ id: "a", status: "broken", error: { message: "Read timeout" } }),
          // older history has no flaky flag, such results are not flaky
          createHistoryTestResult({ id: "b", status: "passed" }),
        ]),
      ],
      testResults: [
        createTestResult({ id: "a", status: "passed", stop: 10 }),
        createTestResult({ id: "b", status: "passed", flaky: true, stop: 10 }),
      ],
    });

    const chart = generateCategoriesTrendChart({
      options: { type: ChartType.CategoriesTrend },
      storeData,
      reportName: "R",
    });

    expect(chart.categories).toEqual(["Timeouts", "Flaky"]);
    expect(chart.data.map(({ id, categories: counts }) => ({ id, counts }))).toEqual([
      { id: "h1", counts: { Timeouts: 1 } },
      { id: "h2", counts: { Timeouts: 1, Flaky: 1 } },
      { id: "current", counts: { Flaky: 1 } },
    ]);
  });
});
