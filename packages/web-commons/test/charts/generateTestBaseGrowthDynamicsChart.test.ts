import { type AllureChartsStoreData, ChartType } from "@allurereport/charts-api";
import type { HistoryDataPoint, HistoryTestResult, TestResult, TestStatus } from "@allurereport/core-api";
import { describe, expect, it } from "vite-plus/test";

import { generateTestBaseGrowthDynamicsChart } from "../../src/charts/generateTestBaseGrowthDynamicsChart.js";

const historical = (id: string, status: TestStatus = "passed"): HistoryTestResult => ({
  id,
  retryHash: id,
  status,
  name: id,
  url: "",
});

const point = (uuid: string, timestamp: number, tests: HistoryTestResult[]): HistoryDataPoint => ({
  uuid,
  timestamp,
  testResults: Object.fromEntries(tests.map((tr) => [tr.retryHash!, tr])),
  name: uuid,
  knownTestCaseIds: [],
  metrics: {},
  url: "",
});

const current = (id: string, status: TestStatus = "passed"): TestResult => ({
  id,
  retryHash: id,
  status,
  name: id,
  testCaseHash: id,
  parametersHash: "",
  environmentHash: null,
  stop: 400,
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

describe("generateTestBaseGrowthDynamicsChart", () => {
  it("attributes removals to the first absent run, including the current run and the baseline comparison", () => {
    const storeData: AllureChartsStoreData = {
      historyDataPoints: [
        point("middle", 200, [historical("kept"), historical("removed-current")]),
        point("baseline", 100, [historical("kept"), historical("removed-current"), historical("removed-middle")]),
      ],
      testResults: [current("kept")],
      statistic: { total: 1, passed: 1 },
    };
    const original = structuredClone(storeData);
    const chart = generateTestBaseGrowthDynamicsChart({
      options: { type: ChartType.TestBaseGrowthDynamics },
      storeData,
    });

    expect(chart.data).toMatchObject([
      { "id": "middle", "new:passed": 0, "removed:passed": 1 },
      { "id": "current", "new:passed": 0, "removed:passed": 1 },
    ]);
    expect(storeData).toEqual(original);
  });

  it("keeps a zero comparison before a removal in the current run", () => {
    const chart = generateTestBaseGrowthDynamicsChart({
      options: { type: ChartType.TestBaseGrowthDynamics },
      storeData: {
        historyDataPoints: [
          point("middle", 200, [historical("kept"), historical("removed")]),
          point("baseline", 100, [historical("kept"), historical("removed")]),
        ],
        testResults: [current("kept")],
        statistic: { total: 1, passed: 1 },
      },
    });
    expect(chart.data.map((row) => row["removed:passed"])).toEqual([0, 1]);
  });

  it("uses the removed test's last status and filters additions and removals by selected statuses", () => {
    const chart = generateTestBaseGrowthDynamicsChart({
      options: { type: ChartType.TestBaseGrowthDynamics, statuses: ["failed"] },
      storeData: {
        historyDataPoints: [
          point("baseline", 100, [historical("removed-failed", "failed"), historical("removed-passed")]),
        ],
        testResults: [current("added-failed", "failed"), current("added-passed")],
        statistic: { total: 2, passed: 1, failed: 1 },
      },
    });
    expect(chart.statuses).toEqual(["failed"]);
    expect(chart.data).toEqual([{ "id": "current", "timestamp": 400, "new:failed": 1, "removed:failed": 1 }]);
  });

  it("preserves the definition of new and removed when a known test temporarily disappears", () => {
    const chart = generateTestBaseGrowthDynamicsChart({
      options: { type: ChartType.TestBaseGrowthDynamics },
      storeData: {
        historyDataPoints: [point("middle", 200, []), point("baseline", 100, [historical("returned")])],
        testResults: [current("returned")],
        statistic: { total: 1, passed: 1 },
      },
    });
    expect(chart.data).toMatchObject([
      { "id": "middle", "new:passed": 0, "removed:passed": 0 },
      { "id": "current", "new:passed": 0, "removed:passed": 0 },
    ]);
  });

  it("limits historical matching to the selected window and leaves its baseline off the chart", () => {
    const chart = generateTestBaseGrowthDynamicsChart({
      options: { type: ChartType.TestBaseGrowthDynamics, limit: 2 },
      storeData: {
        historyDataPoints: [
          point("latest", 300, []),
          point("baseline", 200, []),
          point("outside", 100, [historical("added")]),
        ],
        testResults: [current("added")],
        statistic: { total: 1, passed: 1 },
      },
    });
    expect(chart.data).toMatchObject([
      { "id": "latest", "new:passed": 0, "removed:passed": 0 },
      { "id": "current", "new:passed": 1, "removed:passed": 0 },
    ]);
  });
});
