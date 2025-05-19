import { formatDuration, MeaningfulTestStatus } from "@allurereport/core-api";
import { Text } from "@/components/Typography";
import { TreeItemMetaIcon } from "../TreeItemMetaIcon";
import { TreeItemRetries } from "../TreeItemRetries";
import styles from "./styles.scss";

export interface TreeItemInfoProps {
  duration?: number;
  retriesCount?: number;
  flaky?: boolean;
  new?: boolean;
  newFrom?: MeaningfulTestStatus;
}

export const TreeItemInfo = ({ duration, retriesCount, flaky: flakyTest, new: newTest, newFrom }: TreeItemInfoProps) => {
  const formattedDuration = formatDuration(duration);

  return (
    <div className={styles["item-info"]}>
      {flakyTest && <TreeItemMetaIcon type="flaky" />}
      <TreeItemRetries retriesCount={retriesCount} />
      <Text data-testid="tree-leaf-duration" type="ui" size={"m"} className={styles["item-info-time"]}>
        {formattedDuration}
      </Text>
    </div>
  );
};
