import type { Statistic } from "@allurereport/core-api";

import type { EnvTreeSection, FlatTreeNode, FlattenTreeInput, FlattenVisibleTreeOptions } from "./types.js";

const isFailedOrBrokenNode = (statistic?: Statistic) =>
  statistic === undefined || Boolean(statistic?.failed || statistic?.broken);

const getDefaultOpenedState = (statistic?: Statistic, root = false) => root || isFailedOrBrokenNode(statistic);

const isNodeOpened = (
  nodeId: string,
  collapsedTrees: ReadonlySet<string>,
  defaultOpened: boolean,
  idPrefix?: string,
) => {
  const collapseKey = toFocusId(nodeId, idPrefix);

  return collapsedTrees.has(collapseKey) ? !defaultOpened : defaultOpened;
};

const hasTreeChildren = (tree: FlattenTreeInput) => tree.trees.length > 0 || tree.leaves.length > 0;

const toFocusId = (nodeId: string, idPrefix?: string) => (idPrefix ? `${idPrefix}${nodeId}` : nodeId);

const resolveGroupOpened = (
  tree: FlattenTreeInput,
  collapsedTrees: ReadonlySet<string>,
  options: { root?: boolean; idPrefix?: string; isGroupOpened?: FlattenVisibleTreeOptions["isGroupOpened"] },
) => {
  const defaultOpened = getDefaultOpenedState(tree.statistic, Boolean(options.root));
  const scopedId = toFocusId(tree.nodeId, options.idPrefix);

  if (options.isGroupOpened) {
    return options.isGroupOpened(scopedId, defaultOpened);
  }

  return isNodeOpened(tree.nodeId, collapsedTrees, defaultOpened, options.idPrefix);
};

const flattenTreeNode = (
  tree: FlattenTreeInput,
  collapsedTrees: ReadonlySet<string>,
  depth: number,
  options: {
    root?: boolean;
    parentId?: string;
    idPrefix?: string;
    isGroupOpened?: FlattenVisibleTreeOptions["isGroupOpened"];
  },
): FlatTreeNode[] => {
  const result: FlatTreeNode[] = [];
  const { idPrefix } = options;
  const defaultOpened = getDefaultOpenedState(tree.statistic, Boolean(options.root));
  const isOpened = resolveGroupOpened(tree, collapsedTrees, options);
  const hasChildren = hasTreeChildren(tree);
  const showHeader = Boolean(tree.name) && hasChildren;
  const groupFocusId = toFocusId(tree.nodeId, idPrefix);

  if (showHeader) {
    result.push({
      kind: "group",
      id: groupFocusId,
      nodeId: tree.nodeId,
      depth,
      parentId: options.parentId,
      hasChildren: true,
      isExpanded: isOpened,
      openedByDefault: defaultOpened,
    });
  }

  if (!hasChildren) {
    return result;
  }

  const childDepth = showHeader ? depth + 1 : depth;
  const canShowChildren = showHeader ? isOpened : options.root ? isOpened : true;
  const parentFocusId = showHeader ? groupFocusId : options.parentId;

  if (canShowChildren) {
    for (const subTree of tree.trees) {
      result.push(
        ...flattenTreeNode(subTree, collapsedTrees, childDepth, {
          parentId: parentFocusId,
          idPrefix,
          isGroupOpened: options.isGroupOpened,
        }),
      );
    }

    for (const leaf of tree.leaves) {
      result.push({
        kind: "leaf",
        id: toFocusId(leaf.nodeId, idPrefix),
        testResultId: leaf.nodeId,
        depth: childDepth,
        parentId: parentFocusId,
      });
    }
  }

  return result;
};

const flattenEnvSection = (
  section: EnvTreeSection,
  collapsedTrees: ReadonlySet<string>,
  isGroupOpened?: FlattenVisibleTreeOptions["isGroupOpened"],
): FlatTreeNode[] => {
  const envFocusId = `env:${section.id}`;
  const result: FlatTreeNode[] = [
    {
      kind: "env",
      id: envFocusId,
      nodeId: section.id,
      depth: 0,
      hasChildren: true,
      isExpanded: section.opened,
    },
  ];

  if (section.opened) {
    result.push(
      ...flattenTreeNode(section.tree, collapsedTrees, 1, {
        root: true,
        parentId: envFocusId,
        idPrefix: `${section.id}:`,
        isGroupOpened,
      }),
    );
  }

  return result;
};

export const flattenVisibleTree = (options: FlattenVisibleTreeOptions): FlatTreeNode[] => {
  const { collapsedTrees, isGroupOpened, tree, rootStatistic, isRoot, envSections } = options;

  if (envSections?.length) {
    return envSections.flatMap((section) => {
      if ((section.statistic?.total ?? 0) === 0) {
        return [];
      }

      return flattenEnvSection(section, collapsedTrees, isGroupOpened);
    });
  }

  if (!tree) {
    return [];
  }

  return flattenTreeNode(tree, collapsedTrees, 0, {
    root: isRoot ?? true,
    parentId: undefined,
    isGroupOpened,
    ...(rootStatistic ? { root: isRoot ?? true } : {}),
  });
};
