import { formatDuration } from "@allurereport/core-api";
import { Text } from "@/components/Typography";
import { TreeItemRetries } from "../TreeItemRetries";
import styles from "./styles.scss";

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
