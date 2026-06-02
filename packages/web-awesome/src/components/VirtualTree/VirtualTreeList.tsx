import { scrollFocusIntoView, scrollTreePaneToTop } from "@allurereport/web-commons";
import { TreeItem } from "@allurereport/web-components";
import clsx from "clsx";
import { useLayoutEffect, useRef } from "preact/hooks";

import { getFlatTreeNode, setTreeFocusId, treeFocusId, treeScrollPaneToTopPending } from "@/stores/keyboard";
import { isSplitMode } from "@/stores/layout";
import { useI18n } from "@/stores/locale";
import { navigateToTestResult } from "@/stores/router";
import { currentTrId } from "@/stores/testResult";
import { treeStatus } from "@/stores/treeFilters/store";
import type { VirtualLeafRow } from "@/stores/virtualTree";
import { flatVirtualRows } from "@/stores/virtualTree";

import { EnvHeader } from "./EnvHeader";
import { GroupHeader } from "./GroupHeader";
import { useVirtualList } from "./useVirtualList";

import * as styles from "./styles.scss";

const INDENT_WIDTH = 24;
const OVERSCAN = 10;

const treeNavigateTo = (testResultId: string) => {
  const flatNode = flatVirtualRows.value.find(
    (row) => row.kind === "leaf" && (row.nodeId === testResultId || row.id === testResultId),
  );
  setTreeFocusId(flatNode?.id ?? testResultId);
  navigateToTestResult({ testResultId });
};

const useLeafTooltips = (row: VirtualLeafRow) => {
  const { t } = useI18n("transitions");
  return {
    transition: row.transition ? t(`description.${row.transition}`) : undefined,
    flaky: row.flaky ? t("description.flaky") : undefined,
    retries: row.retriesCount ? t("description.retries", { count: row.retriesCount }) : undefined,
  };
};

const LeafRow = ({ row, trId, focusedId }: { row: VirtualLeafRow; trId?: string; focusedId?: string }) => {
  const tooltips = useLeafTooltips(row);
  return (
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
      tooltips={tooltips}
      flaky={row.flaky}
      marked={row.nodeId === trId}
      focused={row.id === focusedId}
      navigateTo={treeNavigateTo}
    />
  );
};

export const VirtualTreeList = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const split = isSplitMode.value;
  const rows = flatVirtualRows.value;
  const trId = currentTrId.value;
  const focusedId = treeFocusId.value;
  const statusFilter = treeStatus.value;

  const { totalSize, virtualItems, measureElement, scrollToIndex } = useVirtualList(
    containerRef,
    rows.length,
    OVERSCAN,
    split,
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
      scrollFocusIntoView(node, { kind: getFlatTreeNode(focusedId)?.kind });
    } else {
      const idx = rows.findIndex((row) => row.id === focusedId);
      if (idx >= 0) scrollToIndex(idx, "auto");
    }
  }, [focusedId]);

  return (
    <div
      ref={containerRef}
      data-tree-scroll-container={split || undefined}
      className={clsx(split && styles["virtual-tree-container"])}
    >
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

            return (
              <div
                key={row.id}
                data-index={virtualItem.index}
                ref={(el) => measureElement(el as HTMLElement | null)}
                style={{ paddingLeft: row.depth * INDENT_WIDTH }}
              >
                {row.kind === "leaf" && <LeafRow row={row} trId={trId} focusedId={focusedId} />}
                {row.kind === "group" && (
                  <>
                    <GroupHeader row={row} focused={focused} statusFilter={statusFilter} />
                    {row.isExpanded && <span data-testid="tree-content" hidden />}
                  </>
                )}
                {row.kind === "env" && <EnvHeader row={row} focused={focused} statusFilter={statusFilter} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
