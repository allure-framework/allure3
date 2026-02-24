import type { CategoryNode, CategoryNodeProps, Statistic } from "@allurereport/core-api";
import { IconButton, TooltipWrapper, TreeHeader, allureIcons } from "@allurereport/web-components";
import clsx from "clsx";
import type { ComponentChildren } from "preact";
import type { FC } from "preact/compat";
import { createCategoriesStickyStyle } from "@/components/Categories/sticky";
import { useI18n } from "@/stores/locale";
import { copyToClipboard } from "@/utils/copyToClipboard";
import * as styles from "./styles.scss";

type HistoryTreeItemProps = CategoryNodeProps & {
  node: CategoryNode;
  isOpened: boolean;
  onToggle: () => void;
  children: ComponentChildren;
  depth: number;
  subtreeToggle?: ComponentChildren;
  reportStatistic?: Statistic;
};

export const HistoryTreeItem: FC<HistoryTreeItemProps> = ({
  node,
  nodeId,
  isOpened,
  onToggle,
  children,
  depth,
  subtreeToggle,
  reportStatistic,
}) => {
  const { t } = useI18n("controls");
  const stickyStyle = createCategoriesStickyStyle(depth);
  const categoryTitle = (
    <div className={styles["tree-item-history-title"]}>
      <div className={styles["tree-item-history-main"]}>
        <span className={styles["tree-item-history-name"]}>{node.name}</span>
        {node.historyId && (
          <span className={styles["tree-item-history-copy"]}>
            <TooltipWrapper tooltipText={t("clipboard")} tooltipTextAfterClick={t("clipboardSuccess")}>
              <IconButton
                style={"ghost"}
                size={"s"}
                icon={allureIcons.lineGeneralCopy3}
                onClick={(event) => {
                  event.stopPropagation();
                  copyToClipboard(node.historyId ?? "");
                }}
              />
            </TooltipWrapper>
          </span>
        )}
      </div>
      {subtreeToggle}
    </div>
  );
  return (
    <div className={clsx(styles["tree-content"], styles["tree-item-history"])} id={nodeId}>
      <TreeHeader
        categoryTitle={categoryTitle}
        isOpened={isOpened}
        toggleTree={onToggle}
        data-tree-header
        style={stickyStyle}
        statistic={node.statistic}
        reportStatistic={reportStatistic}
        statusFilter={"total"}
      />
      {isOpened && children}
    </div>
  );
};
