import { type TestStatus, formatDuration } from "@allurereport/core-api";
import clsx from "clsx";
import type { FunctionComponent } from "preact";
import { TreeItemIcon } from "@/components/Tree/TreeItemIcon";
import { Code, Text } from "@/components/Typography";
import styles from "./styles.scss";

interface TreeItemProps {
  name: string;
  status: TestStatus;
  duration?: number;
  id: string;
  groupOrder: number;
  marked?: boolean;
  navigateTo: (id: string) => void;
}

export const TreeItem: FunctionComponent<TreeItemProps> = ({
  name,
  groupOrder,
  status,
  duration,
  id,
  marked,
  navigateTo,
  ...rest
}) => {
  const formattedDuration = formatDuration(duration);

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
      <Text data-testid="tree-leaf-duration" type="ui" size={"m"} className={styles["item-time"]}>
        {formattedDuration}
      </Text>
    </div>
  );
};
