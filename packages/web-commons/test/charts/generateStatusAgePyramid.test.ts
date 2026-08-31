import type { AllureChartsStoreData } from "@allurereport/charts-api";
import { ChartType } from "@allurereport/charts-api";
import type { HistoryDataPoint, HistoryTestResult, TestResult, TestStatus } from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { generateStatusAgePyramid } from "../../src/charts/generateStatusAgePyramid.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("charts");
  await story("generateStatusAgePyramid");
  await label("coverage", "charts");
});

const baseTestResult: Pick<
  TestResult,
  | "id"
  | "name"
  | "flaky"
  | "muted"
  | "known"
  | "isRetry"
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
  known: true,
  isRetry: false,
  labels: [],
  parameters: [],
  links: [],
  steps: [],
  sourceMetadata: { readerId: "", metadata: {} },
};

const createTestResult = (overrides: Partial<TestResult> & { status: TestStatus }): TestResult => {
  const { status = "passed", ...rest } = overrides;
  return { ...baseTestResult, status, ...rest };
};

const createHistoryTestResult = (
  overrides: Partial<HistoryTestResult> & { status: TestStatus; retryHash: string },
): HistoryTestResult => ({
  id: "tr-1",
  name: "Test",
  url: "http://example.com",
  ...overrides,
});

const createHistoryDataPoint = (overrides: Partial<HistoryDataPoint>): HistoryDataPoint => ({
  uuid: "hdp-1",
  name: "Run 1",
  timestamp: 1000,
  knownTestCaseIds: [],
  testResults: {},
  metrics: {},
  url: "http://example.com",
  ...overrides,
});

const createStoreData = (overrides: Partial<AllureChartsStoreData>): AllureChartsStoreData => ({
  historyDataPoints: [],
  testResults: [],
  statistic: { total: 0 },
  ...overrides,
});

