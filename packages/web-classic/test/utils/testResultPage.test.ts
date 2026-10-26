import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  isTestResultTabAvailable,
  resolveTestResultTab,
  selectedTestResultTab,
} from "../../src/stores/testResultTab.js";
import { getHistorySuccessRate } from "../../src/utils/historySuccessRate.js";
import { getAdjacentTestResultIds, getTestResultHash } from "../../src/utils/testResultNavigation.js";
import type { ReportTestResult } from "../../types.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("test result page");
  await label("coverage", "ui-components");
});

describe("utils > getHistorySuccessRate", () => {
  it("counts the current run together with the history like Allure 2", () => {
    expect(getHistorySuccessRate("passed", [{ status: "failed" }, { status: "passed" }])).toEqual({
      passed: 2,
      total: 3,
      rate: 66.67,
    });
  });

  it("counts skipped and broken runs as unsuccessful", () => {
    expect(
      getHistorySuccessRate("failed", [{ status: "skipped" }, { status: "broken" }, { status: "passed" }]),
    ).toEqual({ passed: 1, total: 4, rate: 25 });
  });

  it("returns undefined when there are no runs", () => {
    expect(getHistorySuccessRate(undefined, [])).toBeUndefined();
  });
});

describe("utils > test result navigation", () => {
  const ids = ["a", "b", "c"];

  it("returns the previous and the next result ids in list order", () => {
    expect(getAdjacentTestResultIds(ids, "b")).toEqual({ prevId: "a", nextId: "c", position: 2 });
  });

  it("has no previous result for the first one and no next result for the last one", () => {
    expect(getAdjacentTestResultIds(ids, "a")).toEqual({ prevId: undefined, nextId: "b", position: 1 });
    expect(getAdjacentTestResultIds(ids, "c")).toEqual({ prevId: "b", nextId: undefined, position: 3 });
  });

  it("has no neighbours for a result missing from the list", () => {
    expect(getAdjacentTestResultIds(ids, "x")).toEqual({ prevId: undefined, nextId: undefined, position: 0 });
  });

  it("keeps the tree page and its parent node when navigating from a tree", () => {
    expect(getTestResultHash({ tabName: "suites", params: { id: "node-1", testResultId: "a" } }, "b")).toBe(
      "suites/node-1/b",
    );
    expect(getTestResultHash({ tabName: "behaviors", params: { id: null, testResultId: "a" } }, "b")).toBe(
      "behaviors/root/b",
    );
  });

  it("uses the standalone test result route outside of trees", () => {
    expect(getTestResultHash({ tabName: "testresult", params: { id: "a", testResultId: null } }, "b")).toBe(
      "testresult/b",
    );
  });
});

describe("stores > test result tab", () => {
  const withHistory = { history: [{ id: "h" }], retries: [], attachments: [] } as unknown as ReportTestResult;
  const withoutTabs = { history: [], retries: [], attachments: [] } as unknown as ReportTestResult;

  it("treats tabs without data as unavailable", () => {
    expect(isTestResultTabAvailable(withHistory, "overview")).toBe(true);
    expect(isTestResultTabAvailable(withHistory, "history")).toBe(true);
    expect(isTestResultTabAvailable(withHistory, "retries")).toBe(false);
    expect(isTestResultTabAvailable(withHistory, "attachments")).toBe(false);
    expect(isTestResultTabAvailable(withHistory, "unknown")).toBe(false);
  });

  it("keeps the selected tab for the next result when it is available and falls back to overview otherwise", () => {
    selectedTestResultTab.value = "history";

    expect(
      resolveTestResultTab(
        selectedTestResultTab.value,
        (tab) => isTestResultTabAvailable(withHistory, tab),
        "overview",
      ),
    ).toBe("history");
    expect(
      resolveTestResultTab(
        selectedTestResultTab.value,
        (tab) => isTestResultTabAvailable(withoutTabs, tab),
        "overview",
      ),
    ).toBe("overview");

    selectedTestResultTab.value = "overview";
  });
});
