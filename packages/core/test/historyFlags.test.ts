import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { type HistoryDataPoint, type TestResult, calculateRetryHash, md5Utf8 } from "@allurereport/core-api";
import type { Plugin } from "@allurereport/plugin-api";
import { epic, feature, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveConfig } from "../src/index.js";
import { AllureReport } from "../src/report.js";
import { DefaultAllureStore } from "../src/store/store.js";

const mocks = vi.hoisted(() => ({ getTestFlakiness: vi.fn() }));
vi.mock("@allurereport/core-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@allurereport/core-api")>()),
  getTestFlakiness: mocks.getTestFlakiness,
}));
const testId = "test";
const retryHash = calculateRetryHash({ testCaseHash: md5Utf8(testId), parametersHash: md5Utf8("") })!;
const legacyId = "legacy-test";
const context = { readerId: "test" };
const point = (timestamp: number, key: string, status: "passed" | "failed"): HistoryDataPoint => ({
  uuid: `run-${timestamp}`,
  name: `Run ${timestamp}`,
  timestamp,
  testResults: { [key]: { id: `result-${timestamp}`, name: "test", retryHash: key, status, url: "" } },
  knownTestCaseIds: [],
  metrics: {},
  url: "",
});
const legacyHistory = [point(1, legacyId, "failed"), point(2, legacyId, "passed")];
const mixedHistory = [point(1, legacyId, "failed"), point(2, retryHash, "passed")];
const rawResult = { uuid: "current", testId, name: "current", status: "failed" as const, historyId: legacyId };
const storeWithHistory = (points: HistoryDataPoint[]) =>
  new DefaultAllureStore({
    history: { readHistory: async () => points, appendHistory: async () => {} },
  });
beforeEach(async () => {
  await epic("coverage");
  await feature("history");
  await story("explicit history flag updates");
  mocks.getTestFlakiness.mockReset().mockReturnValue(true);
});

describe("history flags", () => {
  it.each([
    { name: "mixed canonical and legacy", points: mixedHistory },
    { name: "legacy-only", points: legacyHistory },
  ])("resolves $name history for inference and transitions", async ({ points }) => {
    const original = structuredClone(points);
    const store = storeWithHistory(points);
    await store.readHistory();

    await store.visitTestResult(rawResult, context);
    const [result] = await store.allTestResults();
    const history = await store.historyByTrId(result.id);

    expect(result.flaky).toBe(true);
    expect(result.transition).toBe("regressed");
    expect(history).toHaveLength(2);
    expect(mocks.getTestFlakiness).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: result.id }),
      [expect.objectContaining({ id: "result-2" }), expect.objectContaining({ id: "result-1" })],
      { historyDepth: undefined, stabilizationPeriod: undefined },
    );
    expect(points).toEqual(original);
  });
  it.each(["ingestion", "refresh"])(
    "preserves missing entries during %s without changing transitions",
    async (mode) => {
      const missing = { ...point(2, retryHash, "passed"), testResults: {} };
      const points = [point(1, retryHash, "failed"), missing, point(3, retryHash, "passed")];
      const store = storeWithHistory(points);
      await store.readHistory();
      if (mode === "refresh") {
        await store.visitTestResult(rawResult, context);
      }
      mocks.getTestFlakiness.mockClear();

      if (mode === "ingestion") {
        await store.visitTestResult(rawResult, context);
      } else {
        store.updateHistoryFlags();
      }
      const [result] = await store.allTestResults();
      const history = await store.historyByTrId(result.id);

      expect(mocks.getTestFlakiness).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: result.id }),
        [expect.objectContaining({ id: "result-3" }), undefined, expect.objectContaining({ id: "result-1" })],
        { historyDepth: undefined, stabilizationPeriod: undefined },
      );
      expect(result.transition).toBe("regressed");
      expect(history).toHaveLength(2);
    },
  );
  it.each([
    { name: "statistics", query: (store: DefaultAllureStore) => store.testsStatistic() },
    { name: "failures", query: (store: DefaultAllureStore) => store.failedTestResults() },
    { name: "labels", query: (store: DefaultAllureStore) => store.testResultsByLabel("owner") },
  ])("keeps flag recomputation out of $name queries", async ({ query }) => {
    const store = storeWithHistory(mixedHistory);
    await store.readHistory();
    await store.visitTestResult(rawResult, context);
    mocks.getTestFlakiness.mockClear().mockReturnValue(false);

    await query(store);
    const [result] = await store.allTestResults();

    expect(result.flaky).toBe(true);
    expect(result.transition).toBe("regressed");
    expect(mocks.getTestFlakiness).not.toHaveBeenCalled();
  });
  it("preserves ambiguity protection when refreshing a stored result", async () => {
    const store = storeWithHistory(mixedHistory);
    await store.readHistory();
    await store.visitTestResult(rawResult, context);
    const [initial] = await store.allTestResults();
    await store.visitTestResult({ ...rawResult, uuid: "other", testId: "other" }, context);
    mocks.getTestFlakiness.mockClear().mockReturnValue(false);

    store.updateHistoryFlags();
    const result = (await store.allTestResults()).find((entry) => entry.id === initial.id)!;
    const history = await store.historyByTrId(result.id);

    expect(history).toEqual([expect.objectContaining({ retryHash })]);
    expect(mocks.getTestFlakiness).toHaveBeenCalledWith(
      expect.objectContaining({ id: result.id }),
      [expect.objectContaining({ id: "result-2" }), undefined],
      { historyDepth: undefined, stabilizationPeriod: undefined },
    );
    expect(result.flaky).toBe(false);
    expect(result.transition).toBe("regressed");
    expect(store.dumpState().testResults[result.id].flaky).toBe(false);
  });
  it("recomputes inferred flags after a JSON dump round trip", async () => {
    const store = storeWithHistory(legacyHistory);
    await store.readHistory();
    await store.visitTestResult(rawResult, context);
    const dump = JSON.parse(JSON.stringify(store.dumpState()));
    const restored = storeWithHistory([point(4, retryHash, "failed")]);
    await restored.readHistory();
    await restored.restoreState(dump);
    mocks.getTestFlakiness.mockClear().mockReturnValue(false);

    restored.updateHistoryFlags();
    const [result] = await restored.allTestResults();

    expect(result.flaky).toBe(false);
    expect(mocks.getTestFlakiness).toHaveBeenCalled();
  });
  it.each([
    { assessment: "stable", value: false },
    { assessment: "unassessed", value: undefined },
  ])("keeps explicitly reported flaky tests marked with $assessment history", async ({ value }) => {
    const store = storeWithHistory(legacyHistory);
    await store.readHistory();
    mocks.getTestFlakiness.mockReturnValue(value);

    await store.visitTestResult({ ...rawResult, flaky: true }, context);
    const [result] = await store.allTestResults();

    expect(result.flaky).toBe(true);
    expect(store.dumpState().testResults[result.id].flaky).toBe(true);
  });
  it("does not suppress inference with explicitly reported false", async () => {
    const store = storeWithHistory(legacyHistory);
    await store.readHistory();

    await store.visitTestResult({ ...rawResult, flaky: false }, context);
    const [result] = await store.allTestResults();

    expect(result.flaky).toBe(true);
  });
  it("preserves incoming flaky without a history source", async () => {
    const store = new DefaultAllureStore();
    await store.visitTestResult({ ...rawResult, flaky: true }, context);

    store.updateHistoryFlags();
    const [result] = await store.allTestResults();

    expect(result.flaky).toBe(true);
    expect(store.dumpState().testResults[result.id].flaky).toBe(true);
  });
});

