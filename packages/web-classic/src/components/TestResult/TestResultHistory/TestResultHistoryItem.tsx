import { type HistoryTestResult, formatDuration } from "@allurereport/core-api";
import { IconButton, Text, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import { type FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import { ArrowButton } from "@/components/ArrowButton";
import { TestResultError } from "@/components/TestResult/TestResultError";
import * as styles from "@/components/TestResult/TestResultHistory/styles.scss";
import TreeItemIcon from "@/components/Tree/TreeItemIcon";
import { useI18n } from "@/stores";
import { navigateTo, openInNewTab } from "@/utils/navigate";
import { timestampToDate } from "@/utils/time";

export const TestResultHistoryItem: FunctionalComponent<{
  testResultItem: HistoryTestResult;
}> = ({ testResultItem }) => {
  const { status, message, trace, stop, duration, id } = testResultItem;
  const [isOpened, setIsOpen] = useState(false);
  const convertedStop = timestampToDate(stop);
  const formattedDuration = formatDuration(duration as number);
  const { t } = useI18n("controls");

  const navigateUrl = `testresult/${id}`;

  return (
    <div>
      <div className={styles["test-result-history-item-header"]}>
        {Boolean(message) && (
          <span onClick={() => setIsOpen(!isOpened)}>
            <ArrowButton isOpened={isOpened} icon={allureIcons.arrowsChevronDown} />
          </span>
        )}
        <div
          className={styles["test-result-history-item-wrap"]}
          onClick={(e) => {
            e.stopPropagation();
            navigateTo(navigateUrl);
          }}
        >
          <TreeItemIcon status={status} className={styles["test-result-history-item-status"]} />
          <Text className={styles["test-result-history-item-text"]}>{convertedStop}</Text>
          <div className={styles["test-result-history-item-info"]}>
            <Text type="ui" size={"s"} className={styles["item-time"]}>
              {formattedDuration}
            </Text>
            <TooltipWrapper tooltipText={t("openInNewTab")}>
              <IconButton
                icon={allureIcons.lineGeneralLinkExternal}
                style={"ghost"}
                size={"s"}
                className={styles["test-result-history-item-link"]}
                onClick={(e) => {
                  e.stopPropagation();
                  openInNewTab(navigateUrl);
                }}
              />
            </TooltipWrapper>
          </div>
        </div>
      </div>
      {isOpened && message && (
        <div>
          <TestResultError message={message} trace={trace} />
        </div>
      )}
    </div>
  );
};
