import { formatDuration } from "@allurereport/core-api";
import { Text } from "@/components/Typography";
import { TreeItemRetries } from "../TreeItemRetries";
import styles from "./styles.scss";
import { TreeItemMetaIcon } from "../TreeItemMetaIcon";
export interface TreeItemInfoProps {
  duration?: number;
  retriesCount?: number;
  flaky?: boolean;
  new?: boolean;
}

export const TreeItemInfo = ({ duration, retriesCount, flaky: flakyTest, new: newTest }: TreeItemInfoProps) => {
  const formattedDuration = formatDuration(duration);

  return (
    <div className={styles["item-info"]}>
      {newTest && <TreeItemMetaIcon type="new" />}
      {flakyTest && <TreeItemMetaIcon type="flaky" />}
      <TreeItemRetries retriesCount={retriesCount} />
      <Text data-testid="tree-leaf-duration" type="ui" size={"m"} className={styles["item-info-time"]}>
        {formattedDuration}
      </Text>
    </div>
  );
};
