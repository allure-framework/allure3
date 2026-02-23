import { type TestResult, type TreeData, compareBy, nullsLast, ordinal } from "@allurereport/core-api";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  byLabels,
  createTreeByLabels,
  filterTree,
  filterTreeLabels,
  preciseTreeLabels,
  sortTree,
  transformTree,
} from "../src/index.js";

const itResult = (args: Partial<TestResult>): TestResult => ({
  id: randomUUID(),
  name: "first",
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
const sampleTree = {
  root: {
    leaves: ["l1", "l2"],
    groups: ["g1"],
  },
  leavesById: {
    l1: { nodeId: "l1", name: "1", status: "passed", start: 5000 },
    l2: { nodeId: "l2", name: "2", status: "failed", start: 3000 },
    l3: { nodeId: "l3", name: "3", status: "passed", start: 4000 },
    l4: { nodeId: "l4", name: "4", status: "failed", start: 0 },
    l5: { nodeId: "l5", name: "5", status: "passed", start: 2000 },
    l6: { nodeId: "l6", name: "6", status: "failed", start: 1000 },
  },
  groupsById: {
    g1: { nodeId: "g1", name: "1", groups: ["g2"], leaves: ["l3", "l4"] },
    g2: { nodeId: "g2", name: "2", groups: [], leaves: ["l5", "l6"] },
  },
};
const sampleLeafFactory = (tr: TestResult) => ({
  nodeId: tr.id,
  name: tr.name,
  status: tr.status,
  duration: tr.duration,
  flaky: tr.flaky,
});

describe("tree builder", () => {
  it("should create empty tree", async () => {
    const data: TestResult[] = [];
    const treeByLabels = createTreeByLabels(data, []);

    expect(treeByLabels.root.groups).toHaveLength(0);
    expect(treeByLabels.root.leaves).toHaveLength(0);
    expect(treeByLabels.groupsById).toEqual({});
    expect(treeByLabels.leavesById).toEqual({});
  });

  it("should create tree without groups", async () => {
    const tr1 = itResult({ name: "first" });
    const tr2 = itResult({ name: "second" });
    const treeByLabels = createTreeByLabels([tr1, tr2], [], sampleLeafFactory);

    expect(treeByLabels.root.groups).toHaveLength(0);
    expect(treeByLabels.root.leaves).toContain(tr1.id);
    expect(treeByLabels.root.leaves).toContain(tr2.id);
    expect(treeByLabels.groupsById).toEqual({});
    expect(treeByLabels.leavesById).toHaveProperty(tr1.id, {
      nodeId: tr1.id,
      name: tr1.name,
      status: tr1.status,
      duration: tr1.duration,
      flaky: tr1.flaky,
    });
    expect(treeByLabels.leavesById).toHaveProperty(tr2.id, {
      nodeId: tr2.id,
      name: tr2.name,
      status: tr2.status,
      duration: tr2.duration,
      flaky: tr2.flaky,
    });
  });

  it("should create tree with one level grouping", async () => {
    const tr1 = itResult({
      name: "tr1",
      labels: [{ name: "feature", value: "A" }],
    });
    const tr2 = itResult({
      name: "tr2",
      labels: [{ name: "feature", value: "A" }],
    });
    const tr3 = itResult({
      name: "tr3",
      labels: [
        { name: "feature", value: "B" },
        { name: "story", value: "A" },
      ],
    });
    const treeByLabels = createTreeByLabels([tr1, tr2, tr3], ["feature"], sampleLeafFactory);

    expect(treeByLabels.root.groups).toHaveLength(2);
    const rootGroup1 = treeByLabels.root.groups![0];
    const rootGroup2 = treeByLabels.root.groups![1];
    expect(treeByLabels.root.leaves).toHaveLength(0);

    expect(treeByLabels.groupsById).toHaveProperty(rootGroup1);
    expect(treeByLabels.groupsById).toHaveProperty(rootGroup2);

    const group1 = treeByLabels.groupsById[rootGroup1];
    expect(group1).toHaveProperty("name", "A");
    expect(group1.groups).toBeUndefined();
    expect(group1.leaves).toContain(tr1.id);
    expect(group1.leaves).toContain(tr2.id);

    const group2 = treeByLabels.groupsById[rootGroup2];
    expect(group2).toHaveProperty("name", "B");
    expect(group2.groups).toBeUndefined();
    expect(group2.leaves).toContain(tr3.id);

    expect(treeByLabels.leavesById).toHaveProperty(tr1.id, {
      nodeId: tr1.id,
      name: tr1.name,
      status: tr1.status,
      duration: tr1.duration,
      flaky: tr1.flaky,
    });
    expect(treeByLabels.leavesById).toHaveProperty(tr2.id, {
      nodeId: tr2.id,
      name: tr2.name,
      status: tr2.status,
      duration: tr2.duration,
      flaky: tr2.flaky,
    });
    expect(treeByLabels.leavesById).toHaveProperty(tr3.id, {
      nodeId: tr3.id,
      name: tr3.name,
      status: tr3.status,
      duration: tr3.duration,
      flaky: tr3.flaky,
    });
  });

  it("should render leaves without group in root", async () => {
    const tr1 = itResult({
      name: "tr1",
      labels: [{ name: "feature", value: "A" }],
    });
    const tr2 = itResult({
      name: "tr2",
      labels: [{ name: "not a feature", value: "A" }],
    });
    const tr3 = itResult({
      name: "tr3",
      labels: [
        { name: "feature", value: "B" },
        { name: "story", value: "A" },
      ],
    });
    const treeByLabels = createTreeByLabels([tr1, tr2, tr3], ["feature"], sampleLeafFactory);

    expect(treeByLabels.root.leaves).toHaveLength(1);
    expect(treeByLabels.root.leaves).toContain(tr2.id);

    expect(treeByLabels.leavesById).toHaveProperty(tr2.id, {
      nodeId: tr2.id,
      name: tr2.name,
      status: tr2.status,
      duration: tr2.duration,
      flaky: tr2.flaky,
    });
  });

  it("should render nested groups with the same name", async () => {
    const tr1 = itResult({
      name: "tr1",
      labels: [{ name: "feature", value: "A" }],
    });
    const tr2 = itResult({
      name: "tr2",
      labels: [
        { name: "feature", value: "A" },
        { name: "story", value: "A" },
      ],
    });
    const tr3 = itResult({
      name: "tr3",
      labels: [
        { name: "feature", value: "A" },
        { name: "story", value: "B" },
      ],
    });
    const treeByLabels = createTreeByLabels([tr1, tr2, tr3], ["feature", "story"]);

    expect(treeByLabels.root.leaves).toHaveLength(0);
    expect(treeByLabels.root.groups).toHaveLength(1);
    const featureAUuid = treeByLabels.root.groups![0];
    expect(treeByLabels.groupsById).toHaveProperty(featureAUuid);
    expect(treeByLabels.groupsById[featureAUuid]).toHaveProperty("nodeId", featureAUuid);
    expect(treeByLabels.groupsById[featureAUuid]).toHaveProperty("name", "A");
    expect(treeByLabels.groupsById[featureAUuid]).toHaveProperty("leaves", [tr1.id]);
    expect(treeByLabels.groupsById[featureAUuid]?.groups).toHaveLength(2);
    const storyAUuid = treeByLabels.groupsById[featureAUuid]?.groups![0];
    expect(treeByLabels.groupsById[storyAUuid]).toHaveProperty("nodeId", storyAUuid);
    expect(treeByLabels.groupsById[storyAUuid]).toHaveProperty("name", "A");
    expect(treeByLabels.groupsById[storyAUuid]).toHaveProperty("leaves", [tr2.id]);
    const storyBUuid = treeByLabels.groupsById[featureAUuid]?.groups![1];
    expect(treeByLabels.groupsById[storyBUuid]).toHaveProperty("nodeId", storyBUuid);
    expect(treeByLabels.groupsById[storyBUuid]).toHaveProperty("name", "B");
    expect(treeByLabels.groupsById[storyBUuid]).toHaveProperty("leaves", [tr3.id]);
  });

  it("should skip missing labels and keep deeper labels", async () => {
    const tr1 = itResult({
      name: "with full suite depth",
      labels: [
        { name: "parentSuite", value: "frontend" },
        { name: "suite", value: "checkout" },
        { name: "subSuite", value: "happy path" },
      ],
    });
    const tr2 = itResult({
      name: "without subSuite",
      labels: [
        { name: "parentSuite", value: "frontend" },
        { name: "suite", value: "checkout" },
      ],
    });
    const tr3 = itResult({
      name: "without parentSuite",
      labels: [{ name: "suite", value: "payments" }],
    });

    const treeByLabels = createTreeByLabels([tr1, tr2, tr3], ["parentSuite", "suite", "subSuite"]);
    const rootGroupIds = treeByLabels.root.groups ?? [];
    const rootGroupNames = rootGroupIds.map((id) => treeByLabels.groupsById[id]?.name).sort();

    expect(rootGroupNames).toEqual(["frontend", "payments"]);

    const frontendGroupId = rootGroupIds.find((id) => treeByLabels.groupsById[id]?.name === "frontend")!;
    const frontendGroup = treeByLabels.groupsById[frontendGroupId];
    expect(frontendGroup.leaves).toBeUndefined();
    expect(frontendGroup.groups).toHaveLength(1);

    const checkoutGroupId = frontendGroup.groups![0];
    const checkoutGroup = treeByLabels.groupsById[checkoutGroupId];
    expect(checkoutGroup.leaves).toContain(tr2.id);
    expect(checkoutGroup.groups).toHaveLength(1);

    const happyPathGroup = treeByLabels.groupsById[checkoutGroup.groups![0]];
    expect(happyPathGroup.name).toBe("happy path");
    expect(happyPathGroup.leaves).toEqual([tr1.id]);

    const paymentsGroupId = rootGroupIds.find((id) => treeByLabels.groupsById[id]?.name === "payments")!;
    expect(treeByLabels.groupsById[paymentsGroupId].leaves).toEqual([tr3.id]);
  });

  it("should handle prototype-like group names", async () => {
    const tr1 = itResult({
      name: "proto key",
      labels: [{ name: "suite", value: "__proto__" }],
    });
    const tr2 = itResult({
      name: "constructor key",
      labels: [{ name: "suite", value: "constructor" }],
    });
    const tr3 = itResult({
      name: "toString key",
      labels: [{ name: "suite", value: "toString" }],
    });

    const treeByLabels = createTreeByLabels([tr1, tr2, tr3], ["suite"]);
    const rootGroupIds = treeByLabels.root.groups ?? [];
    const rootGroupNames = rootGroupIds.map((id) => treeByLabels.groupsById[id]?.name).sort();

    expect(rootGroupNames).toEqual(["__proto__", "constructor", "toString"]);
    for (const groupId of rootGroupIds) {
      expect(treeByLabels.groupsById[groupId]?.leaves).toHaveLength(1);
    }
  });

  it("should not crash if groupFactory returns malformed value", async () => {
    const tr = itResult({
      name: "tr malformed group",
      labels: [{ name: "suite", value: "broken-group" }],
    });

    expect(() =>
      createTreeByLabels(
        [tr],
        ["suite"],
        sampleLeafFactory,
        () => null as unknown as { nodeId: string; name: string; statistic: { total: number } },
      ),
    ).not.toThrow();
  });
});

describe("tree sorting", () => {
  it("sorts leaves if comparator is passed", () => {
    const tree = JSON.parse(JSON.stringify(sampleTree));
    const res = sortTree(tree as TreeData<any, any>, nullsLast(compareBy("start", ordinal())));

    expect(res).toMatchObject({
      root: expect.objectContaining({
        leaves: ["l2", "l1"],
      }),
      groupsById: expect.objectContaining({
        g1: { nodeId: "g1", name: "1", groups: ["g2"], leaves: ["l4", "l3"] },
        g2: { nodeId: "g2", name: "2", groups: [], leaves: ["l6", "l5"] },
      }),
    });
  });
});

describe("tree transformation", () => {
  it("transforms leaves if comparator is passed", () => {
    const tree = JSON.parse(JSON.stringify(sampleTree));
    const res = transformTree(tree as TreeData<any, any>, (leaf, i) => ({
      ...leaf,
      groupOrder: i + 1,
    }));

    expect(res).toMatchObject({
      leavesById: {
        l1: {
          groupOrder: 1,
          name: "1",
          nodeId: "l1",
          start: 5000,
          status: "passed",
        },
        l2: {
          groupOrder: 2,
          name: "2",
          nodeId: "l2",
          start: 3000,
          status: "failed",
        },
        l3: {
          groupOrder: 1,
          name: "3",
          nodeId: "l3",
          start: 4000,
          status: "passed",
        },
        l4: {
          groupOrder: 2,
          name: "4",
          nodeId: "l4",
          start: 0,
          status: "failed",
        },
        l5: {
          groupOrder: 1,
          name: "5",
          nodeId: "l5",
          start: 2000,
          status: "passed",
        },
        l6: {
          groupOrder: 2,
          name: "6",
          nodeId: "l6",
          start: 1000,
          status: "failed",
        },
      },
    });
  });
});

describe("tree filtering", () => {
  it("transforms leaves if comparator is passed", () => {
    const tree = JSON.parse(JSON.stringify(sampleTree));
    const res = filterTree(tree as TreeData<any, any>, (leaf) => leaf.status !== "passed");

    expect(res).toMatchObject({
      root: {
        leaves: ["l2"],
        groups: ["g1"],
      },
      groupsById: {
        g1: { nodeId: "g1", name: "1", groups: ["g2"], leaves: ["l4"] },
        g2: { nodeId: "g2", name: "2", groups: [], leaves: ["l6"] },
      },
    });
  });
});

describe("filterTreeLabels", () => {
  it("returns labels that exist in the given test results", () => {
    expect(
      filterTreeLabels(
        [
          {
            labels: [
              { name: "parentSuite", value: "foo" },
              {
                name: "suite",
                value: "bar",
              },
              { name: "subSuite", value: "baz" },
            ],
          } as TestResult,
        ],
        ["parentSuite", "suite", "subSuite"],
      ),
    ).toEqual(["parentSuite", "suite", "subSuite"]);
    expect(
      filterTreeLabels(
        [
          {
            labels: [
              {
                name: "suite",
                value: "bar",
              },
              { name: "subSuite", value: "baz" },
            ],
          } as TestResult,
        ],
        ["parentSuite", "suite", "subSuite"],
      ),
    ).toEqual(["suite", "subSuite"]);
    expect(
      filterTreeLabels(
        [
          {
            labels: [{ name: "subSuite", value: "baz" }],
          } as TestResult,
        ],
        ["parentSuite", "suite", "subSuite"],
      ),
    ).toEqual(["subSuite"]);
  });
});

describe("preciseTreeLabels", () => {
  it("should return labels that only exist in the given test results", () => {
    const tr1 = itResult({
      name: "tr1",
      labels: [
        { name: "parentSuite", value: "A" },
        { name: "suite", value: "B" },
        { name: "subSuite", value: "C" },
      ],
    });
    const tr2 = itResult({
      name: "tr2",
      labels: [
        { name: "suite", value: "B" },
        { name: "subSuite", value: "C" },
      ],
    });
    const tr3 = itResult({
      name: "tr3",
      labels: [{ name: "subSuite", value: "C" }],
    });

    expect(preciseTreeLabels(["parentSuite", "suite", "subSuite"], [tr1, tr2, tr3])).toEqual([
      "parentSuite",
      "suite",
      "subSuite",
    ]);
  });

  it("should omit labels that don't exist in the given test results", () => {
    const tr1 = itResult({
      name: "tr1",
      labels: [
        { name: "suite", value: "B" },
        { name: "subSuite", value: "C" },
      ],
    });
    const tr2 = itResult({
      name: "tr2",
      labels: [
        { name: "suite", value: "B" },
        { name: "subSuite", value: "C" },
      ],
    });
    const tr3 = itResult({
      name: "tr3",
      labels: [{ name: "subSuite", value: "C" }],
    });

    expect(preciseTreeLabels(["parentSuite", "suite", "subSuite"], [tr1, tr2, tr3])).toEqual(["suite", "subSuite"]);
  });

  it("should allow to extract labels from custom data structures via accessor function", () => {
    const tr1 = {
      l: [
        { name: "suite", value: "B" },
        { name: "subSuite", value: "C" },
      ],
    };
    const tr2 = {
      l: [
        { name: "suite", value: "B" },
        { name: "subSuite", value: "C" },
      ],
    };
    const tr3 = {
      l: [{ name: "subSuite", value: "C" }],
    };

    expect(
      preciseTreeLabels(["parentSuite", "suite", "subSuite"], [tr1, tr2, tr3], ({ l }) => l.map(({ name }) => name)),
    ).toEqual(["suite", "subSuite"]);
  });

  it("shouldn't change the original labels order during processing the given test results", () => {
    const tr1 = {
      labels: [
        { name: "suite", value: "B" },
        { name: "subSuite", value: "C" },
      ],
    };
    const tr2 = {
      labels: [
        { name: "suite", value: "B" },
        { name: "subSuite", value: "C" },
      ],
    };
    const tr3 = {
      labels: [
        { name: "subSuite", value: "C" },
        { name: "parentSuite", value: "A" },
      ],
    };

    expect(preciseTreeLabels(["parentSuite", "suite", "subSuite"], [tr1, tr2, tr3])).toEqual([
      "parentSuite",
      "suite",
      "subSuite",
    ]);
  });
});

describe("byLabels", () => {
  it("should return labels that only exist in the given test results", () => {
    const tr1 = {
      labels: [
        { name: "parentSuite", value: "A" },
        { name: "suite", value: "B" },
        { name: "subSuite", value: "C" },
      ],
    } as TestResult;

    expect(byLabels(tr1, ["parentSuite", "suite", "subSuite"])).toEqual([["A"], ["B"], ["C"]]);
  });

  it("should return labels with keeping the given order", () => {
    const tr1 = {
      labels: [
        { name: "suite", value: "B" },
        { name: "subSuite", value: "C" },
        { name: "parentSuite", value: "A" },
      ],
    } as TestResult;

    expect(byLabels(tr1, ["parentSuite", "suite", "subSuite"])).toEqual([["A"], ["B"], ["C"]]);
  });

  it("should skip missing labels and keep deeper labels order", () => {
    const tr1 = {
      labels: [
        { name: "parentSuite", value: "A" },
        { name: "subSuite", value: "C" },
      ],
    } as TestResult;

    expect(byLabels(tr1, ["parentSuite", "suite", "subSuite"])).toEqual([["A"], ["C"]]);
  });
});
