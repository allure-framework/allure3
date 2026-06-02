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
import { IconButton, TreeHeader, allureIcons } from "@allurereport/web-components";
import { useState } from "preact/hooks";

import { reportStatsStore } from "@/stores";
import { isTreeOpened, setTreeOpened, toggleTree } from "@/stores/tree";
import { treeStatus } from "@/stores/treeFilters/store";
import type { VirtualGroupRow } from "@/stores/virtualTree";

const subtreeToggleIconByState = {
  "single-down": allureIcons.lineArrowsChevronDown,
  "single-up": allureIcons.lineArrowsChevronUp,
  "double-down": allureIcons.lineArrowsChevronDownDouble,
  "double-up": allureIcons.lineArrowsChevronUpDouble,
} as const;

type Props = {
  row: VirtualGroupRow;
  focused: boolean;
  statusFilter: ReturnType<typeof treeStatus.peek>;
};

export const GroupHeader = ({ row, focused, statusFilter }: Props) => {
  const { id, name, statistic, isExpanded, openedByDefault, tree, idPrefix } = row;
  const toScopedId = (nid: string) => (idPrefix ? `${idPrefix}${nid}` : nid);
  const hasChildren = hasExpandableTreeChildren(tree);
  const hasOnlyLeafResults = hasChildren && tree.trees.length === 0;
  const expandableSubtreeNodes = hasChildren ? collectExpandableSubtreeNodes(tree) : [];

  const resolveIsOpened = (scopedId: string, obd: boolean) => isTreeOpened(scopedId, obd);

  const isSubtreeCollapsedAll = !resolveIsOpened(id, openedByDefault);
  const isSubtreeFirstLevelOnly = isSubtreeFirstLevelOnlyOpened(
    id,
    openedByDefault,
    expandableSubtreeNodes,
    (sid, obd) => resolveIsOpened(toScopedId(sid), obd),
  );
  const isSubtreeFullyExpanded =
    hasChildren && isSubtreeExpandedAll(expandableSubtreeNodes, (sid, obd) => resolveIsOpened(toScopedId(sid), obd));

  const [lastSubtreeToggle, setLastSubtreeToggle] = useState<SubtreeToggleState | null>(null);

  const subtreeToggleIcon =
    subtreeToggleIconByState[
      getSubtreeToggleIcon({ hasOnlyLeafResults, isSubtreeCollapsedAll, isSubtreeFirstLevelOnly })
    ];

  const handleToggleHeader = () => {
    toggleTree(id, openedByDefault);
    setLastSubtreeToggle(null);
  };

  const handleToggleSubtree = (e: MouseEvent) => {
    e.stopPropagation();
    const nextState = getNextSubtreeToggleState({
      hasOnlyLeafResults,
      isSubtreeCollapsedAll,
      isSubtreeFirstLevelOnly,
      isSubtreeExpandedAll: isSubtreeFullyExpanded,
      lastSubtreeToggle,
    });
    applySubtreeToggleState(expandableSubtreeNodes, nextState, {
      toScopedId,
      isOpened: (scopedId, obd) => resolveIsOpened(scopedId, obd),
      setOpened: (scopedId, shouldOpen, obd) => {
        if (resolveIsOpened(scopedId, obd) !== shouldOpen) {
          setTreeOpened(scopedId, shouldOpen, obd);
        }
      },
    });
    if (nextState !== "first") setLastSubtreeToggle(nextState);
  };

  const headerActions = hasChildren ? (
    <IconButton
      size="xs"
      style="ghost"
      icon={subtreeToggleIcon}
      onClick={handleToggleSubtree}
      data-testid="tree-subtree-toggle"
    />
  ) : undefined;

  return (
    <TreeHeader
      categoryTitle={name}
      isOpened={isExpanded}
      toggleTree={handleToggleHeader}
      statistic={statistic}
      reportStatistic={reportStatsStore.value.data}
      statusFilter={statusFilter}
      actions={headerActions}
      focused={focused}
      nodeId={id}
    />
  );
};
