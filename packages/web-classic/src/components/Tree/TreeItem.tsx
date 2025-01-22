import { type TestStatus, formatDuration } from "@allurereport/core-api";
import { Text } from "@allurereport/web-components";
import clsx from "clsx";
import type { FunctionComponent } from "preact";
import TreeItemIcon from "@/components/Tree/TreeItemIcon";
import { navigateTo } from "@/utils/navigate";
import * as styles from "./styles.scss";

interface TreeItemProps {
  name: string;
  status: TestStatus;
  duration?: number;
  uid: string;
  parentUid?: string;
  time: Allure2Time;
  groupOrder: number;
  marked?: boolean;
}

export const TreeItem: FunctionComponent<TreeItemProps> = ({
  name,
  groupOrder,
  status,
  duration,
  uid,
  parentUid,
  time,
  marked,
  ...rest
}) => {
  const formattedDuration = formatDuration(time?.duration);

  return (
    <div
      {...rest}
      className={clsx(styles["tree-item"], marked && styles["tree-item-selected"])}
      onClick={() => navigateTo(`#suites/${parentUid}/${uid}`)}
    >
      <TreeItemIcon status={status} />
      <span data-testid="tree-leaf-order" class={styles.order}>
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
