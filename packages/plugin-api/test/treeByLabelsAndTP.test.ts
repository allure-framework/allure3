import type { TestResult } from "@allurereport/core-api";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createTreeByLabelsAndTitlePath } from "../src/index.js";

const itResult = (args: Partial<TestResult> & { titlePath?: string[] }): TestResult => ({
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
  titlePath: [],
  ...args,
});

const sampleLeafFactory = ({ id, name, status, duration, flaky, start, retries }: TestResult) => ({
  nodeId: id,
  name,
  status,
  duration,
  flaky,
  start,
  retry: !!retries?.length,
  retriesCount: retries?.length || 0,
  statistic: { total: 0 },
});

describe("createTreeByLabelsAndTitlePath", () => {
  it("returns empty tree for empty input", () => {
    const result = createTreeByLabelsAndTitlePath([], [], sampleLeafFactory, undefined, undefined);
    expect(result.root.groups).toHaveLength(0);
    expect(result.root.leaves).toHaveLength(0);
    expect(result.groupsById).toEqual({});
    expect(result.leavesById).toEqual({});
  });

  it("groups by labels only when tests have no titlePath", () => {
    const tr1 = itResult({
      name: "tr1",
      labels: [{ name: "epic", value: "User" }],
    });
    const tr2 = itResult({
      name: "tr2",
      labels: [{ name: "epic", value: "Admin" }],
    });

    const result = createTreeByLabelsAndTitlePath([tr1, tr2], ["epic"], sampleLeafFactory, undefined, undefined);

    expect(result.root.groups).toHaveLength(2);

    const groups = Object.values(result.groupsById);
    const names = groups.map((g) => g.name).sort();
    expect(names).toEqual(["Admin", "User"]);

    for (const groupId of result.root.groups ?? []) {
      const group = result.groupsById[groupId];
      expect(group.leaves).toHaveLength(1);
    }
  });

  it("appends titlePath levels after label groups", () => {
    const tr1 = itResult({
      name: "tr1",
      labels: [{ name: "epic", value: "User" }],
      titlePath: ["Auth", "valid login"],
    });
    const tr2 = itResult({
      name: "tr2",
      labels: [{ name: "epic", value: "User" }],
      titlePath: ["Cart", "add item"],
    });

    const result = createTreeByLabelsAndTitlePath([tr1, tr2], ["epic"], sampleLeafFactory, undefined, undefined);

    expect(result.root.groups).toHaveLength(1);
    const epicGroup = result.groupsById[result.root.groups![0]];
    expect(epicGroup.name).toBe("User");

    expect(epicGroup.groups).toHaveLength(2);
    const level1Groups = epicGroup.groups!.map((id) => result.groupsById[id].name).sort();
    expect(level1Groups).toEqual(["Auth", "Cart"]);
  });
});
