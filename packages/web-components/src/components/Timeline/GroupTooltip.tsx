import { formatDuration } from "@allurereport/core-api";
import type { FunctionalComponent } from "preact";
import { useMemo } from "preact/hooks";
import styles from "./styles.scss";
import type { FlatDataItem } from "./types";

export const GroupTooltip: FunctionalComponent<{
  segments: FlatDataItem[];
  groupId: string;
  groupName: string;
  offsetTime: number;
}> = (props) => {
  const { segments, groupId, groupName, offsetTime } = props;

  const [start, stop] = useMemo(() => {
    let groupStart = Infinity;
    let groupStop = -Infinity;
    const groupSegments = segments.filter((d) => d.groupId === groupId);

    for (const segment of groupSegments) {
      groupStart = Math.min(groupStart, segment.timeRange[0].getTime());
      groupStop = Math.max(groupStop, segment.timeRange[1].getTime());
    }

    return [groupStart, groupStop] as const;
  }, [segments, groupId]);

  return (
    <div className={styles.tooltipContent}>
      <div>{groupName}</div>
      <div>
        {formatDuration(start - offsetTime)}&nbsp;&mdash;&nbsp;{formatDuration(stop - offsetTime)}
      </div>
    </div>
  );
};
