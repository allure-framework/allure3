import { type DefaultTestStepResult, formatDuration } from "@allurereport/core-api";
import { SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import * as styles from "@/components/TestResult/TestResultSteps/styles.scss";

export const TestResultStepInfo = (props: { item: DefaultTestStepResult }) => {
  const { item } = props;
  const formattedDuration = formatDuration(item?.duration as number);
  const stepLength = item.steps?.length;
  const attachmentLength = item.steps?.filter((step) => step.type === "attachment")?.length;

  return (
    <div className={styles["item-info"]}>
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
