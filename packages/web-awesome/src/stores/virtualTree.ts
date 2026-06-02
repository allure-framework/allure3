import type { Statistic, TestStatus, TestStatusTransition } from "@allurereport/core-api";
import { computed } from "@preact/signals";
import type { AwesomeRecursiveTree, AwesomeTreeLeaf } from "types";

import { reportStatsStore, statsByEnvStore } from "@/stores";
import { collapsedEnvironments, currentEnvironment, environmentNameById, environmentsStore } from "@/stores/env";
import { filteredTree, isTreeOpened, noTests, noTestsFound } from "@/stores/tree";

export type VirtualLeafRow = {
  kind: "leaf";
  id: string;
  depth: number;
  nodeId: string;
  name: string;
  status?: TestStatus;
  duration?: number;
  groupOrder: number;
  retriesCount?: number;
  flaky?: boolean;
  transition?: TestStatusTransition;
  transitionTooltip?: string;
  tooltips?: Record<string, string>;
};

export type VirtualGroupRow = {
  kind: "group";
  id: string;
  depth: number;
  isExpanded: boolean;
  openedByDefault: boolean;
  nodeId: string;
  name: string;
  statistic?: Statistic;
  /** The recursive subtree — kept for subtree-toggle logic. */
  tree: AwesomeRecursiveTree;
  idPrefix?: string;
};

export type VirtualEnvRow = {
  kind: "env";
  id: string;
  depth: number;
  isExpanded: boolean;
  nodeId: string;
  name: string;
  statistic?: Statistic;
};

export type VirtualRow = VirtualLeafRow | VirtualGroupRow | VirtualEnvRow;

const isFailedOrBrokenNode = (statistic?: Statistic) =>
  statistic === undefined || Boolean(statistic?.failed || statistic?.broken);

const getDefaultOpenedState = (statistic?: Statistic, root = false) => root || isFailedOrBrokenNode(statistic);

function flattenTreeWithData(
  tree: AwesomeRecursiveTree,
  depth: number,
  options: {
    isRoot?: boolean;
    idPrefix?: string;
  },
): VirtualRow[] {
  const rows: VirtualRow[] = [];
  const { idPrefix } = options;
  const toScopedId = (nodeId: string) => (idPrefix ? `${idPrefix}${nodeId}` : nodeId);

  const hasChildren = tree.trees.length > 0 || tree.leaves.length > 0;
  const showHeader = Boolean(tree.name) && hasChildren;
  const defaultOpened = getDefaultOpenedState(tree.statistic, Boolean(options.isRoot));
  const groupFocusId = toScopedId(tree.nodeId);
  const isExpanded = isTreeOpened(groupFocusId, defaultOpened);

  if (showHeader) {
    rows.push({
      kind: "group",
      id: groupFocusId,
      depth,
      isExpanded,
      openedByDefault: defaultOpened,
      nodeId: tree.nodeId,
      name: tree.name,
      statistic: tree.statistic,
      tree,
      idPrefix,
    });
  }

  if (!hasChildren) {
    return rows;
  }

  const childDepth = showHeader ? depth + 1 : depth;
  const canShowChildren = showHeader ? isExpanded : options.isRoot ? isExpanded : true;

  if (canShowChildren) {
    for (const subTree of tree.trees) {
      rows.push(...flattenTreeWithData(subTree, childDepth, { idPrefix }));
    }

    for (const leaf of tree.leaves as AwesomeTreeLeaf[]) {
      rows.push({
        kind: "leaf",
        id: toScopedId(leaf.nodeId),
        depth: childDepth,
        nodeId: leaf.nodeId,
        name: leaf.name,
        status: leaf.status,
        duration: leaf.duration,
        groupOrder: leaf.groupOrder,
        retriesCount: leaf.retriesCount,
        flaky: leaf.flaky,
        transition: leaf.transition,
        transitionTooltip: leaf.transitionTooltip,
        tooltips: leaf.tooltips,
      });
    }
  }

  return rows;
}

export const flatVirtualRows = computed((): VirtualRow[] => {
  if (noTests.value || noTestsFound.value) {
    return [];
  }

  const envs = environmentsStore.value.data;
  const trees = filteredTree.value as Record<string, AwesomeRecursiveTree>;

  if (envs.length === 1) {
    const soleId = envs[0]!.id;
    const tree = trees[soleId];

    if (!tree) {
      return [];
    }

    return flattenTreeWithData(tree, 0, { isRoot: true });
  }

  const currentTree = currentEnvironment.value
    ? (trees[currentEnvironment.value] as AwesomeRecursiveTree | undefined)
    : undefined;

  if (currentTree) {
    return flattenTreeWithData(currentTree, 0, { isRoot: true });
  }

  const rows: VirtualRow[] = [];

  for (const [envId, tree] of Object.entries(trees)) {
    const stats = statsByEnvStore.value.data[envId];

    if ((stats?.total ?? 0) === 0) {
      continue;
    }

    const isOpened = !collapsedEnvironments.value.includes(envId);
    const envFocusId = `env:${envId}`;

    rows.push({
      kind: "env",
      id: envFocusId,
      depth: 0,
      isExpanded: isOpened,
      nodeId: envId,
      name: environmentNameById(envId),
      statistic: stats,
    });

    if (isOpened) {
      rows.push(
        ...flattenTreeWithData(tree, 1, {
          isRoot: true,
          idPrefix: `${envId}:`,
        }),
      );
    }
  }

  // read reportStatsStore to invalidate when report stats change
  void reportStatsStore.value;

  return rows;
});
