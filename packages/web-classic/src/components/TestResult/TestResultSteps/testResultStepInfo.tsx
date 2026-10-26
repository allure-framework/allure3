import { formatDuration } from "@allurereport/core-api";
import { SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import clsx from "clsx";

import { countFailedSubSteps } from "@/components/TestResult/TestResultError/errorDetails";
import type { TestResultStepItem } from "@/components/TestResult/TestResultSteps/testResultStep";

import * as styles from "@/components/TestResult/TestResultSteps/styles.scss";

const statusIcons = {
  failed: allureIcons.lineGeneralXCircle,
  broken: allureIcons.lineGeneralInfoCircle,
} as const;

export const TestResultStepInfo = (props: { item: TestResultStepItem }) => {
  const { item } = props;
  const formattedDuration = formatDuration(item?.duration as number);
  const stepLength = item.steps?.length;
  const attachmentLength = item.steps?.filter((step) => step.type === "attachment")?.length;
  const failedSubSteps = countFailedSubSteps(item.steps);

  return (
    <div className={styles["item-info"]}>
      {(Object.keys(statusIcons) as (keyof typeof statusIcons)[])
        .filter((status) => failedSubSteps[status])
        .map((status) => (
          <div key={status} className={styles["item-status"]} data-testid={`test-result-step-${status}-count`}>
            <SvgIcon
              size="s"
              id={statusIcons[status]}
              className={clsx(styles["item-status-icon"], styles[`status-${status}`])}
            />
            <Text size={"s"}>{failedSubSteps[status]}</Text>
          </div>
        ))}
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
