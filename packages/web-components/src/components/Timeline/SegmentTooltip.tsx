import { formatDuration } from "@allurereport/core-api";
import type { FunctionalComponent } from "preact";
import { Text } from "../Typography";
import styles from "./styles.scss";
import type { FlatDataItem } from "./types";

export const SegmentTooltip: FunctionalComponent<{
  segment: FlatDataItem;
  offsetTime: number;
}> = (props) => {
  const { segment, offsetTime } = props;

  if (!segment.id) {
    return null;
  }

  const isGrouped = segment.labelGroup.length > 1;

  return (
    <div className={styles.tooltipContent}>
      {isGrouped ? (
        <div className={styles.labelGroup}>
          {segment.labelGroup.map((label, i) => (
            <Text type="ui" size="s" bold key={i}>
              {label}
            </Text>
          ))}
        </div>
      ) : (
        <Text type="ui" size="s" bold>
          {segment.label}
        </Text>
      )}

      <div>
        {formatDuration(segment.timeRange[0].getTime() - offsetTime)}&nbsp;&mdash;&nbsp;
        {formatDuration(segment.timeRange[1].getTime() - offsetTime)}
      </div>
    </div>
  );
};
