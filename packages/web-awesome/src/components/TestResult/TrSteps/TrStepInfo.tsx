import {
  type DefaultTestStepResult,
  type TestStatus,
  type TestStepResult,
  formatDuration,
} from "@allurereport/core-api";
import { SvgIcon, Text, Tooltip, TooltipWrapper, allureIcons } from "@allurereport/web-components/core";
import clsx from "clsx";
import type { FunctionalComponent } from "preact";

import { formatTimeRange } from "@/utils/time";

import * as styles from "@/components/TestResult/TrSteps/styles.scss";

const countErrorStatuses = (step: TestStepResult): Record<string, number> | undefined => {
  if (step.type !== "step") {
    return;
  }
  const result: Record<string, number> = {};

  const collectFromSteps = (currentStep: TestStepResult) => {
    if (currentStep.type !== "step") {
      return;
    }
    if (currentStep.status !== "passed") {
      result[currentStep.status] = (result[currentStep.status] || 0) + 1;
    }
    currentStep.steps?.forEach(collectFromSteps);
  };
  step?.steps?.forEach(collectFromSteps);

  return result;
};

/**
 * Counts all nested steps under `step` (not including `step` itself), recursively.
 * Matches Allure 2 `stepsCount` and keeps parity with recursive failed-substep badges.
 */
export const countDescendantSteps = (step: TestStepResult): number => {
  if (step.type !== "step") {
    return 0;
  }

  return (step.steps ?? []).reduce((count, child) => {
    if (child.type !== "step") {
      return count;
    }

    return count + 1 + countDescendantSteps(child);
  }, 0);
};

/**
 * Counts all nested attachments under `step`, recursively (Allure 2 `attachmentsCount` parity).
 */
export const countDescendantAttachments = (step: TestStepResult): number => {
  if (step.type !== "step") {
    return 0;
  }

  return (step.steps ?? []).reduce((count, child) => {
    if (child.type === "attachment") {
      return count + 1;
    }

    return count + countDescendantAttachments(child);
  }, 0);
};

const {
  lineGeneralCheckCircle,
  lineGeneralHelpCircle,
  lineGeneralMinusCircle,
  lineGeneralXCircle,
  lineGeneralInfoCircle,
} = allureIcons;

const icons = {
  failed: lineGeneralXCircle,
  broken: lineGeneralInfoCircle,
  passed: lineGeneralCheckCircle,
  skipped: lineGeneralMinusCircle,
  unknown: lineGeneralHelpCircle,
};

/**
 * Rendered by the tooltip only while it is visible, so timestamps are formatted on hover rather than for every step.
 */
const TrStepTimeTooltip: FunctionalComponent<{ start?: number; stop?: number }> = ({ start, stop }) => (
  <Tooltip data-testid="test-result-step-time-tooltip">{formatTimeRange(start, stop)}</Tooltip>
);

export const TrStepInfo = (props: { item: DefaultTestStepResult }) => {
  const { item } = props;
  const formattedDuration = formatDuration(item?.duration as number);
  const hasTimeRange = typeof item?.start === "number" || typeof item?.stop === "number";
  const stepLength = countDescendantSteps(item);
  const attachmentLength = countDescendantAttachments(item);

  const failedStepsInTree = countErrorStatuses(item) || {};

  const FailedSteps = () => (
    <div className={styles["failed-steps"]}>
      {Object.entries(failedStepsInTree).map(([status, count], index) => (
        <div className={styles["item-status"]} key={index}>
          <SvgIcon
            size="s"
            id={icons[status as TestStatus]}
            className={clsx(styles["item-status-icon"], styles[`status-${status}`])}
          />
          {count && <Text size={"s"}>{count}</Text>}
        </div>
      ))}
    </div>
  );

  return (
    <div className={styles["item-info"]}>
      <FailedSteps />
      {!!stepLength && (
        <div className={styles["item-info-step"]}>
          <SvgIcon id={allureIcons.lineArrowsCornerDownRight} className={styles["item-info-step-icon"]} />
          <Text size={"s"}>{stepLength}</Text>
        </div>
      )}
      {!!attachmentLength && (
        <div className={styles["item-info-step"]}>
          <SvgIcon id={allureIcons.lineFilesFileAttachment2} className={styles["item-info-step-icon"]} />
          <Text size={"s"}>{attachmentLength}</Text>
        </div>
      )}
      {hasTimeRange ? (
        <TooltipWrapper
          className={styles["item-time-wrapper"]}
          tooltipComponent={<TrStepTimeTooltip start={item.start} stop={item.stop} />}
        >
          <Text type="ui" size={"s"} className={styles["item-time"]}>
            {formattedDuration}
          </Text>
        </TooltipWrapper>
      ) : (
        <Text type="ui" size={"s"} className={styles["item-time"]}>
          {formattedDuration}
        </Text>
      )}
    </div>
  );
};
