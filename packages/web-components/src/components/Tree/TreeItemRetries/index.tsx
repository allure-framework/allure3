import { SvgIcon, allureIcons } from "@/components/SvgIcon";
import { Text } from "@/components/Typography";
import styles from "./styles.scss";

export interface TreeItemRetriesProps {
  retriesCount?: number;
}

export const TreeItemRetries = ({ retriesCount = 0 }: TreeItemRetriesProps) => {
  if (retriesCount > 0) {
    return (
      <div data-testid="tree-item-retries" className={styles["tree-item-retries"]}>
        <SvgIcon className={styles["tree-item-retries-icon"]} id={allureIcons.lineArrowsRefreshCcw1} />
        <Text type="ui" size={"m"}>
          {retriesCount}
        </Text>
      </div>
    );
  }

  return null;
};
