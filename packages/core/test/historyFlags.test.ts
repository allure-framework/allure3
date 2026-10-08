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

const testId = "test";
const retryHash = calculateRetryHash({ testCaseHash: md5Utf8(testId), parametersHash: md5Utf8("") })!;
const legacyId = "legacy-test";
const context = { readerId: "test" };
const point = (timestamp: number, key: string, status: "passed" | "failed"): HistoryDataPoint => ({
  uuid: `run-${timestamp}`,
  name: `Run ${timestamp}`,
  timestamp,
  testResults: {
    [key]: { id: `result-${timestamp}`, name: "test", retryHash: key, status, url: "" },
  },
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
});

describe("history flags", () => {
  it.each([
    { name: "mixed canonical and legacy", points: mixedHistory },
    { name: "legacy-only", points: legacyHistory },
  ])("calculates flaky from all available $name history", async ({ points }) => {
    const original = structuredClone(points);
    const store = storeWithHistory(points);

    await store.readHistory();
    await store.visitTestResult(rawResult, context);

    const [result] = await store.allTestResults();

    expect(result.flaky).toBe(true);
    expect(result.transition).toBe("regressed");
    expect(await store.historyByTrId(result.id)).toHaveLength(points.length);

    // Queries do not update flags as a side effect.
    await store.testsStatistic();
    await store.failedTestResults();
    await store.testResultsByLabel("owner");
    expect(result.flaky).toBe(true);
    expect(result.transition).toBe("regressed");

    store.updateHistoryFlags();

    expect(result.flaky).toBe(true);
    expect((await store.testsStatistic()).flaky).toBe(1);
    expect(store.dumpState().testResults[result.id].flaky).toBe(true);
    expect(points).toEqual(original);
  });

  it("recomputes a previous snapshot when a later result makes its legacy alias ambiguous", async () => {
    const store = storeWithHistory(mixedHistory);

    await store.readHistory();
    await store.visitTestResult(rawResult, context);
    store.updateHistoryFlags();

    const [result] = await store.allTestResults();

    expect(result.flaky).toBe(true);
    await store.visitTestResult({ ...rawResult, uuid: "other", testId: "other" }, context);

    expect(await store.historyByTrId(result.id)).toEqual([expect.objectContaining({ retryHash })]);
    expect(result.flaky).toBe(true);

    store.updateHistoryFlags();

    expect(result.flaky).toBe(false);
    expect(result.transition).toBe("regressed");
    expect(store.dumpState().testResults[result.id].flaky).toBe(false);
  });

  it("recalculates directly stored flaky after a JSON dump round trip", async () => {
    const store = storeWithHistory(legacyHistory);

    await store.readHistory();
    await store.visitTestResult(rawResult, context);
    store.updateHistoryFlags();

    const dump = JSON.parse(JSON.stringify(store.dumpState()));
    const restored = storeWithHistory([point(4, retryHash, "failed")]);

    await restored.readHistory();
    await restored.restoreState(dump);

    const [result] = await restored.allTestResults();

    expect(result.flaky).toBe(true);
    restored.updateHistoryFlags();
    expect(result.flaky).toBe(false);
  });

  it("preserves incoming flaky when no history source is configured", async () => {
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

  it.each([true, false])("updates event subscribers and final snapshots with realtime=%s", async (realTime) => {
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

    try {
      await report.store.visitTestResult(rawResult, context);
      await vi.waitFor(() => expect(eventSnapshots).toContainEqual([true]));

      if (realTime) {
        await vi.waitFor(() => expect(snapshots).toContainEqual([true]));
      }

      await report.store.visitTestResult({ ...rawResult, uuid: "other", testId: "other" }, context);
      await vi.waitFor(() => expect(eventSnapshots).toContainEqual([false, false]));

      if (realTime) {
        await vi.waitFor(() => expect(snapshots).toContainEqual([false, false]));
      } else {
        expect(snapshots).toEqual([]);
      }
    } finally {
      await report.done();
    }

    expect(finalResults.map((result) => result.flaky)).toEqual([false, false]);

    const contents = await readFile(historyPath, "utf8");
    const latestPoint = JSON.parse(contents.trim().split("\n").at(-1)!);

    expect(contents.startsWith(originalHistory)).toBe(true);
    expect(Object.keys(latestPoint.testResults).sort()).toEqual(finalResults.map((result) => result.retryHash!).sort());
    expect(latestPoint.testResults).not.toHaveProperty(legacyId);
  });
});
