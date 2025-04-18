import { TreeItemRetries } from "../TreeItemRetries";
import { Text } from "@/components/Typography";
import styles from "./styles.scss";
import { formatDuration } from "@allurereport/core-api";

export interface TreeItemInfoProps {
  duration?: number;
  retriesCount?: number;
}

export const TreeItemInfo = ({ duration, retriesCount }: TreeItemInfoProps) => {
  const formattedDuration = formatDuration(duration);

  return (
    <div className={styles["item-info"]}>
      <TreeItemRetries retriesCount={retriesCount} />
      <Text data-testid="tree-leaf-duration" type="ui" size={"m"} className={styles["item-info-time"]}>
        {formattedDuration}
      </Text>
    </div>
  );
};
