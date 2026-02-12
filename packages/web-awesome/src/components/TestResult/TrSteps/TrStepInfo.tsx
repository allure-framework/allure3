import {
  type DefaultTestStepResult,
  type TestStatus,
  type TestStepResult,
  formatDuration,
} from "@allurereport/core-api";
import { SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import clsx from "clsx";
import * as styles from "@/components/TestResult/TrSteps/styles.scss";

const countErrorStatuses = (step: TestStepResult): Record<string, number> => {
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

export const TrStepInfo = (props: { item: DefaultTestStepResult }) => {
  const { item } = props;
  const formattedDuration = formatDuration(item?.duration as number);
  const stepLength = item.steps?.length;
  const attachmentLength = item.steps?.filter((step) => step.type === "attachment")?.length;

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
      {Boolean(stepLength) && (
        <div className={styles["item-info-step"]}>
          <SvgIcon id={allureIcons.lineArrowsCornerDownRight} className={styles["item-info-step-icon"]} />
          <Text size={"s"}>{stepLength}</Text>
        </div>
      )}
      {Boolean(attachmentLength) && (
        <div className={styles["item-info-step"]}>
          <SvgIcon id={allureIcons.lineFilesFileAttachment2} className={styles["item-info-step-icon"]} />
          <Text size={"s"}>{attachmentLength}</Text>
        </div>
      )}
      <Text type="ui" size={"s"} className={styles["item-time"]}>
        {formattedDuration}
      </Text>
    </div>
  );
};
