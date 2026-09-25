import type { Statistic } from "@allurereport/core-api";
import {
  applySubtreeToggleState,
  collectExpandableSubtreeNodes,
  getNextSubtreeToggleState,
  getSubtreeToggleIcon,
  hasExpandableTreeChildren,
  isSubtreeExpandedAll,
  isSubtreeFirstLevelOnlyOpened,
  type SubtreeToggleState,
} from "@allurereport/web-commons";
import cx from "clsx";
import type { FunctionalComponent } from "preact";
import { useLayoutEffect, useState } from "preact/hooks";

import { Button, IconButton } from "@/components/Button";
import { allureIcons } from "@/components/SvgIcon";
import { TreeItem } from "@/components/Tree/TreeItem";

import type { RecursiveTree, Status } from "../../../global";
import { TreeHeader } from "./TreeHeader";

import styles from "./styles.scss";

interface TreeProps {
  statistic?: Statistic;
  reportStatistic?: Statistic;
  tree: RecursiveTree;
  name?: string;
  root?: boolean;
  statusFilter?: Status;
  collapsedTrees: Set<string>;
  toggleTree: (id: string, openedByDefault?: boolean) => void;
  navigateTo: (id: string) => void;
  routeId?: string;
  focusedId?: string;
  /** Prefix for keyboard-focus ids when the same nodeId appears in multiple trees (e.g. environments). */
  focusIdPrefix?: string;
  /** When set, must match keyboard navigation open state (e.g. awesome `isTreeOpened`). */
  isGroupOpened?: (scopedNodeId: string, openedByDefault: boolean) => boolean;
  showMoreLabel?: string;
}

const PAGE_SIZE = 30;

const subtreeContainsFocus = (
  tree: RecursiveTree,
  focusedId: string,
  toScopedId: (nodeId: string) => string,
): boolean => {
  if (toScopedId(tree.nodeId) === focusedId) {
    return true;
  }

  if (tree.leaves.some((leaf) => toScopedId(leaf.nodeId) === focusedId || leaf.nodeId === focusedId)) {
    return true;
  }

  return tree.trees.some((subTree) => subtreeContainsFocus(subTree, focusedId, toScopedId));
};

const isFailedOrBrokenNode = (statistic?: Statistic) =>
  statistic === undefined || Boolean(statistic?.failed || statistic?.broken);

const getDefaultOpenedState = (statistic?: Statistic, root = false) => root || isFailedOrBrokenNode(statistic);

const isNodeOpened = (nodeId: string, collapsedTrees: Set<string>, defaultOpened: boolean) =>
  collapsedTrees.has(nodeId) ? !defaultOpened : defaultOpened;

const hasTreeChildren = (tree: RecursiveTree) => hasExpandableTreeChildren(tree);

const hasTreeOnlyLeafResults = (tree: RecursiveTree) => hasTreeChildren(tree) && tree.trees.length === 0;
const subtreeToggleIconByState = {
  "single-down": allureIcons.lineArrowsChevronDown,
  "single-up": allureIcons.lineArrowsChevronUp,
  "double-down": allureIcons.lineArrowsChevronDownDouble,
  "double-up": allureIcons.lineArrowsChevronUpDouble,
} as const;