describe("report lifecycle", () => {
  const directories: string[] = [];
  afterEach(async () => {
    await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });
  it.each([true, false])("publishes final inferred flags with realtime=%s", async (realTime) => {
    const directory = await mkdtemp(join(tmpdir(), "allure-history-flags-"));
    directories.push(directory);
    const historyPath = join(directory, "history.jsonl");
    const originalHistory = mixedHistory.map((entry) => `${JSON.stringify(entry)}\n`).join("");
    const snapshots: boolean[][] = [];
    const eventSnapshots: boolean[][] = [];
    let finalResults: TestResult[] = [];
    const plugin: Plugin = {
      start: async (_context, store, realtime) => {
        realtime.onTestResults(
          async () => {
            eventSnapshots.push((await store.allTestResults()).map((result) => result.flaky));
          },
          { maxTimeout: 0 },
        );
      },
      update: async (_context, store) => {
        snapshots.push((await store.allTestResults()).map((result) => result.flaky));
      },
      done: async (pluginContext, store) => {
        finalResults = await store.allTestResults();
        await pluginContext.reportFiles.addFile("results.json", Buffer.from(JSON.stringify(finalResults)));
      },
    };
    await writeFile(historyPath, originalHistory, "utf8");
    const config = await resolveConfig(
      { name: "History flags", output: join(directory, "report"), historyPath },
      { plugins: {} },
    );
    const report = new AllureReport({
      ...config,
      realTime,
      plugins: [{ id: "test", enabled: true, options: {}, plugin }],
    });
    await report.start();
    await report.store.visitTestResult(rawResult, context);
    mocks.getTestFlakiness.mockReturnValue(false);
    await report.store.visitTestResult({ ...rawResult, uuid: "other", testId: "other" }, context);
    await vi.waitFor(() => {
      if (!eventSnapshots.some((snapshot) => snapshot.length === 2)) {
        throw new Error("Waiting for result events");
      }
    });

    await report.done();
    const contents = await readFile(historyPath, "utf8");
    const latestPoint = JSON.parse(contents.trim().split("\n").at(-1)!);

    expect(finalResults.map((result) => result.flaky)).toEqual([false, false]);
    expect(eventSnapshots).toContainEqual([false, false]);
    if (realTime) {
      expect(snapshots).toContainEqual([false, false]);
    }
    expect(contents.startsWith(originalHistory)).toBe(true);
    expect(Object.keys(latestPoint.testResults).sort()).toEqual(finalResults.map((result) => result.retryHash!).sort());
    expect(latestPoint.testResults).not.toHaveProperty(legacyId);
  });
});
