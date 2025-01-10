import { formatDuration } from "@allurereport/core-api";
import { SvgIcon, allureIcons } from "@allurereport/web-components";
import { Text } from "@allurereport/web-components";
import * as styles from "@/components/TestResult/TestResultSteps/styles.scss";

export const TestResultStepInfo = ({ item }) => {
  const { steps } = item;
  const formattedDuration = formatDuration(item?.duration as number);
  const stepLength = steps?.length;
  const attachmentLength = steps?.filter((step) => step.type === "attachment")?.length;

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
