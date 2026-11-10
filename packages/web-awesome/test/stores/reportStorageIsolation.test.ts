import { getReportStorageKey } from "@allurereport/web-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const openReportAt = async (pathname: string) => {
  window.history.replaceState(null, "", pathname);
  vi.resetModules();

  const tree = await import("../../src/stores/tree.js");
  const env = await import("../../src/stores/env.js");

  return { ...tree, ...env };
};

describe("stores > report state isolation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("does not leak tree and environment state between reports hosted on the same origin", async () => {
    const first = await openReportAt("/reports/1/index.html");

    first.collapsedTrees.value = new Set(["suite-a"]);
    first.expandedTrees.value = new Set(["suite-b"]);
    first.currentEnvironment.value = "staging";
    first.collapsedEnvironments.value = ["production"];

    const second = await openReportAt("/reports/2/index.html");

    expect([...second.collapsedTrees.value]).toEqual([]);
    expect([...second.expandedTrees.value]).toEqual([]);
    expect(second.currentEnvironment.value).toBe("");
    expect(second.collapsedEnvironments.value).toEqual([]);
  });

  it("restores the state of a report reopened from the same directory", async () => {
    const first = await openReportAt("/project/latest/");

    first.collapsedTrees.value = new Set(["suite-a"]);
    first.currentEnvironment.value = "staging";

    const regenerated = await openReportAt("/project/latest/index.html");

    expect([...regenerated.collapsedTrees.value]).toEqual(["suite-a"]);
    expect(regenerated.currentEnvironment.value).toBe("staging");
    expect(localStorage.getItem(getReportStorageKey("collapsedTrees", "/project/latest/"))).toBe('["suite-a"]');
  });

  it("does not pick up state saved under the legacy origin-wide keys", async () => {
    localStorage.setItem("collapsedTrees", '["legacy"]');
    localStorage.setItem("currentEnvironment", '"legacy"');

    const report = await openReportAt("/reports/1/");

    expect([...report.collapsedTrees.value]).toEqual([]);
    expect(report.currentEnvironment.value).toBe("");
  });
});
