import { formatDuration } from "@allurereport/core-api";
import { IconButton } from "@allurereport/web-components";
import { TooltipWrapper } from "@allurereport/web-components";
import { Text } from "@allurereport/web-components";
import { useState } from "preact/hooks";
import arrowsChevronDown from "@/assets/svg/arrows-chevron-down.svg";
import LineGeneralLinkExternal from "@/assets/svg/line-general-link-external.svg";
import { ArrowButton } from "@/components/ArrowButton";
import { TestResultError } from "@/components/TestResult/TestResultError";
import * as styles from "@/components/TestResult/TestResultHistory/styles.scss";
import TreeItemIcon from "@/components/Tree/TreeItemIcon";
import { navigateTo, openInNewTab } from "@/index";
import { timestampToDate } from "@/utils/time";

export const TestResultHistoryItem = ({ testResultItem }) => {
  const { status, message, trace, stop, duration, id } = testResultItem;
  const [isOpened, setIsOpen] = useState(false);
  const convertedStop = timestampToDate(stop);
  const formattedDuration = formatDuration(duration as number);
  const { t } = useI18n("controls");

  const navigateUrl = `/testresult/${id}`;

  return (
    <div>
      <div className={styles["test-result-history-item-header"]}>
        {Boolean(message) && (
          <span onClick={() => setIsOpen(!isOpened)}>
            <ArrowButton isOpened={isOpened} icon={arrowsChevronDown.id} />
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
                icon={LineGeneralLinkExternal.id}
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
