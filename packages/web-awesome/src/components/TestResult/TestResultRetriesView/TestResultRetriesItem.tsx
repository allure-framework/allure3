import { formatDuration } from "@allurereport/core-api";
import { IconButton, Text, allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { AllureAwesomeTestResult } from "types";
import { ArrowButton } from "@/components/ArrowButton";
import { TestResultError } from "@/components/TestResult/TestResultError";
import * as styles from "@/components/TestResult/TestResultRetriesView/styles.scss";
import TreeItemIcon from "@/components/Tree/TreeItemIcon";
import { navigateTo } from "@/stores/router";
import { timestampToDate } from "@/utils/time";

export const TestResultRetriesItem: FunctionalComponent<{
  testResultItem: AllureAwesomeTestResult;
}> = ({ testResultItem }) => {
  const { id, status, error, stop, duration } = testResultItem;
  const [isOpened, setIsOpen] = useState(false);
  const convertedStop = timestampToDate(stop);
  const formattedDuration = typeof duration === "number" ? formatDuration(duration) : undefined;
  const navigateUrl = `/testresult/${id}`;

  return (
    <div>
      <div className={styles["test-result-retries-item-header"]} onClick={() => setIsOpen(!isOpened)}>
        {Boolean(error) && <ArrowButton isOpened={isOpened} icon={allureIcons.lineArrowsChevronDown} />}
        <div className={styles["test-result-retries-item-wrap"]}>
          <TreeItemIcon status={status} className={styles["test-result-retries-item-status"]} />
          <Text className={styles["test-result-retries-item-text"]}>{convertedStop}</Text>
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
      {isOpened && error && (
        <div className={styles["test-result-retries-item-content"]}>
          <TestResultError {...error} />
        </div>
      )}
    </div>
  );
};
