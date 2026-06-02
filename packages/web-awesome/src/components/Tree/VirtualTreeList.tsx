import {
  applySubtreeToggleState,
  collectExpandableSubtreeNodes,
  getNextSubtreeToggleState,
  getSubtreeToggleIcon,
  hasExpandableTreeChildren,
  isSubtreeExpandedAll,
  isSubtreeFirstLevelOnlyOpened,
  scrollFocusIntoView,
  scrollTreePaneToTop,
  type SubtreeToggleState,
} from "@allurereport/web-commons";
import { IconButton, TreeHeader, TreeItem, TreeStatusBar, allureIcons } from "@allurereport/web-components";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";

import { MetadataButton } from "@/components/MetadataButton";
import { reportStatsStore } from "@/stores";
import { collapsedEnvironments, environmentNameById } from "@/stores/env";
import { getFlatTreeNode, setTreeFocusId, treeFocusId, treeScrollPaneToTopPending } from "@/stores/keyboard";
import { navigateToTestResult } from "@/stores/router";
import { currentTrId } from "@/stores/testResult";
import { isTreeOpened, setTreeOpened, toggleTree } from "@/stores/tree";
import { treeStatus } from "@/stores/treeFilters/store";
import type { VirtualGroupRow, VirtualRow } from "@/stores/virtualTree";
import { flatVirtualRows } from "@/stores/virtualTree";

import * as styles from "./styles.scss";

const INDENT_WIDTH = 24;
const ESTIMATE_ROW_HEIGHT = 32;
const OVERSCAN = 10;

const subtreeToggleIconByState = {
  "single-down": allureIcons.lineArrowsChevronDown,
  "single-up": allureIcons.lineArrowsChevronUp,
  "double-down": allureIcons.lineArrowsChevronDownDouble,
  "double-up": allureIcons.lineArrowsChevronUpDouble,
} as const;

// ---------------------------------------------------------------------------
// Lightweight virtualizer — no external dependency
// ---------------------------------------------------------------------------

type VirtualItem = { index: number; start: number };

function useVirtualList(scrollElementRef: { current: HTMLElement | null }, count: number, overscan: number) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  // Per-item measured heights; accumulate without triggering re-renders.
  const measuredHeights = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    const el = scrollElementRef.current;
    if (!el) return;

    const onScroll = () => setScrollTop(el.scrollTop);
    const onResize = () => setContainerHeight(el.clientHeight);

    setContainerHeight(el.clientHeight);
    setScrollTop(el.scrollTop);

    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(onResize);
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
    // scrollElementRef is stable (useRef), so this runs once on mount.
  }, []);

  // Build cumulative offsets considering measured heights where available.
  const getOffset = (idx: number) => {
    let offset = 0;
    for (let i = 0; i < idx; i++) {
      offset += measuredHeights.current.get(i) ?? ESTIMATE_ROW_HEIGHT;
    }
    return offset;
  };

  const getTotalSize = () => {
    let total = 0;
    for (let i = 0; i < count; i++) {
      total += measuredHeights.current.get(i) ?? ESTIMATE_ROW_HEIGHT;
    }
    return total;
  };

  // Find first visible index using binary-search-like scan.
  let startIdx = 0;
  {
    let accumulated = 0;
    for (let i = 0; i < count; i++) {
      const h = measuredHeights.current.get(i) ?? ESTIMATE_ROW_HEIGHT;
      if (accumulated + h > scrollTop) {
        startIdx = Math.max(0, i - overscan);
        break;
      }
      accumulated += h;
      if (i === count - 1) startIdx = Math.max(0, count - overscan);
    }
  }

  let endIdx = count - 1;
  {
    let accumulated = 0;
    let pastStart = false;
    for (let i = 0; i < count; i++) {
      const h = measuredHeights.current.get(i) ?? ESTIMATE_ROW_HEIGHT;
      if (i >= startIdx) pastStart = true;
      if (pastStart) accumulated += h;
      if (pastStart && accumulated > containerHeight) {
        endIdx = Math.min(count - 1, i + overscan);
        break;
      }
    }
  }

  const virtualItems: VirtualItem[] = [];
  for (let i = startIdx; i <= endIdx; i++) {
    virtualItems.push({ index: i, start: getOffset(i) });
  }

  const measureElement = (el: HTMLElement | null) => {
    if (!el) return;
    const indexAttr = el.getAttribute("data-index");
    if (indexAttr === null) return;
    const idx = parseInt(indexAttr, 10);
    if (isNaN(idx)) return;
    const h = el.getBoundingClientRect().height;
    if (h > 0 && measuredHeights.current.get(idx) !== h) {
      measuredHeights.current.set(idx, h);
    }
  };

  const scrollToIndex = (index: number, align: "start" | "center" | "auto" = "auto") => {
    const el = scrollElementRef.current;
    if (!el) return;
    const itemStart = getOffset(index);
    const itemHeight = measuredHeights.current.get(index) ?? ESTIMATE_ROW_HEIGHT;
    if (align === "start") {
      el.scrollTop = itemStart;
    } else if (align === "center") {
      el.scrollTop = itemStart - el.clientHeight / 2 + itemHeight / 2;
    } else {
      // auto: minimal scroll to bring into view
      if (itemStart < el.scrollTop) {
        el.scrollTop = itemStart;
      } else if (itemStart + itemHeight > el.scrollTop + el.clientHeight) {
        el.scrollTop = itemStart + itemHeight - el.clientHeight;
      }
    }
  };

  return { totalSize: getTotalSize(), virtualItems, measureElement, scrollToIndex };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const treeNavigateTo = (testResultId: string) => {
  const flatNode = flatVirtualRows.value.find(
    (row) => row.kind === "leaf" && (row.nodeId === testResultId || row.id === testResultId),
  );
  setTreeFocusId(flatNode?.id ?? testResultId);
  navigateToTestResult({ testResultId });
};

