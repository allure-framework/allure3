import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { attachment, step } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TreeList } from "@/components/Tree";
import { reportStatsStore, statsByEnvStore, waitForI18next } from "@/stores";
import { collapsedEnvironments, currentEnvironment, environmentsStore } from "@/stores/env";
import { collapsedTrees, expandedTrees, treeStore } from "@/stores/tree";

import type { ReportTree, ReportTreeLeaf } from "../../../types";

const makeLeaf = (id: string): ReportTreeLeaf =>
  ({
    nodeId: id,
    id,
    name: id,
    status: "failed",
    duration: 1,
    start: 0,
    groupOrder: 0,
    flaky: false,
    retriesCount: 0,
  }) as ReportTreeLeaf;

const makeTree = (envId: string, leafCount: number): ReportTree => {
  const leafIds = Array.from({ length: leafCount }, (_, index) => `${envId}-leaf-${index}`);

  return {
    root: { groups: [`${envId}-suite`], leaves: [] },
    leavesById: Object.fromEntries(leafIds.map((id) => [id, makeLeaf(id)])),
    groupsById: {
      [`${envId}-suite`]: {
        nodeId: `${envId}-suite`,
        name: `${envId} suite`,
        statistic: { total: leafCount, failed: leafCount },
        leaves: leafIds,
      },
    },
  } as unknown as ReportTree;
};

const setReport = (envs: Array<{ id: string; leafCount: number }>) => {
  environmentsStore.value = {
    loading: false,
    error: undefined,
    data: envs.map(({ id }) => ({ id, name: id })),
  };
  treeStore.value = {
    loading: false,
    error: undefined,
    data: Object.fromEntries(envs.map(({ id, leafCount }) => [id, makeTree(id, leafCount)])),
  };
  statsByEnvStore.value = {
    loading: false,
    error: undefined,
    data: Object.fromEntries(envs.map(({ id, leafCount }) => [id, { total: leafCount, failed: leafCount }])),
  };
  reportStatsStore.value = {
    loading: false,
    error: undefined,
    data: { total: 10, failed: 10 },
  };
};

beforeEach(async () => {
  collapsedTrees.value = new Set();
  expandedTrees.value = new Set();
  collapsedEnvironments.value = [];
  currentEnvironment.value = "";
  await waitForI18next;
});

afterEach(() => {
  cleanup();
});

const visibleLeafIds = () => screen.queryAllByTestId("tree-leaf").map((node) => node.id);

describe("TreeList environments", () => {
  it("paginates each environment on its own and drops a collapsed environment from the document", async () => {
    setReport([
      { id: "env-a", leafCount: 31 },
      { id: "env-b", leafCount: 1 },
    ]);

    render(<TreeList />);

    await step("both environments render their own first page", async () => {
      const visible = visibleLeafIds();

      await attachment("visible leaves", visible.join("\n"), "text/plain");

      const envA = visible.filter((id) => id.startsWith("env-a-"));

      expect(envA).toHaveLength(30);
      expect(visible).toContain("env-b-leaf-0");
      expect(screen.getAllByTestId("tree-show-more")).toHaveLength(1);
      expect(screen.getAllByTestId("tree-section-env-button")).toHaveLength(2);
    });

    await step("collapse the second environment", async () => {
      const sections = screen.getAllByTestId("tree-section-env-button");

      fireEvent.click(sections[1]!);
    });

    const visible = visibleLeafIds();

    await attachment("visible leaves after collapse", visible.join("\n"), "text/plain");

    expect(visible.some((id) => id.startsWith("env-b-"))).toBe(false);
    expect(visible.filter((id) => id.startsWith("env-a-"))).toHaveLength(30);
    expect(screen.getAllByTestId("tree-show-more")).toHaveLength(1);
    expect(screen.queryByTestId("tree-section-env-content")).toBeTruthy();
  });
});
