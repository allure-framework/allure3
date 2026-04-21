export type SubtreeToggleState = "first" | "all" | "none";

export type SubtreeToggleIconState = "single-down" | "single-up" | "double-down" | "double-up";

export type SubtreeNodeState = {
  id: string;
  openedByDefault: boolean;
  isRoot: boolean;
};

export const isSubtreeFirstLevelOnlyOpened = (
  rootId: string,
  rootOpenedByDefault: boolean,
  subtreeNodes: SubtreeNodeState[],
  isNodeOpened: (id: string, openedByDefault: boolean) => boolean,
) => {
  if (!isNodeOpened(rootId, rootOpenedByDefault)) {
    return false;
  }

  return subtreeNodes.filter((node) => !node.isRoot).every((node) => !isNodeOpened(node.id, node.openedByDefault));
};

export const isSubtreeExpandedAll = (
  subtreeNodes: SubtreeNodeState[],
  isNodeOpened: (id: string, openedByDefault: boolean) => boolean,
) => subtreeNodes.every((node) => isNodeOpened(node.id, node.openedByDefault));

export const getNextSubtreeToggleState = (payload: {
  hasOnlyLeafResults: boolean;
  isSubtreeCollapsedAll: boolean;
  isSubtreeFirstLevelOnly: boolean;
  isSubtreeExpandedAll: boolean;
  lastSubtreeToggle: SubtreeToggleState | null;
}): SubtreeToggleState => {
  const {
    hasOnlyLeafResults,
    isSubtreeCollapsedAll,
    isSubtreeFirstLevelOnly,
    isSubtreeExpandedAll,
    lastSubtreeToggle,
  } = payload;

  if (hasOnlyLeafResults) {
    return isSubtreeCollapsedAll ? "all" : "none";
  }

  if (isSubtreeCollapsedAll) {
    return "first";
  }

  if (isSubtreeFirstLevelOnly) {
    return lastSubtreeToggle === "all" ? "none" : "all";
  }

  if (isSubtreeExpandedAll) {
    return "first";
  }

  return "all";
};

export const getSubtreeToggleIcon = (payload: {
  hasOnlyLeafResults: boolean;
  isSubtreeCollapsedAll: boolean;
  isSubtreeFirstLevelOnly: boolean;
}): SubtreeToggleIconState => {
  const { hasOnlyLeafResults, isSubtreeCollapsedAll, isSubtreeFirstLevelOnly } = payload;

  if (hasOnlyLeafResults) {
    return isSubtreeCollapsedAll ? "single-down" : "single-up";
  }

  if (isSubtreeCollapsedAll) {
    return "single-down";
  }

  if (isSubtreeFirstLevelOnly) {
    return "double-down";
  }

  return "double-up";
};