export const Tree: FunctionalComponent<TreeProps> = ({
  tree,
  statusFilter,
  root,
  name,
  statistic,
  reportStatistic,
  collapsedTrees,
  toggleTree,
  routeId,
  focusedId,
  focusIdPrefix,
  isGroupOpened,
  navigateTo,
  showMoreLabel = "Show more",
}) => {
  const rootNodeId = tree.nodeId as string;
  const toScopedId = (nodeId: string) => (focusIdPrefix ? `${focusIdPrefix}${nodeId}` : nodeId);
  const defaultOpened = getDefaultOpenedState(statistic, Boolean(root));
  const resolveIsOpened = (scopedId: string, openedByDefault: boolean) =>
    isGroupOpened ? isGroupOpened(scopedId, openedByDefault) : isNodeOpened(scopedId, collapsedTrees, openedByDefault);
  const isOpened = resolveIsOpened(toScopedId(rootNodeId), defaultOpened);
  const hasChildren = hasTreeChildren(tree);
  const hasOnlyLeafResults = hasTreeOnlyLeafResults(tree);
  const expandableSubtreeNodes = hasChildren ? collectExpandableSubtreeNodes(tree) : [];
  const [lastSubtreeToggle, setLastSubtreeToggle] = useState<SubtreeToggleState | null>(null);
  const isSubtreeCollapsedAll = !resolveIsOpened(toScopedId(rootNodeId), defaultOpened);
  const isSubtreeFirstLevelOnly = isSubtreeFirstLevelOnlyOpened(
    toScopedId(rootNodeId),
    defaultOpened,
    expandableSubtreeNodes,
    (id, openedByDefault) => resolveIsOpened(toScopedId(id), openedByDefault),
  );
  const isSubtreeFullyExpanded =
    hasChildren &&
    isSubtreeExpandedAll(expandableSubtreeNodes, (id, openedByDefault) =>
      resolveIsOpened(toScopedId(id), openedByDefault),
    );
  const subtreeToggleIcon =
    subtreeToggleIconByState[
      getSubtreeToggleIcon({
        hasOnlyLeafResults,
        isSubtreeCollapsedAll,
        isSubtreeFirstLevelOnly,
      })
    ];
  const canRenderHeader = Boolean(name);
  const hasRenderableChildren = tree.trees.length > 0 || tree.leaves.length > 0;
  const contentClassName = cx({
    [styles["tree-content"]]: true,
    [styles.root]: root,
  });

  const toggleTreeHeader = () => {
    toggleTree(toScopedId(rootNodeId), defaultOpened);
    setLastSubtreeToggle(null);
  };

  const setSubtreeState = (state: SubtreeToggleState) => {
    applySubtreeToggleState(expandableSubtreeNodes, state, {
      toScopedId,
      isOpened: (scopedId, openedByDefault) => resolveIsOpened(scopedId, openedByDefault),
      setOpened: (scopedId, shouldOpen, openedByDefault) => {
        const currentlyOpened = resolveIsOpened(scopedId, openedByDefault);

        if (currentlyOpened !== shouldOpen) {
          toggleTree(scopedId, openedByDefault);
        }
      },
    });
  };

  const totalChildren = tree.trees.length + tree.leaves.length;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const focusChildIndex = focusedId
    ? tree.trees.findIndex((subTree) => subtreeContainsFocus(subTree, focusedId, toScopedId))
    : -1;
  const focusedLeafIndex =
    focusChildIndex < 0 && focusedId
      ? tree.leaves.findIndex((leaf) => toScopedId(leaf.nodeId) === focusedId || leaf.nodeId === focusedId)
      : -1;
  const focusedIndex =
    focusChildIndex >= 0 ? focusChildIndex : focusedLeafIndex >= 0 ? tree.trees.length + focusedLeafIndex : -1;

  useLayoutEffect(() => {
    if (focusedIndex >= visibleCount) {
      setVisibleCount(focusedIndex + 1);
    }
  }, [focusedIndex, visibleCount]);

  const toggleSubtree = (event: MouseEvent) => {
    event.stopPropagation();
    const nextState = getNextSubtreeToggleState({
      hasOnlyLeafResults,
      isSubtreeCollapsedAll,
      isSubtreeFirstLevelOnly,
      isSubtreeExpandedAll: isSubtreeFullyExpanded,
      lastSubtreeToggle,
    });
    setSubtreeState(nextState);
    if (nextState !== "first") {
      setLastSubtreeToggle(nextState);
    }
  };

  if (!hasRenderableChildren) {
    return null;
  }

  const visibleTreeCount = Math.min(tree.trees.length, visibleCount);
  const visibleTrees = tree.trees.slice(0, visibleTreeCount);
  const visibleLeaves = tree.leaves.slice(0, Math.max(0, visibleCount - tree.trees.length));

  const renderedSubtrees = visibleTrees.map((subTree) => (
    <Tree
      key={subTree.nodeId}
      name={subTree.name}
      tree={subTree}
      statistic={subTree.statistic}
      reportStatistic={reportStatistic}
      statusFilter={statusFilter}
      collapsedTrees={collapsedTrees}
      toggleTree={toggleTree}
      routeId={routeId}
      focusedId={focusedId}
      focusIdPrefix={focusIdPrefix}
      isGroupOpened={isGroupOpened}
      navigateTo={navigateTo}
      showMoreLabel={showMoreLabel}
    />
  ));

  const renderedLeaves = visibleLeaves.map((leaf) => (
    <TreeItem
      data-testid="tree-leaf"
      key={leaf.nodeId}
      id={leaf.nodeId}
      name={leaf.name}
      status={leaf.status}
      groupOrder={leaf.groupOrder as number}
      duration={leaf.duration}
      retriesCount={leaf.retriesCount}
      resolution={leaf.resolution}
      transition={leaf.transition}
      transitionTooltip={leaf.transitionTooltip}
      tooltips={leaf.tooltips}
      flaky={leaf.flaky}
      marked={leaf.nodeId === routeId}
      focused={toScopedId(leaf.nodeId) === focusedId}
      focusNodeId={toScopedId(leaf.nodeId)}
      navigateTo={navigateTo}
    />
  ));

  const headerActions = hasChildren ? (
    <IconButton
      size="xs"
      style="ghost"
      icon={subtreeToggleIcon}
      onClick={toggleSubtree}
      className={styles["tree-subtree-toggle"]}
      data-testid="tree-subtree-toggle"
    />
  ) : undefined;

  const treeContent = isOpened ? (
    <div data-testid="tree-content" className={contentClassName}>
      {renderedSubtrees}
      {renderedLeaves}
      {visibleCount < totalChildren && (
        <div className={styles["tree-show-more"]} data-testid="tree-show-more">
          <Button
            type="button"
            style="outline"
            size="s"
            text={showMoreLabel}
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
          />
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className={styles.tree}>
      {canRenderHeader ? (
        <TreeHeader
          statusFilter={statusFilter}
          categoryTitle={name}
          isOpened={isOpened}
          toggleTree={toggleTreeHeader}
          statistic={statistic}
          reportStatistic={reportStatistic}
          actions={headerActions}
          focused={toScopedId(rootNodeId) === focusedId}
          nodeId={toScopedId(rootNodeId)}
        />
      ) : null}
      {treeContent}
    </div>
  );
};
