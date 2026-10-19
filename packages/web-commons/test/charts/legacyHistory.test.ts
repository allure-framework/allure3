import { type AllureChartsStoreData, ChartType } from "@allurereport/charts-api";
import type { HistoryDataPoint, HistoryTestResult, TestResult } from "@allurereport/core-api";
import { epic, feature, story } from "allure-js-commons";
import { beforeEach, expect, it } from "vitest";

import { coverageDiffTreeMapAccessor } from "../../src/charts/accessors/coverageDiffTreeMapAccessor.js";
import { generateStatusAgePyramid } from "../../src/charts/generateStatusAgePyramid.js";
import { generateStatusTransitionsChart } from "../../src/charts/generateStatusTransitionsChart.js";
import { generateTestBaseGrowthDynamicsChart } from "../../src/charts/generateTestBaseGrowthDynamicsChart.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("charts");
  await story("read-only legacy history");
});

const historical = (id: string, retryHash: string, status: HistoryTestResult["status"]): HistoryTestResult => ({
  id,
  retryHash,
  status,
  name: id,
  url: "",
  labels: [{ name: "epic", value: "checkout" }],
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

const current = (id = "current", retryHash = "canonical"): TestResult => ({
  id,
  name: id,
  retryHash,
  testCaseHash: "case",
  parametersHash: "params",
  status: "passed",
  stop: 3,
  flaky: false,
  muted: false,
  known: false,
  isRetry: false,
  labels: [{ name: "epic", value: "checkout" }],
  parameters: [],
  links: [],
  steps: [],
  sourceMetadata: { readerId: "test", metadata: {}, legacyHistoryId: "legacy" },
});

const mixed = (): AllureChartsStoreData => ({
  testResults: [current()],
  statistic: { total: 1, passed: 1 },
  historyDataPoints: [
    point("old", 1, { legacy: historical("old-result", "legacy", "passed") }),
    point("recent", 2, {
      canonical: historical("recent-result", "canonical", "failed"),
      legacy: historical("shadowed-result", "legacy", "skipped"),
    }),
  ],
});

it("uses mixed identities for transitions without counting shadowed legacy entries", () => {
  const storeData = mixed();
  const original = structuredClone(storeData);
  const chart = generateStatusTransitionsChart({ options: { type: ChartType.StatusTransitions }, storeData });
  expect(chart.data).toEqual([
    expect.objectContaining({ id: "recent", regressed: 1, fixed: 0, malfunctioned: 0 }),
    expect.objectContaining({ id: "current", regressed: 0, fixed: 1, malfunctioned: 0 }),
  ]);
  expect(storeData).toEqual(original);
});

it("does not invent new or removed tests at the legacy-to-canonical boundary", () => {
  const storeData = mixed();
  const original = structuredClone(storeData);
  const chart = generateTestBaseGrowthDynamicsChart({ options: { type: ChartType.TestBaseGrowthDynamics }, storeData });
  expect(chart.data).toHaveLength(2);
  for (const row of chart.data) {
    for (const [key, value] of Object.entries(row)) {
      if (key.startsWith("new:") || key.startsWith("removed:")) {
        expect(value).toBe(0);
      }
    }
  }
  expect(storeData).toEqual(original);
});

it("keeps unrelated deleted tests but does not count a shadowed alias as deleted", () => {
  const storeData = mixed();
  const latest = storeData.historyDataPoints[1];
  latest.testResults.other = historical("other-result", "other", "passed");
  storeData.historyDataPoints = [latest];
  const original = structuredClone(storeData);
  const tree = coverageDiffTreeMapAccessor.getTreeMap(storeData);
  expect(tree).toMatchObject({ newCount: 0, deletedCount: 1, disabledCount: 0, enabledCount: 0, colorValue: 0.25 });
  expect(storeData).toEqual(original);
});

it("checks alias ownership against results excluded by the chart filter", () => {
  const testResult = { ...current(), status: "failed" as const };
  const storeData: AllureChartsStoreData = {
    testResults: [testResult],
    allTestResults: [testResult, current("excluded", "other-canonical")],
    statistic: { total: 1, failed: 1 },
    historyDataPoints: [point("old", 1, { legacy: historical("old-result", "legacy", "failed") })],
  };
  const chart = generateStatusAgePyramid({ options: { type: ChartType.StatusAgePyramid }, storeData });
  expect(chart.data[0]).toMatchObject({ id: "old", failed: 0 });
});
