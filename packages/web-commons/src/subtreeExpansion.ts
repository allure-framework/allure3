import type { Statistic } from "@allurereport/core-api";

import type { SubtreeNodeState, SubtreeToggleState } from "./treeSubtreeToggle.js";

export type ExpandableTreeNode = {
  nodeId: string;
  statistic?: Statistic;
  trees: ExpandableTreeNode[];
  leaves: unknown[];
};

const isFailedOrBrokenNode = (statistic?: Statistic) =>
  statistic === undefined || Boolean(statistic?.failed || statistic?.broken);

const getDefaultOpenedState = (statistic?: Statistic, root = false) => root || isFailedOrBrokenNode(statistic);

export const hasExpandableTreeChildren = (tree: ExpandableTreeNode) => tree.trees.length > 0 || tree.leaves.length > 0;

/** All group nodes in a subtree (root first), with default open state — matches report tree header toggle. */
export const collectExpandableSubtreeNodes = (tree: ExpandableTreeNode): SubtreeNodeState[] => {
  const nodes: SubtreeNodeState[] = [];
  const stack: { tree: ExpandableTreeNode; isRoot: boolean }[] = [{ tree, isRoot: true }];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    nodes.push({
      id: current.tree.nodeId,
      openedByDefault: getDefaultOpenedState(current.tree.statistic),
      isRoot: current.isRoot,
    });
    current.tree.trees.forEach((nestedSubtree) => stack.push({ tree: nestedSubtree, isRoot: false }));
  }

  return nodes;
};

export const applySubtreeToggleState = (
  expandableSubtreeNodes: SubtreeNodeState[],
  state: SubtreeToggleState,
  options: {
    toScopedId: (nodeId: string) => string;
    isOpened: (scopedId: string, openedByDefault: boolean) => boolean;
    setOpened: (scopedId: string, shouldOpen: boolean, openedByDefault: boolean) => void;
  },
): void => {
  expandableSubtreeNodes.forEach((node) => {
    const shouldOpenSubtree = state === "all" ? true : state === "first" ? node.isRoot : false;
    const scopedId = options.toScopedId(node.id);
    const currentlyOpened = options.isOpened(scopedId, node.openedByDefault);

    if (currentlyOpened !== shouldOpenSubtree) {
      options.setOpened(scopedId, shouldOpenSubtree, node.openedByDefault);
    }
  });
};
