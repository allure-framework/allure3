import type { CategoryNode, CategoryNodeProps, Statistic } from "@allurereport/core-api";
import { Text } from "@allurereport/web-components";
import type { ComponentChildren } from "preact";
import type { FC } from "preact/compat";
import { GroupTreeItem } from "@/components/Categories/GroupTreeItem";
import * as styles from "./styles.scss";

type LabelTreeItemProps = CategoryNodeProps & {
  node: CategoryNode;
  isOpened: boolean;
  onToggle: () => void;
  children: ComponentChildren;
  depth: number;
  subtreeToggle?: ComponentChildren;
  reportStatistic?: Statistic;
};

export const LabelTreeItem: FC<LabelTreeItemProps> = ({
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
  const value = node.value === "<Empty>" ? `No ${node.key ?? "label"}` : (node.value ?? "");
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
      className={styles["tree-item-label"]}
      title={
        <div className={styles["tree-item-label-row"]}>
          <Text type={"ui"} size="m" className={styles["tree-item-label-key"]}>
            {node.key}
          </Text>
          <div className={styles["tree-item-label-values"]}>
            <div className={styles["tree-item-label-bubble"]}>
              <Text size="m" bold className={styles["tree-item-label-value-text"]}>
                {value}
              </Text>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </GroupTreeItem>
  );
};
