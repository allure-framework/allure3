import type { TestStatus } from "@allurereport/core-api";
import type { Meta, StoryObj } from "@storybook/preact-vite";
import { useState } from "preact/hooks";

import { Tree, TreeItem, TreeItemIcon, TreeStatusBar } from "@/components/Tree";

import type { RecursiveTree } from "../global";

const statuses: TestStatus[] = ["passed", "failed", "broken", "skipped", "unknown"];

const leaf = (id: string, status: TestStatus, duration = 1200) => ({
  id,
  nodeId: id,
  name: `Test ${id}`,
  status,
  duration,
  groupOrder: 0,
});

const suite = (nodeId: string, leaves: ReturnType<typeof leaf>[], trees: RecursiveTree[] = []): RecursiveTree => {
  const failed = leaves.filter((item) => item.status === "failed").length;
  const passed = leaves.filter((item) => item.status === "passed").length;
  const skipped = leaves.filter((item) => item.status === "skipped").length;
  const nested = trees.reduce((sum, tree) => sum + (tree.statistic?.total ?? 0), 0);

  return {
    nodeId,
    name: nodeId,
    statistic: { total: leaves.length + nested, failed, passed, skipped },
    leaves,
    trees,
  } as RecursiveTree;
};

const tree = suite(
  "Checkout",
  [leaf("pay-with-card", "passed"), leaf("pay-with-invalid-card", "failed")],
  [
    suite("Cart", [leaf("add-item", "passed"), leaf("remove-item", "passed"), leaf("apply-coupon", "skipped")]),
    suite("Delivery", [leaf("choose-courier", "failed"), leaf("choose-pickup", "passed")]),
  ],
);

const meta: Meta<typeof Tree> = {
  title: "Components/Tree",
  component: Tree,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [collapsedTrees, setCollapsedTrees] = useState<Set<string>>(new Set());
    const toggleTree = (id: string) => {
      const next = new Set(collapsedTrees);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      setCollapsedTrees(next);
    };

    return (
      <div style={{ width: "640px" }}>
        <Tree
          root
          name={tree.name}
          tree={tree}
          statistic={tree.statistic}
          reportStatistic={tree.statistic}
          collapsedTrees={collapsedTrees}
          toggleTree={toggleTree}
          navigateTo={() => {}}
        />
      </div>
    );
  },
};

export const Items: Story = {
  render: () => (
    <div style={{ width: "640px", display: "flex", flexDirection: "column" }}>
      <TreeItem id="passed" name="Passed test" status="passed" duration={1400} groupOrder={0} navigateTo={() => {}} />
      <TreeItem id="failed" name="Failed test" status="failed" duration={420} groupOrder={0} navigateTo={() => {}} />
      <TreeItem
        id="flaky"
        name="Flaky test with retries"
        status="passed"
        duration={5300}
        retriesCount={3}
        flaky
        groupOrder={0}
        navigateTo={() => {}}
      />
      <TreeItem
        id="regressed"
        name="Regressed test"
        status="failed"
        duration={800}
        transition="regressed"
        transitionTooltip="Regressed"
        groupOrder={0}
        navigateTo={() => {}}
      />
      <TreeItem id="focused" name="Focused test" status="broken" focused groupOrder={0} navigateTo={() => {}} />
    </div>
  ),
};

export const ItemIcons: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "12px" }}>
      {statuses.map((status) => (
        <TreeItemIcon key={status} status={status} />
      ))}
    </div>
  ),
};

export const StatusBar: Story = {
  render: () => (
    <div style={{ width: "200px" }}>
      <TreeStatusBar
        statistic={{ total: 40, passed: 25, failed: 10, skipped: 5 }}
        reportStatistic={{ total: 100, passed: 70, failed: 20, skipped: 10 }}
      />
    </div>
  ),
};
