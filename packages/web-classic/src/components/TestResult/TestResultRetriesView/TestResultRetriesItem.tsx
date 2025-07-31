import { type TestResult, formatDuration } from "@allurereport/core-api";
import { IconButton, Text, allureIcons } from "@allurereport/web-components";
import { type FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import { ArrowButton } from "@/components/ArrowButton";
import { TestResultError } from "@/components/TestResult/TestResultError";
import * as styles from "@/components/TestResult/TestResultRetriesView/styles.scss";
import TreeItemIcon from "@/components/Tree/TreeItemIcon";
import { useI18n } from "@/stores";
import { navigateTo } from "@/utils/navigate";
import { timestampToDate } from "@/utils/time";

export type TrRetriesItemProps = {
  testResultItem: TestResult;
  attempt: number;
  totalAttempts: number;
};

export const TestResultRetriesItem: FunctionalComponent<TrRetriesItemProps> = ({
  testResultItem,
  attempt,
  totalAttempts,
}) => {
  const { id, status, message, trace, stop, duration } = testResultItem;
  const [isOpened, setIsOpen] = useState(false);
  const { t } = useI18n("ui");

  const retryTitlePrefix = t("attempt", { attempt, total: totalAttempts });
  const convertedStop = stop ? timestampToDate(stop) : undefined;
  const retryTitle = convertedStop ? `${retryTitlePrefix} – ${convertedStop}` : retryTitlePrefix;

  const formattedDuration = typeof duration === "number" ? formatDuration(duration) : undefined;
  const navigateUrl = `testresult/${id}`;

  return (
    <div>
      <div className={styles["test-result-retries-item-header"]} onClick={() => setIsOpen(!isOpened)}>
        {Boolean(message) && <ArrowButton isOpened={isOpened} icon={allureIcons.lineArrowsChevronDown} />}
        <div className={styles["test-result-retries-item-wrap"]}>
          <TreeItemIcon status={status} className={styles["test-result-retries-item-status"]} />
          <Text className={styles["test-result-retries-item-text"]}>{retryTitle}</Text>
          <div className={styles["test-result-retries-item-info"]}>
            {Boolean(formattedDuration) && (
              <Text type="ui" size={"s"} className={styles["item-time"]}>
                {formattedDuration}
              </Text>
            )}
            <IconButton
              icon={allureIcons.lineGeneralLinkExternal}
              style={"ghost"}
              size={"s"}
              className={styles["test-result-retries-item-link"]}
              onClick={() => navigateTo(navigateUrl)}
            />
          </div>
        </div>
      </div>
      {isOpened && message && (
        <div className={styles["test-result-retries-item-content"]}>
          <TestResultError message={message} trace={trace} />
        </div>
      )}
    </div>
  );
};
