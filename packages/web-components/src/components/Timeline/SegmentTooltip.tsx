import { formatDuration } from "@allurereport/core-api";
import type { FunctionalComponent } from "preact";
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

  return (
    <div className={styles.tooltipContent}>
      <div>{segment.label}</div>
      <div>
        {formatDuration(segment.timeRange[0].getTime() - offsetTime)}&nbsp;&mdash;&nbsp;
        {formatDuration(segment.timeRange[1].getTime() - offsetTime)}
      </div>
    </div>
  );
};
