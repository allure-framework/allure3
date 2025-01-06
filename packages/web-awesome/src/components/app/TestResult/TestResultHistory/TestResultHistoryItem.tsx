import { formatDuration } from "@allurereport/core-api";
import { useState } from "preact/hooks";
import arrowsChevronDown from "@/assets/svg/arrows-chevron-down.svg";
import LineGeneralLinkExternal from "@/assets/svg/line-general-link-external.svg";
import { ArrowButton } from "@/components/app/ArrowButton";
import { TestResultError } from "@/components/app/TestResult/TestResultError";
import * as styles from "@/components/app/TestResult/TestResultHistory/styles.scss";
import TreeItemIcon from "@/components/app/Tree/TreeItemIcon";
import { IconButton } from "@/components/commons/Button";
import { TooltipWrapper } from "@/components/commons/Tooltip";
import { Text } from "@/components/commons/Typography";
import { openInNewTab } from "@/index";
import { useI18n } from "@/stores";
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
      <div className={styles["test-result-history-item-header"]} onClick={() => setIsOpen(!isOpened)}>
        {Boolean(message) && <ArrowButton isOpened={isOpened} icon={arrowsChevronDown.id} />}
        <div className={styles["test-result-history-item-wrap"]}>
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
