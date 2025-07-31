import { formatDuration } from "@allurereport/core-api";
import { ArrowButton, IconButton, Text, TreeItemIcon, allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { AwesomeTestResult } from "types";
import { TrError } from "@/components/TestResult/TrError";
import * as styles from "@/components/TestResult/TrRetriesView/styles.scss";
import { useI18n } from "@/stores/locale";
import { navigateTo } from "@/stores/router";
import { timestampToDate } from "@/utils/time";

export type TrRetriesItemProps = {
  testResultItem: AwesomeTestResult;
  attempt: number;
  totalAttempts: number;
};

export const TrRetriesItem: FunctionalComponent<TrRetriesItemProps> = ({ testResultItem, attempt, totalAttempts }) => {
  const { id, status, error, stop, duration } = testResultItem;
  const [isOpened, setIsOpen] = useState(false);

  const { t } = useI18n("ui");

  const retryTitlePrefix = t("attempt", { attempt, total: totalAttempts });
  const convertedStop = stop ? timestampToDate(stop) : undefined;
  const retryTitle = convertedStop ? `${retryTitlePrefix} – ${convertedStop}` : retryTitlePrefix;

  const formattedDuration = typeof duration === "number" ? formatDuration(duration) : undefined;
  const navigateUrl = id;

  return (
    <div data-testid="test-result-retries-item">
      <div className={styles["test-result-retries-item-header"]} onClick={() => setIsOpen(!isOpened)}>
        {Boolean(error.trace || error.message) && (
          <ArrowButton
            data-testid="test-result-retries-item-arrow-button"
            isOpened={isOpened}
            icon={allureIcons.lineArrowsChevronDown}
          />
        )}
        <div className={styles["test-result-retries-item-wrap"]}>
          <TreeItemIcon status={status} className={styles["test-result-retries-item-status"]} />
          <Text data-testid="test-result-retries-item-text" className={styles["test-result-retries-item-text"]}>
            {retryTitle}
          </Text>
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
              data-testid="test-result-retries-item-open-button"
              onClick={() => navigateTo(navigateUrl)}
            />
          </div>
        </div>
      </div>
      {isOpened && (error.message || error.trace) && (
        <div className={styles["test-result-retries-item-content"]}>
          <TrError {...error} status={status} />
        </div>
      )}
    </div>
  );
};
