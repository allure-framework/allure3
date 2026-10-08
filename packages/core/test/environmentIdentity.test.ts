import type { HistoryDataPoint } from "@allurereport/core-api";
import { epic, feature, story } from "allure-js-commons";
import { beforeEach, expect, it } from "vitest";

import { DefaultAllureStore } from "../src/store/store.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("report-engine");
  await story("environment identity boundaries");
});

it("resolves current display-name APIs without storing names as IDs", async () => {
  const historyPoint: HistoryDataPoint = {
    uuid: "previous",
    name: "Previous report",
    timestamp: 1,
    knownTestCaseIds: [],
    metrics: {},
    url: "",
    testResults: { key: { id: "previous-result", name: "test", status: "passed", environment: "linux", url: "" } },
  };
  const store = new DefaultAllureStore({
    environmentsConfig: { linux: { name: "Chrome", matcher: () => true, variables: { os: "Linux" } } },
    history: { readHistory: async () => [historyPoint], appendHistory: async () => {} },
  });
  await store.readHistory();
  await store.visitTestResult({ name: "test", testId: "test" }, { readerId: "test" });
  const [testResult] = await store.allTestResults();
  expect(testResult.environment).toBe("linux");
  expect(await store.testResultsByEnvironment("Chrome")).toEqual([testResult]);
  expect(await store.envVariables("Chrome")).toEqual({ os: "Linux" });
  const [scopedHistory] = await store.allHistoryDataPointsByEnvironment("Chrome");
  expect(scopedHistory.testResults.key.environment).toBe("linux");

  const dump = JSON.parse(JSON.stringify(store.dumpState()));
  dump.qualityGateResults = [{ rule: "maxFailures", success: true, environment: "Chrome" }];
  await store.restoreState(dump);
  expect(await store.qualityGateResultsByEnvironmentId()).toEqual({
    linux: [expect.objectContaining({ environment: "Chrome", success: true })],
  });
});

it("does not reassign default historical results to the current forced environment", async () => {
  const point: HistoryDataPoint = {
    uuid: "old",
    name: "old",
    timestamp: 1,
    knownTestCaseIds: [],
    metrics: {},
    url: "",
    testResults: { old: { id: "old-result", name: "test", status: "passed", url: "" } },
  };
  const store = new DefaultAllureStore({
    environment: "qa",
    history: { readHistory: async () => [point], appendHistory: async () => {} },
  });
  await store.readHistory();
  expect((await store.allHistoryDataPointsByEnvironmentId("qa"))[0].testResults).toEqual({});
  expect((await store.allHistoryDataPointsByEnvironmentId("default"))[0].testResults.old.id).toBe("old-result");
  expect(point.testResults.old.environment).toBeUndefined();
});