describe("generateStatusAgePyramid", () => {
  it("should return chart with type StatusAgePyramid and default statuses", () => {
    const result = generateStatusAgePyramid({
      options: { type: ChartType.StatusAgePyramid },
      storeData: createStoreData({}),
    });

    expect(result.type).toBe(ChartType.StatusAgePyramid);
    expect(result.statuses).toEqual(["failed", "broken", "skipped", "unknown"]);
  });

  it("should use custom title from options", () => {
    const result = generateStatusAgePyramid({
      options: { type: ChartType.StatusAgePyramid, title: "Custom Status Pyramid" },
      storeData: createStoreData({}),
    });

    expect(result.title).toBe("Custom Status Pyramid");
  });

  it("should return single current data point with zero stats when no history", () => {
    const storeData = createStoreData({
      testResults: [createTestResult({ id: "1", status: "failed", retryHash: "hid-1", stop: 2000 })],
    });

    const result = generateStatusAgePyramid({
      options: { type: ChartType.StatusAgePyramid },
      storeData,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: "current",
      timestamp: 2000,
      failed: 0,
      broken: 0,
      skipped: 0,
      unknown: 0,
    });
  });

  it("should count FBSU tests at current run when history is present", () => {
    const retryHash1 = "hid-1";
    const retryHash2 = "hid-2";
    const storeData = createStoreData({
      historyDataPoints: [
        createHistoryDataPoint({
          uuid: "run-1",
          timestamp: 1000,
          testResults: {
            [retryHash1]: createHistoryTestResult({ retryHash: retryHash1, status: "failed" }),
            [retryHash2]: createHistoryTestResult({ retryHash: retryHash2, status: "broken" }),
          },
        }),
      ],
      testResults: [
        createTestResult({ id: "1", status: "failed", retryHash: retryHash1, stop: 2000 }),
        createTestResult({ id: "2", status: "broken", retryHash: retryHash2, stop: 2000 }),
      ],
      statistic: { total: 2, failed: 1, broken: 1 },
    });

    const result = generateStatusAgePyramid({
      options: { type: ChartType.StatusAgePyramid },
      storeData,
    });

    expect(result.data).toHaveLength(2);
    const currentPoint = result.data.find((d) => d.id === "current")!;
    expect(currentPoint.failed).toBe(1);
    expect(currentPoint.broken).toBe(1);
    expect(currentPoint.skipped).toBe(0);
    expect(currentPoint.unknown).toBe(0);
  });

  it("should not count passed tests", () => {
    const retryHash1 = "hid-1";
    const storeData = createStoreData({
      historyDataPoints: [
        createHistoryDataPoint({
          uuid: "run-1",
          timestamp: 1000,
          testResults: {
            [retryHash1]: createHistoryTestResult({ retryHash: retryHash1, status: "passed" }),
          },
        }),
      ],
      testResults: [createTestResult({ id: "1", status: "passed", retryHash: retryHash1, stop: 2000 })],
      statistic: { total: 1, passed: 1 },
    });

    const result = generateStatusAgePyramid({
      options: { type: ChartType.StatusAgePyramid },
      storeData,
    });

    const currentPoint = result.data.find((d) => d.id === "current")!;
    expect(currentPoint.failed).toBe(0);
    expect(currentPoint.broken).toBe(0);
    expect(currentPoint.skipped).toBe(0);
    expect(currentPoint.unknown).toBe(0);
  });

  it("should count only tests that kept same FBSU status from history run to current", () => {
    const retryHashFailed = "hid-failed";
    const retryHashBroken = "hid-broken";
    const storeData = createStoreData({
      historyDataPoints: [
        createHistoryDataPoint({
          uuid: "run-1",
          timestamp: 1000,
          testResults: {
            [retryHashFailed]: createHistoryTestResult({
              retryHash: retryHashFailed,
              status: "failed",
            }),
            [retryHashBroken]: createHistoryTestResult({
              retryHash: retryHashBroken,
              status: "broken",
            }),
          },
        }),
      ],
      testResults: [
        createTestResult({ id: "1", status: "failed", retryHash: retryHashFailed, stop: 2000 }),
        createTestResult({ id: "2", status: "broken", retryHash: retryHashBroken, stop: 2000 }),
      ],
      statistic: { total: 2, failed: 1, broken: 1 },
    });

    const result = generateStatusAgePyramid({
      options: { type: ChartType.StatusAgePyramid },
      storeData,
    });

    expect(result.data).toHaveLength(2);
    const historyPoint = result.data.find((d) => d.id === "run-1")!;
    expect(historyPoint.failed).toBe(1);
    expect(historyPoint.broken).toBe(1);
    const currentPoint = result.data.find((d) => d.id === "current")!;
    expect(currentPoint.failed).toBe(1);
    expect(currentPoint.broken).toBe(1);
  });

  it("should not count test at history point if status changed in a later run", () => {
    const retryHash = "hid-1";
    const storeData = createStoreData({
      historyDataPoints: [
        createHistoryDataPoint({
          uuid: "run-1",
          timestamp: 1000,
          testResults: {
            [retryHash]: createHistoryTestResult({ retryHash, status: "failed" }),
          },
        }),
        createHistoryDataPoint({
          uuid: "run-2",
          timestamp: 1500,
          testResults: {
            [retryHash]: createHistoryTestResult({ retryHash, status: "passed" }),
          },
        }),
      ],
      testResults: [createTestResult({ id: "1", status: "failed", retryHash, stop: 2000 })],
      statistic: { total: 1, failed: 1 },
    });

    const result = generateStatusAgePyramid({
      options: { type: ChartType.StatusAgePyramid, limit: 10 },
      storeData,
    });

    expect(result.data).toHaveLength(3);
    const run1 = result.data.find((d) => d.id === "run-1")!;
    const run2 = result.data.find((d) => d.id === "run-2")!;
    const current = result.data.find((d) => d.id === "current")!;
    expect(run1.failed).toBe(0);
    expect(run2.failed).toBe(0);
    expect(current.failed).toBe(1);
  });

  it("should count failed test in run 2, run 3 and current when it passed in run 1 (4 runs: current + history 1,2,3)", () => {
    const retryHash = "hid-test-1";
    const storeData = createStoreData({
      historyDataPoints: [
        createHistoryDataPoint({
          uuid: "run-1",
          timestamp: 1000,
          testResults: {
            [retryHash]: createHistoryTestResult({ retryHash, status: "passed" }),
          },
        }),
        createHistoryDataPoint({
          uuid: "run-2",
          timestamp: 2000,
          testResults: {
            [retryHash]: createHistoryTestResult({ retryHash, status: "failed" }),
          },
        }),
        createHistoryDataPoint({
          uuid: "run-3",
          timestamp: 3000,
          testResults: {
            [retryHash]: createHistoryTestResult({ retryHash, status: "failed" }),
          },
        }),
      ],
      testResults: [createTestResult({ id: "test-1", status: "failed", retryHash, stop: 4000 })],
      statistic: { total: 1, failed: 1 },
    });

    const result = generateStatusAgePyramid({
      options: { type: ChartType.StatusAgePyramid, limit: 10 },
      storeData,
    });

    expect(result.data).toHaveLength(4);
    const run1 = result.data.find((d) => d.id === "run-1")!;
    const run2 = result.data.find((d) => d.id === "run-2")!;
    const run3 = result.data.find((d) => d.id === "run-3")!;
    const current = result.data.find((d) => d.id === "current")!;

    expect(run1.failed).toBe(0);
    expect(run2.failed).toBe(1);
    expect(run3.failed).toBe(1);
    expect(current.failed).toBe(1);
  });

  it("should count failed test only in run 3 and current when it failed in run 1 but passed in run 2 (4 runs: current + history 1,2,3)", () => {
    const retryHash = "hid-test-1";
    const storeData = createStoreData({
      historyDataPoints: [
        createHistoryDataPoint({
          uuid: "run-1",
          timestamp: 1000,
          testResults: {
            [retryHash]: createHistoryTestResult({ retryHash, status: "failed" }),
          },
        }),
        createHistoryDataPoint({
          uuid: "run-2",
          timestamp: 2000,
          testResults: {
            [retryHash]: createHistoryTestResult({ retryHash, status: "passed" }),
          },
        }),
        createHistoryDataPoint({
          uuid: "run-3",
          timestamp: 3000,
          testResults: {
            [retryHash]: createHistoryTestResult({ retryHash, status: "failed" }),
          },
        }),
      ],
      testResults: [createTestResult({ id: "test-1", status: "failed", retryHash, stop: 4000 })],
      statistic: { total: 1, failed: 1 },
    });

    const result = generateStatusAgePyramid({
      options: { type: ChartType.StatusAgePyramid, limit: 10 },
      storeData,
    });

    expect(result.data).toHaveLength(4);
    const run1 = result.data.find((d) => d.id === "run-1")!;
    const run2 = result.data.find((d) => d.id === "run-2")!;
    const run3 = result.data.find((d) => d.id === "run-3")!;
    const current = result.data.find((d) => d.id === "current")!;

    expect(run1.failed).toBe(0);
    expect(run2.failed).toBe(0);
    expect(run3.failed).toBe(1);
    expect(current.failed).toBe(1);
  });

  it("should respect limit option", () => {
    const storeData = createStoreData({
      historyDataPoints: [
        createHistoryDataPoint({ uuid: "run-1", timestamp: 1000 }),
        createHistoryDataPoint({ uuid: "run-2", timestamp: 2000 }),
        createHistoryDataPoint({ uuid: "run-3", timestamp: 3000 }),
      ],
      testResults: [],
      statistic: { total: 0 },
    });

    const result = generateStatusAgePyramid({
      options: { type: ChartType.StatusAgePyramid, limit: 2 },
      storeData,
    });

    expect(result.data).toHaveLength(3);
    expect(result.data.map((d) => d.id)).toEqual(["run-1", "run-2", "current"]);
  });

  it("should sort history by timestamp ascending", () => {
    const storeData = createStoreData({
      historyDataPoints: [
        createHistoryDataPoint({ uuid: "run-3", timestamp: 3000 }),
        createHistoryDataPoint({ uuid: "run-1", timestamp: 1000 }),
        createHistoryDataPoint({ uuid: "run-2", timestamp: 2000 }),
      ],
      testResults: [],
      statistic: { total: 0 },
    });

    const result = generateStatusAgePyramid({
      options: { type: ChartType.StatusAgePyramid, limit: 10 },
      storeData,
    });

    expect(result.data.map((d) => d.id)).toEqual(["run-1", "run-2", "run-3", "current"]);
    expect(result.data.map((d) => d.timestamp)).toEqual([1000, 2000, 3000, 0]);
  });

  it("should include skipped and unknown in counts", () => {
    const hidSkipped = "hid-skip";
    const hidUnknown = "hid-unk";
    const storeData = createStoreData({
      historyDataPoints: [
        createHistoryDataPoint({
          uuid: "run-1",
          timestamp: 1000,
          testResults: {
            [hidSkipped]: createHistoryTestResult({ retryHash: hidSkipped, status: "skipped" }),
            [hidUnknown]: createHistoryTestResult({ retryHash: hidUnknown, status: "unknown" }),
          },
        }),
      ],
      testResults: [
        createTestResult({ id: "1", status: "skipped", retryHash: hidSkipped, stop: 2000 }),
        createTestResult({ id: "2", status: "unknown", retryHash: hidUnknown, stop: 2000 }),
      ],
      statistic: { total: 2, skipped: 1, unknown: 1 },
    });

    const result = generateStatusAgePyramid({
      options: { type: ChartType.StatusAgePyramid },
      storeData,
    });

    const current = result.data.find((d) => d.id === "current")!;
    expect(current.skipped).toBe(1);
    expect(current.unknown).toBe(1);
  });
});
