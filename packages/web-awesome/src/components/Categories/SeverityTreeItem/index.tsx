import type { CategoryNode, CategoryNodeProps, Statistic } from "@allurereport/core-api";
import type { ComponentChildren } from "preact";
import type { FC } from "preact/compat";
import { GroupTreeItem } from "@/components/Categories/GroupTreeItem";
import { TrSeverity } from "@/components/TestResult/TrSeverity";
import * as styles from "./styles.scss";

type SeverityTreeItemProps = CategoryNodeProps & {
  node: CategoryNode;
  isOpened: boolean;
  onToggle: () => void;
  children: ComponentChildren;
  depth: number;
  subtreeToggle?: ComponentChildren;
  reportStatistic?: Statistic;
};

export const SeverityTreeItem: FC<SeverityTreeItemProps> = ({
  node,
  nodeId,
  store,
  isOpened,
  onToggle,
  children,
  depth,
  subtreeToggle,
  reportStatistic,
}) => {
  const severityValue = node.value === "<Empty>" ? "normal" : (node.value ?? "normal");
  return (
    <GroupTreeItem
      node={node}
      nodeId={nodeId}
      store={store}
      isOpened={isOpened}
      onToggle={onToggle}
      depth={depth}
      subtreeToggle={subtreeToggle}
      reportStatistic={reportStatistic}
      className={styles["tree-item-severity"]}
      title={
        <div className={styles["tree-item-severity-title"]}>
          <TrSeverity severity={severityValue} size="m" />
        </div>
      }
    >
      {children}
    </GroupTreeItem>
  );
};
