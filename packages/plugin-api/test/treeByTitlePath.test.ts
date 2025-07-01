import type { TestResult } from "@allurereport/core-api";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createTreeByTitlePath } from "../src/utils/tree.js";

const itResult = (args: Partial<TestResult> & { titlePath: string[] }): TestResult => ({
  id: randomUUID(),
  name: "default",
  status: "passed",
  steps: [],
  parameters: [],
  labels: [],
  links: [],
  flaky: false,
  muted: false,
  hidden: false,
  known: false,
  sourceMetadata: {
    readerId: "system",
    metadata: {},
  },
  ...args,
});

const sampleLeafFactory = (tr: TestResult) => ({
  nodeId: tr.id,
  name: tr.name,
  status: tr.status,
  duration: tr.duration,
  flaky: tr.flaky,
  start: tr.start,
  retry: !!tr.retries?.length,
  retriesCount: tr.retries?.length || 0,
});

describe("createTreeByTitlePath", () => {
  it("should return empty tree for empty input", () => {
    const result = createTreeByTitlePath([], () => [], sampleLeafFactory);

    expect(result.root.groups).toHaveLength(0);
    expect(result.root.leaves).toHaveLength(0);
    expect(result.groupsById).toEqual({});
    expect(result.leavesById).toEqual({});
  });

  it("should ignore tests with empty titlePath", () => {
    const tr1 = itResult({ titlePath: [] });
    const tr2 = itResult({ titlePath: [] });

    const result = createTreeByTitlePath([tr1, tr2], (t) => t.titlePath || [], sampleLeafFactory);

    expect(result.root.leaves).toHaveLength(0);
    expect(result.leavesById).toEqual({});
    expect(result.groupsById).toEqual({});
  });

  it("should create one level grouping", () => {
    const tr1 = itResult({ titlePath: ["file1.spec.ts"], name: "tr1" });
    const tr2 = itResult({ titlePath: ["file2.spec.ts"], name: "tr2" });

    const result = createTreeByTitlePath([tr1, tr2], (t) => t.titlePath ?? [], sampleLeafFactory);

    expect(result.root.groups).toHaveLength(2);

    for (const groupId of result.root.groups) {
      const group = result.groupsById[groupId];
      expect(group.leaves).toHaveLength(1);
      const leafId = group.leaves[0];
      expect(result.leavesById[leafId]).toBeDefined();
    }
  });

  it("should create nested groups", () => {
    const tr = itResult({ titlePath: ["folder", "file.spec.ts", "suite"], name: "tr" });

    const result = createTreeByTitlePath([tr], (t) => t.titlePath ?? [], sampleLeafFactory);

    const rootGroupId = result.root.groups[0];
    const g1 = result.groupsById[rootGroupId];
    expect(g1.name).toBe("folder");

    const g2 = result.groupsById[g1.groups[0]];
    expect(g2.name).toBe("file.spec.ts");

    const g3 = result.groupsById[g2.groups[0]];
    expect(g3.name).toBe("suite");

    expect(g3.leaves).toContain(tr.id);
    expect(result.leavesById[tr.id]).toBeDefined();
  });

  it("should accumulate statistics in groups", () => {
    const passed = itResult({ titlePath: ["group"], status: "passed" });
    const failed = itResult({ titlePath: ["group"], status: "failed" });

    const result = createTreeByTitlePath([passed, failed], (t) => t.titlePath ?? [], sampleLeafFactory);
    const groupId = result.root.groups[0];
    const group = result.groupsById[groupId];

    expect(group.statistic.total).toBe(2);
    expect(group.statistic.passed).toBe(1);
    expect(group.statistic.failed).toBe(1);
  });

  it("should place only non-empty titlePath in groups", () => {
    const tr1 = itResult({ titlePath: [], name: "no-group" });
    const tr2 = itResult({ titlePath: ["A"], name: "grouped" });

    const result = createTreeByTitlePath([tr1, tr2], (t) => t.titlePath ?? [], sampleLeafFactory);

    expect(result.root.leaves).not.toContain(tr1.id);
    expect(result.leavesById).not.toHaveProperty(tr1.id);

    expect(result.root.groups).toHaveLength(1);
    const groupId = result.root.groups[0];
    expect(result.groupsById[groupId].leaves).toContain(tr2.id);
  });
});
