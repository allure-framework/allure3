import { type AllureCheckResult, type AllureHistory, type TestResult, getWorstStatus } from "@allurereport/core-api";
import { describe, expect, it, vi } from "vitest";

import {
  convertToSummaryCheckResult,
  convertToTestResultSummary,
  calculateRunDuration,
  createPluginSummary,
  createTestResultRegistry,
} from "../src/utils/summary.js";

const testResult = (args: Partial<TestResult> = {}): TestResult => ({
  id: "test-id",
  name: "test name",
  status: "passed",
  steps: [],
  parameters: [],
  labels: [],
  links: [],
  flaky: false,
  muted: false,
  isRetry: false,
  known: false,
  sourceMetadata: {
    readerId: "system",
    metadata: {},
  },
  ...args,
});

describe("summary utils", () => {
  it("convertToTestResultSummary maps fields", () => {
    expect(
      convertToTestResultSummary(
        testResult({
          id: "id-1",
          name: "name-1",
          status: "failed",
          duration: 123,
          environment: "chrome",
        }),
      ),
    ).toEqual({
      id: "id-1",
      name: "name-1",
      status: "failed",
      duration: 123,
      environment: "chrome",
    });
  });

  it("createTestResultRegistry indexes reduced test results by id", () => {
    expect(
      createTestResultRegistry([
        testResult({
          id: "id-1",
          name: "name-1",
          status: "failed",
          duration: 123,
          environment: "chrome",
        }),
        testResult({ id: "id-2", name: "name-2", status: "passed", duration: 456, environment: "firefox" }),
      ]),
    ).toEqual({
      byId: {
        "id-1": {
          id: "id-1",
          name: "name-1",
          duration: 123,
          environment: "chrome",
          status: "failed",
        },
        "id-2": { id: "id-2", name: "name-2", duration: 456, environment: "firefox", status: "passed" },
      },
    });
  });

  it("convertToSummaryCheckResult maps fields", () => {
    const check = { name: "lint", status: "failed" } as AllureCheckResult;

    expect(convertToSummaryCheckResult(check)).toEqual({
      name: "lint",
      status: "failed",
    });
  });

  it("createPluginSummary aggregates store data and history", async () => {
    const filter = vi.fn((tr: TestResult) => tr.status !== "skipped");
    const allChecks = [{ name: "lint", status: "passed" }] as AllureCheckResult[];
    const allTrs = [
      testResult({
        id: "t1",
        name: "one",
        status: "failed",
        duration: 10,
        stop: 100,
      }),
      testResult({ id: "t2", name: "two", status: "broken", duration: 20, stop: 250, flaky: true }),
      testResult({ id: "t3", name: "three", status: "passed", duration: 5, stop: 0 }),
    ];
    const newTrs = [
      testResult({ id: "n1", name: "new", status: "passed", duration: 7 }),
      testResult({ id: "n2", name: "new-2", status: "failed", duration: 9 }),
    ];
    const stats = { total: 3, resolutions: { issues: 1, muted: 1, accepted: 1 } } as any;
    const historyReadHistory = vi.fn().mockResolvedValue([{ branch: "main" }]);
    const history = { readHistory: historyReadHistory } as unknown as AllureHistory;
    const store = {
      allCheckResults: vi.fn().mockResolvedValue(allChecks),
      allTestResults: vi.fn().mockResolvedValue(allTrs),
      allNewTestResults: vi.fn().mockResolvedValue(newTrs),
      testsStatistic: vi.fn().mockResolvedValue(stats),
      retriesByTr: vi.fn((tr: TestResult) => Promise.resolve(tr.id === "t1" ? [{ id: "r1" } as TestResult] : [])),
    };
    const summary = await createPluginSummary({
      name: "summary-name",
      plugin: "summary-plugin",
      store: store as any,
      filter,
      history,
      meta: { build: 1 },
    });

    expect(store.allCheckResults).toHaveBeenCalledTimes(1);
    expect(store.allTestResults).toHaveBeenCalledWith({ filter });
    expect(historyReadHistory).toHaveBeenCalledWith({ branch: "" });
    expect(store.allNewTestResults).toHaveBeenCalledWith(filter, [{ branch: "main" }]);
    expect(store.testsStatistic).toHaveBeenCalledWith(filter);
    expect(summary).toEqual({
      stats,
      status: getWorstStatus(allTrs.map(({ status }) => status)),
      newTests: ["n1", "n2"],
      flakyTests: ["t2"],
      retryTests: ["t1"],
      checks: [{ name: "lint", status: "passed" }],
      name: "summary-name",
      duration: 35,
      createdAt: 250,
      filtered: true,
      plugin: "summary-plugin",
      meta: { build: 1 },
    });
  });

  it("calculateRunDuration uses the wall clock span of parallel test results", () => {
    expect(
      calculateRunDuration([
        testResult({ duration: 100, start: 1000, stop: 1100 }),
        testResult({ duration: 90, start: 1010, stop: 1100 }),
        testResult({ duration: 80, start: 1020, stop: 1100 }),
      ]),
    ).toEqual(100);
  });

  it("calculateRunDuration ignores test results with invalid time bounds", () => {
    expect(
      calculateRunDuration([
        testResult({ duration: 100, start: 1000, stop: 1100 }),
        testResult({ duration: 50, start: Number.NaN, stop: Number.POSITIVE_INFINITY }),
      ]),
    ).toEqual(100);
  });

  it("calculateRunDuration sums durations when test results have no time bounds", () => {
    expect(calculateRunDuration([testResult({ duration: 100 }), testResult({ duration: 90 })])).toEqual(190);
  });

  it("createPluginSummary falls back to passed when status is empty", async () => {
    const store = {
      allCheckResults: vi.fn().mockResolvedValue([]),
      allTestResults: vi.fn().mockResolvedValue([testResult({ status: "passed" })]),
      allNewTestResults: vi.fn().mockResolvedValue([]),
      testsStatistic: vi.fn().mockResolvedValue({ total: 1 }),
      retriesByTr: vi.fn().mockResolvedValue([]),
    };
    const history = { readHistory: vi.fn().mockResolvedValue([]) } as unknown as AllureHistory;
    const summary = await createPluginSummary({
      name: "summary-name",
      plugin: "summary-plugin",
      store: store as any,
      history,
      meta: {},
    });

    expect(summary.status).toBe("passed");
    expect(summary.filtered).toBeUndefined();
    expect(store.allNewTestResults).toHaveBeenCalledWith(undefined, []);
  });
});
