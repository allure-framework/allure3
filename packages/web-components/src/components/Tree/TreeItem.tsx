import type { TestStatus, TestStatusTransition } from "@allurereport/core-api";
import clsx from "clsx";
import type { FunctionComponent } from "preact";

import { TreeItemIcon } from "@/components/Tree/TreeItemIcon";
import { TreeItemInfo } from "@/components/Tree/TreeItemInfo";
import { Code, Text } from "@/components/Typography";

import styles from "./styles.scss";

interface TreeItemProps {
  name: string;
  status?: TestStatus;
  duration?: number;
  retriesCount?: number;
  flaky?: boolean;
  transition?: TestStatusTransition;
  transitionTooltip?: string;
  id: string;
  /** Unique id for keyboard focus highlighting; defaults to `id`. */
  focusNodeId?: string;
  groupOrder: number;
  marked?: boolean;
  focused?: boolean;
  navigateTo: (id: string) => void;
  tooltips?: Record<string, string>;
}

export const TreeItem: FunctionComponent<TreeItemProps> = ({
  name,
  groupOrder,
  status,
  duration,
  retriesCount,
  flaky,
  transition,
  transitionTooltip,
  id,
  focusNodeId,
  marked,
  focused,
  navigateTo,
  tooltips,
  ...rest
}) => {
  const treeNodeId = focusNodeId ?? id;

  return (
    <div
      {...rest}
      className={clsx(
        styles["tree-item"],
        marked ? styles["tree-item-marked"] : "",
        focused ? styles["tree-item-focused"] : "",
      )}
      onClick={() => navigateTo(id)}
      id={id}
      data-tree-node-id={treeNodeId}
      aria-current={focused ? "true" : undefined}
    >
      <TreeItemIcon status={status} />
      <Code data-testid="tree-leaf-order" size={"s"} className={styles.order}>
        {groupOrder}
      </Code>
      <Text data-testid="tree-leaf-title" className={styles["item-title"]}>
        {name}
      </Text>
      <TreeItemInfo
        data-testid="tree-leaf-info"
        duration={duration}
        flaky={flaky}
        retriesCount={retriesCount}
        transition={transition}
        transitionTooltip={transitionTooltip}
        tooltips={tooltips}
      />
    </div>
  );
};
