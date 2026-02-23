import type { CategoryNode, CategoryNodeProps, Statistic, TestStatus } from "@allurereport/core-api";
import { getWorstStatus } from "@allurereport/core-api";
import { ansiToHTML } from "@allurereport/web-commons";
import { ArrowButton, Button, Code, TreeStatusBar } from "@allurereport/web-components";
import clsx from "clsx";
import type { ComponentChildren } from "preact";
import type { FC } from "preact/compat";
import { useState } from "preact/hooks";
import { createCategoriesStickyStyle } from "@/components/Categories/sticky";
import { useI18n } from "@/stores/locale";
import * as styles from "./styles.scss";

type MessageTreeItemProps = CategoryNodeProps & {
  node: CategoryNode;
  isOpened: boolean;
  onToggle: () => void;
  children: ComponentChildren;
  depth: number;
  subtreeToggle?: ComponentChildren;
  reportStatistic?: Statistic;
};

const statusFromStatistic = (stat?: Statistic): TestStatus | undefined => {
  if (!stat) {
    return;
  }
  const statuses: TestStatus[] = [];
  if (stat.failed) {
    statuses.push("failed");
  }
  if (stat.broken) {
    statuses.push("broken");
  }
  if (stat.passed) {
    statuses.push("passed");
  }
  if (stat.skipped) {
    statuses.push("skipped");
  }
  if (stat.unknown) {
    statuses.push("unknown");
  }
  return getWorstStatus(statuses);
};

export const MessageTreeItem: FC<MessageTreeItemProps> = ({
  node,
  nodeId,
  isOpened,
  onToggle,
  children,
  depth,
  subtreeToggle,
  reportStatistic,
}) => {
  const { t } = useI18n("ui");
  const status = statusFromStatistic(node.statistic);
  const sanitizedMessage = ansiToHTML(node.name ?? "", { fg: "var(--on-text-primary)", colors: {} });
  const stickyStyle = createCategoriesStickyStyle(depth);
  const hasLongMessage = (node.name ?? "").length > 80;
  const [isMessageExpanded, setIsMessageExpanded] = useState(false);

  return (
    <div className={clsx(styles["tree-content"], styles["tree-item-message"])} id={nodeId}>
      <div className={styles["tree-item-message-container"]} data-tree-header style={stickyStyle} onClick={onToggle}>
        <ArrowButton isOpened={isOpened} className={styles["tree-item-message-arrow"]} />
        <div
          className={clsx(
            styles["tree-item-message-card"],
            status && styles[`message-status-${status}`],
            isMessageExpanded && styles["tree-item-message-card-expanded"],
          )}
        >
          <Code
            size="s"
            className={clsx(
              styles["tree-item-message-header"],
              isMessageExpanded && styles["tree-item-message-header-expanded"],
            )}
          >
            {/* eslint-disable-next-line react/no-danger */}
            <pre dangerouslySetInnerHTML={{ __html: sanitizedMessage }} />
          </Code>
          <div className={styles["tree-item-message-actions"]}>
            {hasLongMessage && (
              <Button
                size="s"
                style="ghost"
                text={isMessageExpanded ? t("showLess") : t("showMore")}
                className={styles["tree-item-message-expand"]}
                onClick={(event) => {
                  event.stopPropagation();
                  setIsMessageExpanded((value) => !value);
                }}
              />
            )}
            {subtreeToggle}
            <div className={styles["tree-item-message-stats"]}>
              <TreeStatusBar reportStatistic={reportStatistic} statusFilter={"total"} statistic={node.statistic} />
            </div>
          </div>
        </div>
      </div>
      {isOpened && children}
    </div>
  );
};
