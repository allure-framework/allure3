import type { TestResult } from "@allurereport/core-api";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createTreeByLabels } from "../src/index.js";

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
    const treeByLabels = createTreeByLabels([tr1, tr2], []);

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
    const treeByLabels = createTreeByLabels([tr1, tr2, tr3], ["feature"]);

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
    const treeByLabels = createTreeByLabels([tr1, tr2, tr3], ["feature"]);

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
});