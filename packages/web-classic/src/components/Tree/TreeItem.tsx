import { type TestStatus, formatDuration } from "@allurereport/core-api";
import { Text } from "@allurereport/web-components";
import clsx from "clsx";
import type { FunctionComponent } from "preact";
import TreeItemIcon from "@/components/Tree/TreeItemIcon";
import { navigateTo, route } from "@/stores/router";
import * as styles from "./styles.scss";

interface TreeItemProps {
  name: string;
  status: TestStatus;
  duration?: number;
  id: string;
  groupOrder: number;
  parentNodeId?: string;
  isMarked?: boolean;
}

export const TreeItem: FunctionComponent<TreeItemProps> = ({
  name,
  groupOrder,
  status,
  duration,
  id,
  parentNodeId,
  isMarked,
  ...rest
}) => {
  const { tabName } = route.value;
  const formattedDuration = formatDuration(duration);
  const navigateToTR = () => navigateTo(`#${tabName}/${parentNodeId || "root"}/${id}`);

  return (
    <div {...rest} className={clsx(styles["tree-item"], isMarked && styles["tree-item-marked"])} onClick={navigateToTR}>
      <TreeItemIcon status={status} />
      <span data-testid="tree-leaf-order" className={styles.order}>
        {groupOrder}
      </span>
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
