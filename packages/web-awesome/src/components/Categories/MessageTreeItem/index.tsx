import type { CategoryNode, CategoryNodeProps, Statistic, TestStatus } from "@allurereport/core-api";
import { getWorstStatus } from "@allurereport/core-api";
import { ansiToHTML } from "@allurereport/web-commons";
import { ArrowButton, Code, Text, TreeStatusBar } from "@allurereport/web-components";
import clsx from "clsx";
import type { ComponentChildren, FC } from "preact/compat";
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

  return (
    <div className={clsx(styles["tree-content"], styles["tree-item-message"])} id={nodeId}>
      <div
        className={styles["tree-item-message-container"]}
        data-tree-header
      >
        <ArrowButton isOpened={isOpened}  className={styles["tree-item-message-arrow"]} />
        <div className={clsx(styles["tree-item-message-card"], status && styles[`message-status-${status}`])} style={stickyStyle}>
          <div className={styles["tree-item-message-header"]} onClick={onToggle}>
            <Code size="s">
              {/* eslint-disable-next-line react/no-danger */}
              <pre dangerouslySetInnerHTML={{ __html: sanitizedMessage }} />
            </Code>
            <div className={styles["tree-item-message-actions"]}>
              {subtreeToggle}
              <div className={styles["tree-item-message-stats"]}>
                <TreeStatusBar reportStatistic={reportStatistic} statusFilter={"total"} statistic={node.statistic} />
              </div>
            </div>
          </div>
        </div>
      </div>
      {isOpened && children}
    </div>
  );
};
