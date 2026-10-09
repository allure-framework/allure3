import { calculateRetryHash, md5Utf8, type FlakyDetectionConfig, type HistoryDataPoint } from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { DefaultAllureStore } from "../src/store/store.js";

const testId = "pfs-test";
const retryHash = calculateRetryHash({ testCaseHash: md5Utf8(testId), parametersHash: md5Utf8("") })!;
const context = { readerId: "pfs.test.ts" };
const point: HistoryDataPoint = {
  uuid: "previous-run",
  name: "previous run",
  timestamp: 1,
  knownTestCaseIds: [],
  metrics: {},
  testResults: {
    [retryHash]: { id: "previous", name: "test", status: "passed", retries: ["failed"], url: "" },
  },
};
const visitRecovery = async (store: DefaultAllureStore) => {
  await store.visitTestResult({ uuid: "failed", testId, name: "test", status: "failed", start: 1 }, context);
  await store.visitTestResult({ uuid: "passed", testId, name: "test", status: "passed", start: 2 }, context);
};

beforeEach(async () => {
  await epic("coverage");
  await feature("flakiness-and-transitions");
  await story("Bayesian PFS report integration");
  await label("coverage", "flakiness-and-transitions");
});

describe("PFS report flags", () => {
  it("combines historical and current retries during ingestion and refresh", async () => {
    const history = structuredClone(point);
    const store = new DefaultAllureStore({
      history: { readHistory: async () => [history], appendHistory: async () => {} },
      flakyDetection: { algorithm: "pfs", includePassedTests: true },
    });
    await store.readHistory();

    await visitRecovery(store);
    const [result] = await store.allTestResults();

    expect(result.flaky).toBe(true);
    expect(result.retries).toBeUndefined();
    result.flaky = false;
    store.updateHistoryFlags();
    expect(result.flaky).toBe(true);
    expect(history).toEqual(point);
  });

  it("infers from current retries without a configured history file", async () => {
    const store = new DefaultAllureStore({ flakyDetection: { algorithm: "pfs", includePassedTests: true } });
    await store.visitTestResult({ uuid: "broken", testId, name: "test", status: "broken", start: 0 }, context);

    await visitRecovery(store);
    const [result] = await store.allTestResults();

    expect(result.flaky).toBe(true);
    result.flaky = false;
    store.updateHistoryFlags();
    expect(result.flaky).toBe(true);
  });

  it("marks first results new when a history source is configured", async () => {
    const store = new DefaultAllureStore({
      history: { readHistory: async () => [], appendHistory: async () => {} },
      flakyDetection: { algorithm: "pfs", includePassedTests: true },
    });
    await store.readHistory();
    await visitRecovery(store);

    store.updateHistoryFlags();
    const [result] = await store.allTestResults();

    expect(result.transition).toBe("new");
  });

  it("preserves a restored transition when refreshing flakiness without history", async () => {
    const flakyDetection: FlakyDetectionConfig = { algorithm: "pfs", pfsThreshold: 0 };
    const source = new DefaultAllureStore({
      history: { readHistory: async () => [point], appendHistory: async () => {} },
      flakyDetection,
    });
    await source.readHistory();
    await source.visitTestResult({ uuid: "current", testId, name: "test", status: "failed" }, context);
    const [initial] = await source.allTestResults();
    expect(initial.flaky).toBe(true);
    expect(initial.transition).toBe("regressed");
    const dump = JSON.parse(JSON.stringify(source.dumpState()));
    const restored = new DefaultAllureStore({ flakyDetection });
    await restored.restoreState(dump);

    restored.updateHistoryFlags();
    const [result] = await restored.allTestResults();

    expect(result.flaky).toBe(false);
    expect(result.transition).toBe("regressed");
  });

  it.each([
    [{ algorithm: "pfs" }, false],
    [{ algorithm: "pfs", includePassedTests: true, pfsThreshold: 0.2 }, false],
    [{ algorithm: "pfs", includePassedTests: true, historyDepth: -1 }, false],
  ] as [FlakyDetectionConfig, boolean][])("honors badge settings %j", async (flakyDetection, expected) => {
    const store = new DefaultAllureStore({
      history: { readHistory: async () => [point], appendHistory: async () => {} },
      flakyDetection,
    });
    await store.readHistory();

    await visitRecovery(store);

    expect((await store.allTestResults())[0].flaky).toBe(expected);
  });

  it("preserves SDK-reported flakiness despite disabled inference", async () => {
    const store = new DefaultAllureStore({ flakyDetection: { algorithm: "pfs", historyDepth: -1 } });

    await store.visitTestResult({ uuid: "reported", testId, name: "test", status: "passed", flaky: true }, context);
    store.updateHistoryFlags();

    expect((await store.allTestResults())[0].flaky).toBe(true);
  });
});
