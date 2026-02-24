import type { CategoryNode, CategoryNodeProps, Statistic } from "@allurereport/core-api";
import { TreeHeader } from "@allurereport/web-components";
import type { ComponentChildren } from "preact";
import type { FC } from "preact/compat";
import { createCategoriesStickyStyle } from "@/components/Categories/sticky";
import * as styles from "./styles.scss";

type CategoryHeaderItemProps = CategoryNodeProps & {
  node: CategoryNode;
  isOpened: boolean;
  onToggle: () => void;
  children: ComponentChildren;
  depth: number;
  subtreeToggle?: ComponentChildren;
  reportStatistic?: Statistic;
};

export const CategoryHeaderItem: FC<CategoryHeaderItemProps> = ({
  node,
  nodeId,
  isOpened,
  onToggle,
  children,
  depth,
  subtreeToggle,
  reportStatistic,
}) => {
  const stickyStyle = createCategoriesStickyStyle(depth);
  const categoryTitle = (
    <div className={styles["tree-item-category-title"]}>
      <span className={styles["tree-item-category-name"]}>{node.name}</span>
      {subtreeToggle}
    </div>
  );
  return (
    <div className={styles["tree-item-category"]} id={nodeId}>
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
