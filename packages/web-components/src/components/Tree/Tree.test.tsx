import type { RecursiveTree } from "@allurereport/web-components/global";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { attachment, step } from "allure-js-commons";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Tree } from "./Tree";

afterEach(() => {
  cleanup();
});

const leaf = (id: string) => ({
  id,
  nodeId: id,
  name: id,
  status: "failed" as const,
  groupOrder: 0,
});

const suite = (nodeId: string, leaves: ReturnType<typeof leaf>[], trees: RecursiveTree[] = []): RecursiveTree =>
  ({
    nodeId,
    name: nodeId,
    statistic: { total: leaves.length, failed: leaves.length },
    leaves,
    trees,
  }) as RecursiveTree;

const renderSuite = (tree: RecursiveTree, collapsedTrees = new Set<string>()) =>
  render(
    <Tree
      name={tree.name}
      tree={tree}
      statistic={tree.statistic}
      collapsedTrees={collapsedTrees}
      toggleTree={vi.fn()}
      navigateTo={vi.fn()}
      showMoreLabel="Show more"
      root
    />,
  );

describe("Tree", () => {
  it("renders one page of rows and keeps the rest out of the document", async () => {
    const leaves = Array.from({ length: 31 }, (_, index) => leaf(`leaf-${index}`));

    renderSuite(suite("suite", leaves));

    const visible = screen.getAllByTestId("tree-leaf").map((node) => node.id);

    await attachment("visible leaves", visible.join("\n"), "text/plain");

    expect(visible).toEqual(leaves.slice(0, 30).map((item) => item.nodeId));
    expect(screen.getByTestId("tree-show-more")).toBeTruthy();
    expect(document.getElementById("leaf-30")).toBeNull();
  });

  it("reveals the next page without mounting rows beyond it", async () => {
    const leaves = Array.from({ length: 61 }, (_, index) => leaf(`leaf-${index}`));

    renderSuite(suite("suite", leaves));

    await step("show the next page", async () => {
      fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    });

    const visible = screen.getAllByTestId("tree-leaf").map((node) => node.id);

    await attachment("visible leaves after show more", visible.join("\n"), "text/plain");

    expect(visible).toHaveLength(60);
    expect(document.getElementById("leaf-60")).toBeNull();
  });

  it("does not mount children of a collapsed group", () => {
    const tree = suite("parent", [], [suite("child", [leaf("hidden-leaf")])]);

    renderSuite(tree, new Set(["child"]));

    expect(screen.getByText("parent")).toBeTruthy();
    expect(screen.getByText("child")).toBeTruthy();
    expect(document.getElementById("hidden-leaf")).toBeNull();
    expect(screen.queryByTestId("tree-show-more")).toBeNull();
  });
});
