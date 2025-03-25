import type { CategoryNode, CategoryNodeProps, Statistic } from "@allurereport/core-api";
import { TreeHeader } from "@allurereport/web-components";
import clsx from "clsx";
import type { ComponentChildren, FC } from "preact/compat";
import { createCategoriesStickyStyle } from "@/components/Categories/sticky";
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
  const stickyStyle = createCategoriesStickyStyle(depth);
  const headerTitle = subtreeToggle ? (
    <span className={styles["tree-item-group-title"]}>
      <span className={styles["tree-item-group-title-content"]}>{title ?? node.name}</span>
      {subtreeToggle}
    </span>
  ) : (
    title ?? node.name
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
