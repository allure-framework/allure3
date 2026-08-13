import { type AllureCheckResult, type AllureHistory, type TestResult, getWorstStatus } from "@allurereport/core-api";
import { describe, expect, it, vi } from "vitest";

import {
  convertToSummaryCheckResult,
  convertToTestResultSummary,
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
      convertToTestResultSummary(testResult({ id: "id-1", name: "name-1", status: "failed", duration: 123 })),
    ).toEqual({
      id: "id-1",
      name: "name-1",
      status: "failed",
      duration: 123,
    });
  });

  it("createTestResultRegistry indexes reduced test results by id", () => {
    expect(
      createTestResultRegistry([
        testResult({ id: "id-1", name: "name-1", status: "failed", duration: 123 }),
        testResult({ id: "id-2", name: "name-2", status: "passed", duration: 456 }),
      ]),
    ).toEqual({
      byId: {
        "id-1": { id: "id-1", name: "name-1", duration: 123, status: "failed" },
        "id-2": { id: "id-2", name: "name-2", duration: 456, status: "passed" },
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
    const stats = { total: 3 } as any;
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
    expect(store.allTestResults).toHaveBeenCalledWith({ includeRetries: false, filter });
    expect(historyReadHistory).toHaveBeenCalledWith({ branch: "" });
    expect(store.allNewTestResults).toHaveBeenCalledWith(filter, [{ branch: "main" }]);
    expect(store.testsStatistic).toHaveBeenCalledWith(expect.any(Function));
    expect(summary).toEqual({
      stats,
      status: getWorstStatus(allTrs.map(({ status }) => status)),
      newTests: ["n1", "n2"],
      flakyTests: ["t2"],
      retryTests: ["t1"],
      knownTests: [],
      checks: [{ name: "lint", status: "passed" }],
      name: "summary-name",
      duration: 35,
      createdAt: 250,
      plugin: "summary-plugin",
      meta: { build: 1 },
    });
  });

  it("createPluginSummary excludes known unsuccessful tests from health stats and status", async () => {
    const allTrs = [
      testResult({ id: "known-failed", name: "known failed", status: "failed", known: true, duration: 10 }),
      testResult({ id: "known-broken", name: "known broken", status: "broken", known: true, duration: 20 }),
      testResult({ id: "passed", name: "passed", status: "passed", duration: 30 }),
    ];
    const store = {
      allCheckResults: vi.fn().mockResolvedValue([]),
      allTestResults: vi.fn().mockResolvedValue(allTrs),
      allNewTestResults: vi.fn().mockResolvedValue([]),
      testsStatistic: vi.fn(async (filter: (tr: TestResult) => boolean) => {
        const filtered = allTrs.filter(filter);

        return filtered.reduce(
          (acc, tr) => {
            acc[tr.status] = (acc[tr.status] ?? 0) + 1;
            acc.total += 1;

            return acc;
          },
          { total: 0 } as Record<string, number>,
        );
      }),
      retriesByTr: vi.fn().mockResolvedValue([]),
    };

    const summary = await createPluginSummary({
      name: "summary-name",
      plugin: "summary-plugin",
      store: store as any,
      meta: {},
    });

    expect(summary.status).toBe("passed");
    expect(summary.stats).toEqual({ total: 1, passed: 1, known: 2 });
    expect(summary.knownTests).toEqual(["known-failed", "known-broken"]);
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
    expect(store.allNewTestResults).toHaveBeenCalledWith(undefined, []);
    expect(summary.knownTests).toEqual([]);
  });
});
