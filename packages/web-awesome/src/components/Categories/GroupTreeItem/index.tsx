import type { CategoryNode, CategoryNodeProps, Statistic } from "@allurereport/core-api";
import { TreeHeader } from "@allurereport/web-components";
import clsx from "clsx";
import type { ComponentChildren, FC } from "preact/compat";
import { createCategoriesStickyStyle } from "@/components/Categories/sticky";
import { useI18n } from "@/stores";
import * as styles from "./styles.scss";

type GroupTreeItemProps = CategoryNodeProps & {
  node: CategoryNode;
  isOpened: boolean;
  onToggle: () => void;
  children: ComponentChildren;
  depth: number;
  reportStatistic?: Statistic;
  className?: string;
  title?: ComponentChildren;
  subtreeToggle?: ComponentChildren;
};

export const GroupTreeItem: FC<GroupTreeItemProps> = ({
  node,
  nodeId,
  isOpened,
  onToggle,
  children,
  depth,
  reportStatistic,
  className,
  title,
  subtreeToggle,
}) => {
  const { t: tEmpty } = useI18n("empty");
  const { t: tFilters } = useI18n("filters");
  const { t: tEnvironments } = useI18n("environments");
  const stickyStyle = createCategoriesStickyStyle(depth);
  const emptyKeyByGroup: Partial<Record<string, string>> = {
    transition: "no-transition",
    layer: "no-layer",
    owner: "no-owner",
    severity: "no-severity",
    status: "no-status",
    environment: "no-environment",
    flaky: "no-flaky",
  };
  const defaultTitle =
    node.name === "<Empty>" ? tEmpty(node.key ? (emptyKeyByGroup[node.key] ?? "no-value") : "no-value") : node.name;
  const headerTitle = subtreeToggle ? (
    <span className={styles["tree-item-group-title"]}>
      <span className={styles["tree-item-group-title-content"]}>{title ?? defaultTitle}</span>
      {subtreeToggle}
    </span>
  ) : (
    (title ?? defaultTitle)
  );

  return (
    <div
      className={clsx(styles["tree-content"], styles["tree-item-group"], className)}
      id={nodeId}
      data-group-key={node.key}
    >
      <TreeHeader
        isOpened={isOpened}
        categoryTitle={headerTitle}
        toggleTree={onToggle}
        data-tree-header
        style={stickyStyle}
        reportStatistic={reportStatistic}
        statistic={node.statistic}
        statusFilter={"total"}
      />
      {isOpened && children}
    </div>
  );
};
