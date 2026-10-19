import { describe, expect, it } from "vite-plus/test";

import { createWidget, type TreeGroup, type TreeLeaf } from "../src/tree.js";

const leaf = (uid: string, parentUid: string, status: TreeLeaf["status"]): TreeLeaf => ({
  uid,
  parentUid,
  name: uid,
  status,
  time: {},
  flaky: false,
  newFailed: false,
  newBroken: false,
  newPassed: false,
  retriesCount: 0,
  retriesStatusChange: false,
  retry: false,
  tags: [],
  parameters: [],
});

const group = (name: string, statuses: TreeLeaf["status"][]): TreeGroup => ({
  uid: name,
  name,
  children: statuses.map((status, index) => leaf(`${name}-${index}`, name, status)),
});

const root = (children: TreeGroup[]): TreeGroup => ({ uid: "__ROOT__", name: "__ROOT__", children });

describe("createWidget", () => {
  it("orders groups with the same statistic by name regardless of their input order", () => {
    const groups = [group("b.Suite", ["failed"]), group("a.Suite", ["failed"]), group("c.Suite", ["passed"])];

    const forward = createWidget(root(groups));
    const reversed = createWidget(root([...groups].reverse()));

    expect(forward.items.map(({ name }) => name)).toEqual(["a.Suite", "b.Suite", "c.Suite"]);
    expect(reversed.items).toEqual(forward.items);
  });

  it("keeps ordering groups by statistic before name", () => {
    const widget = createWidget(root([group("a.Passed", ["passed"]), group("z.Failed", ["failed"])]));

    expect(widget.items.map(({ name }) => name)).toEqual(["z.Failed", "a.Passed"]);
  });
});
