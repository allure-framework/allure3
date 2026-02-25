import { type TestStatusTransition, formatDuration } from "@allurereport/core-api";
import type { FunctionComponent } from "preact";
import { SvgIcon, allureIcons } from "@/components/SvgIcon";
import { TooltipWrapper } from "@/components/Tooltip";
import { Text } from "@/components/Typography";
import { TreeItemRetries } from "../TreeItemRetries";
import styles from "./styles.scss";
import { transitionToIcon } from "./utils";

export interface TreeItemInfoProps {
  duration?: number;
  retriesCount?: number;
  flaky?: boolean;
  transition?: TestStatusTransition;
  transitionTooltip?: string;
  tooltips?: Record<string, string>;
}

export const TreeItemInfo: FunctionComponent<TreeItemInfoProps> = ({
  duration,
  retriesCount,
  flaky,
  transition,
  tooltips,
}) => {
  const formattedDuration = formatDuration(duration);

  return (
    <div className={styles["item-info"]}>
      {flaky && (
        <TooltipWrapper data-testid="tree-leaf-flaky-tooltip" tooltipText={tooltips?.flaky}>
          <SvgIcon data-testid="tree-leaf-flaky" id={allureIcons.lineIconBomb2} />
        </TooltipWrapper>
      )}
      {Boolean(retriesCount) && (
        <TooltipWrapper data-testid="tree-leaf-retries-tooltip" tooltipText={tooltips?.retries}>
          <TreeItemRetries retriesCount={retriesCount} />
        </TooltipWrapper>
      )}
      {transition && (
        <TooltipWrapper data-testid="tree-leaf-transition-tooltip" tooltipText={tooltips?.transition}>
          <SvgIcon
            data-testid={`tree-leaf-transition-${transition}`}
            id={transitionToIcon(transition)}
            className={styles["item-info-transition"]}
          />
        </TooltipWrapper>
      )}
      <Text data-testid="tree-leaf-duration" type="ui" size={"m"} className={styles["item-info-time"]}>
        {formattedDuration}
      </Text>
    </div>
  );
};
