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
  groupOrder: number;
  marked?: boolean;
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
  marked,
  navigateTo,
  tooltips,
  ...rest
}) => {
  return (
    <div
      {...rest}
      className={clsx(styles["tree-item"], marked ? styles["tree-item-marked"] : "")}
      onClick={() => navigateTo(id)}
      id={id}
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
