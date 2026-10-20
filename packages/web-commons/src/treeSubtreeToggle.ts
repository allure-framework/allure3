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

export type SubtreeTogglePayload = {
  hasOnlyLeafResults: boolean;
  isSubtreeCollapsedAll: boolean;
  isSubtreeFirstLevelOnly: boolean;
  isSubtreeExpandedAll: boolean;
  lastSubtreeToggle: SubtreeToggleState | null;
};

export const getNextSubtreeToggleState = (payload: SubtreeTogglePayload): SubtreeToggleState => {
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

export type SubtreeToggleAction = "expand-first-level" | "collapse-to-first-level" | "expand-all" | "collapse-all";

/**
 * Describes what the next click on the subtree toggle does, so the button can say it before the click.
 * The toggle goes through the states: collapsed -> first level -> all levels -> first level -> collapsed -> ...
 */
export const getSubtreeToggleAction = (payload: SubtreeTogglePayload): SubtreeToggleAction => {
  const nextState = getNextSubtreeToggleState(payload);

  if (nextState === "all") {
    return "expand-all";
  }

  if (nextState === "none") {
    return "collapse-all";
  }

  return payload.isSubtreeCollapsedAll ? "expand-first-level" : "collapse-to-first-level";
};

export const resolveNextSubtreeToggleState = (
  subtreeNodes: SubtreeNodeState[],
  isNodeOpened: (id: string, openedByDefault: boolean) => boolean,
  lastSubtreeToggle: SubtreeToggleState | null,
): { nextState: SubtreeToggleState; nextLastToggle: SubtreeToggleState | null } => {
  const root = subtreeNodes.find((node) => node.isRoot);

  if (!root || subtreeNodes.length === 0) {
    return { nextState: "first", nextLastToggle: null };
  }

  const isSubtreeCollapsedAll = !isNodeOpened(root.id, root.openedByDefault);
  const isSubtreeFirstLevelOnly = isSubtreeFirstLevelOnlyOpened(
    root.id,
    root.openedByDefault,
    subtreeNodes,
    isNodeOpened,
  );
  const subtreeExpandedAll = isSubtreeExpandedAll(subtreeNodes, isNodeOpened);
  const hasOnlyLeafResults = subtreeNodes.every((node) => node.isRoot);

  const nextState = getNextSubtreeToggleState({
    hasOnlyLeafResults,
    isSubtreeCollapsedAll,
    isSubtreeFirstLevelOnly,
    isSubtreeExpandedAll: subtreeExpandedAll,
    lastSubtreeToggle,
  });

  return {
    nextState,
    nextLastToggle: nextState !== "first" ? nextState : lastSubtreeToggle,
  };
};

/**
 * The icon shows what the next click does: the chevrons point down when the click expands and up when it collapses,
 * the double chevrons are used when the click affects the levels below the first one
 */
export const getSubtreeToggleIcon = (payload: SubtreeTogglePayload): SubtreeToggleIconState => {
  switch (getSubtreeToggleAction(payload)) {
    case "expand-first-level":
      return "single-down";
    case "expand-all":
      return payload.hasOnlyLeafResults ? "single-down" : "double-down";
    case "collapse-to-first-level":
      return "double-up";
    case "collapse-all":
      return "single-up";
  }
};
