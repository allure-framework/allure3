import { useSignal } from "@preact/signals";
import type { Meta, StoryObj } from "@storybook/preact";
import { fn } from "@storybook/test";
import type { ComponentProps } from "preact";
import { Tree } from "@/components/Tree";
import { PaginatedTree } from "@/components/Tree/PaginatedTree";
// @ts-ignore this is fine
import tree1 from "./tree.example.json";

const useSimpleNodeCollapsed = () => {
  const collapsedNodes = useSignal(new Set<string>());
  return {
    collapsedNodes,
    isNodeCollapsed: (node: any) => collapsedNodes.value.has(node.id),
    onGroupClick: (node: any) => {
      const newSet = new Set(collapsedNodes.value);
      if (newSet.has(node.id)) {
        newSet.delete(node.id);
      } else {
        newSet.add(node.id);
      }

      collapsedNodes.value = newSet;
    },
  };
};

const meta: Meta<ComponentProps<typeof Tree>> = {
  title: "Components/Tree",
  component: Tree,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<ComponentProps<typeof Tree>>;

export const Default: Story = {
  args: {
    statistic: {
      total: 100,
      passed: 50,
      failed: 20,
      broken: 10,
      skipped: 10,
      unknown: 10,
    },
    collapsedTrees: new Set(),
    name: "Test",
    navigateTo: fn(),
    reportStatistic: {
      total: 10,
      passed: 5,
      failed: 2,
      broken: 1,
      skipped: 1,
      unknown: 1,
    },
    toggleTree: fn(),
    root: true,
    statusFilter: "total",
    routeId: "123",
    tree: tree1 as any,
  },
  render: (args) => {
    const { onGroupClick, isNodeCollapsed } = useSimpleNodeCollapsed();
    return (
      <PaginatedTree
        {...args}
        statistic={args.reportStatistic}
        isNodeCollapsed={isNodeCollapsed}
        onGroupClick={onGroupClick}
        onLeafClick={fn()}
      />
    );
  },
};