type GroupHeaderProps = {
  row: VirtualGroupRow;
  focused: boolean;
  statusFilter: ReturnType<typeof treeStatus.peek>;
};

const GroupHeader = ({ row, focused, statusFilter }: GroupHeaderProps) => {
  const { id, nodeId, name, statistic, isExpanded, openedByDefault, tree, idPrefix } = row;
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

type EnvHeaderProps = {
  row: VirtualRow & { kind: "env" };
  focused: boolean;
  statusFilter: ReturnType<typeof treeStatus.peek>;
};

const EnvHeader = ({ row, focused, statusFilter }: EnvHeaderProps) => {
  const { id, nodeId, isExpanded, statistic } = row;
  const name = environmentNameById(nodeId);

  const handleToggle = () => {
    collapsedEnvironments.value = isExpanded
      ? collapsedEnvironments.value.concat(nodeId)
      : collapsedEnvironments.value.filter((e) => e !== nodeId);
  };

  return (
    <div
      className={`${styles["tree-env-button"]}${focused ? ` ${styles["tree-env-focused"]}` : ""}`}
      data-tree-node-id={id}
      id={id}
    >
      <MetadataButton
        isOpened={isExpanded}
        setIsOpen={handleToggle}
        title={name}
        titleTooltipText={name}
        truncateTitle
        counter={statistic?.total ?? 0}
        data-testid="tree-section-env-button"
      />
      <TreeStatusBar statistic={statistic} reportStatistic={reportStatsStore.value.data} statusFilter={statusFilter} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// VirtualTreeList
// ---------------------------------------------------------------------------

export const VirtualTreeList = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rows = flatVirtualRows.value;
  const trId = currentTrId.value;
  const focusedId = treeFocusId.value;
  const statusFilter = treeStatus.value;

  const { totalSize, virtualItems, measureElement, scrollToIndex } = useVirtualList(
    containerRef,
    rows.length,
    OVERSCAN,
  );

  useLayoutEffect(() => {
    if (!focusedId) return;

    const node = document.querySelector(`[data-tree-node-id="${focusedId}"]`);

    if (node instanceof HTMLElement) {
      if (treeScrollPaneToTopPending.value) {
        treeScrollPaneToTopPending.value = false;
        scrollTreePaneToTop(node);
        return;
      }
      const flatNode = getFlatTreeNode(focusedId);
      scrollFocusIntoView(node, { kind: flatNode?.kind });
    } else {
      const idx = rows.findIndex((row) => row.id === focusedId);
      if (idx >= 0) scrollToIndex(idx, "auto");
    }
  }, [focusedId]);

  return (
    <div ref={containerRef} data-tree-scroll-container className={styles["virtual-tree-container"]}>
      <div style={{ height: totalSize, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
          }}
        >
          {virtualItems.map((virtualItem) => {
            const row = rows[virtualItem.index]!;
            const focused = row.id === focusedId;
            const indent = row.depth * INDENT_WIDTH;

            return (
              <div
                key={row.id}
                data-index={virtualItem.index}
                ref={(el) => measureElement(el as HTMLElement | null)}
                style={{ paddingLeft: indent }}
              >
                {row.kind === "leaf" && (
                  <TreeItem
                    data-testid="tree-leaf"
                    id={row.nodeId}
                    focusNodeId={row.id}
                    name={row.name}
                    status={row.status}
                    groupOrder={row.groupOrder}
                    duration={row.duration}
                    retriesCount={row.retriesCount}
                    transition={row.transition}
                    transitionTooltip={row.transitionTooltip}
                    tooltips={row.tooltips}
                    flaky={row.flaky}
                    marked={row.nodeId === trId}
                    focused={focused}
                    navigateTo={treeNavigateTo}
                  />
                )}
                {row.kind === "group" && <GroupHeader row={row} focused={focused} statusFilter={statusFilter} />}
                {row.kind === "env" && <EnvHeader row={row} focused={focused} statusFilter={statusFilter} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
