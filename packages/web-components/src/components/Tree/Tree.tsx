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
import { useState } from "preact/hooks";

import { IconButton } from "@/components/Button";
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
}

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

  const renderedSubtrees = tree.trees.map((subTree) => (
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
    />
  ));

  const renderedLeaves = tree.leaves.map((leaf) => (
    <TreeItem
      data-testid="tree-leaf"
      key={leaf.nodeId}
      id={leaf.nodeId}
      name={leaf.name}
      status={leaf.status}
      groupOrder={leaf.groupOrder as number}
      duration={leaf.duration}
      retriesCount={leaf.retriesCount}
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
