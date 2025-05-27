import { formatDuration, type TestStatusTransition } from "@allurereport/core-api";
import { Text } from "@/components/Typography";
import { TreeItemMetaIcon } from "../TreeItemMetaIcon";
import { TreeItemRetries } from "../TreeItemRetries";
import styles from "./styles.scss";
import { Tag } from "@/components/Tag";
import { transitionToTagSkin } from "./utils";
import { allureIcons, SvgIcon } from "@/components/SvgIcon";
import type { FunctionComponent } from "preact";

export interface TreeItemInfoProps {
  duration?: number;
  retriesCount?: number;
  flaky?: boolean;
  transition?: TestStatusTransition;
  transitionText?: string;
}

export const TreeItemInfo: FunctionComponent<TreeItemInfoProps> = ({ duration, retriesCount, flaky, transition, transitionText }) => {
  const formattedDuration = formatDuration(duration);

  return (
    <div className={styles["item-info"]}>
      {flaky && <SvgIcon data-testid="tree-leaf-flaky" id={allureIcons.lineIconBomb2} />}
      <TreeItemRetries retriesCount={retriesCount} />
      {transition && <Tag data-testid={`tree-leaf-transition-${transition}`} skin={transitionToTagSkin(transition)}>{transitionText}</Tag>}
      <Text data-testid="tree-leaf-duration" type="ui" size={"m"} className={styles["item-info-time"]}>
        {formattedDuration}
      </Text>
    </div>
  );
};
