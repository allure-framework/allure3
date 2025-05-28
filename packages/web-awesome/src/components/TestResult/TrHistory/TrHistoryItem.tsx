import { type HistoryTestResult, formatDuration } from "@allurereport/core-api";
import { ArrowButton, IconButton, Text, TooltipWrapper, TreeItemIcon, allureIcons } from "@allurereport/web-components";
import { type FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import { TrError } from "@/components/TestResult/TrError";
import * as styles from "@/components/TestResult/TrHistory/styles.scss";
import { useI18n } from "@/stores";
import { navigateTo, openInNewTab } from "@/stores/router";
import { timestampToDate } from "@/utils/time";

export const TrHistoryItem: FunctionalComponent<{
  testResultItem: HistoryTestResult;
}> = ({ testResultItem }: { testResultItem: HistoryTestResult }) => {
  const { status, error, stop, duration, id } = testResultItem;
  const [isOpened, setIsOpen] = useState(false);
  const convertedStop = timestampToDate(stop);
  const formattedDuration = formatDuration(duration as number);
  const { t } = useI18n("controls");

  const navigateUrl = id;

  return (
    <div>
      <div className={styles["test-result-history-item-header"]}>
        {Boolean(error) && (
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
      {isOpened && error && (
        <div>
          <TrError {...error} status={status} />
        </div>
      )}
    </div>
  );
};
