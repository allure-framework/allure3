import { type TestStatus, formatDuration } from "@allurereport/core-api";
import type { FunctionComponent } from "preact";
import TreeItemIcon from "@/components/app/Tree/TreeItemIcon";
import { Text } from "@/components/commons/Typography";
import { navigateTo } from "@/index";
import * as styles from "./styles.scss";

interface TreeItemProps {
  name: string;
  status: TestStatus;
  duration?: number;
  id: string;
  groupOrder: number;
}

export const TreeItem: FunctionComponent<TreeItemProps> = ({ name, groupOrder, status, duration, id, ...rest }) => {
  const formattedDuration = formatDuration(duration);

  return (
    <div {...rest} className={styles["tree-item"]} onClick={() => navigateTo(id)}>
      <TreeItemIcon status={status} />
      <span data-testid="tree-leaf-order" class={styles.order}>#{groupOrder}</span>
      <Text data-testid="tree-leaf-title" className={styles["item-title"]}>
        {name}
      </Text>
      <Text data-testid="tree-leaf-duration" type="ui" size={"m"} className={styles["item-time"]}>
        {formattedDuration}
      </Text>
    </div>
  );
};

export default TreeItem;
