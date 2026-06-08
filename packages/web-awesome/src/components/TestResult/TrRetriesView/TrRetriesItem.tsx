import { formatDuration } from "@allurereport/core-api";
import { ArrowButton, IconButton, Text, TreeItemIcon, allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { AwesomeTestResult } from "types";

import { hasErrorDiff } from "@/components/TestResult/bodyItems";
import { TrError } from "@/components/TestResult/TrError";
import { useI18n } from "@/stores/locale";
import { navigateToTestResult } from "@/stores/router";
import { timestampToDate } from "@/utils/time";

import * as styles from "@/components/TestResult/TrRetriesView/styles.scss";

export type TrRetriesItemProps = {
  testResultItem: AwesomeTestResult;
  attempt: number;
  totalAttempts: number;
};

export const TrRetriesItem: FunctionalComponent<TrRetriesItemProps> = ({ testResultItem, attempt, totalAttempts }) => {
  const { id, status, error, stop, duration } = testResultItem;
  const [isOpened, setIsOpen] = useState(false);

  const { t } = useI18n("ui");
  const { t: controls } = useI18n("controls");

  const retryTitlePrefix = t("attempt", { attempt, total: totalAttempts });
  const convertedStop = stop ? timestampToDate(stop) : undefined;
  const retryTitle = convertedStop ? `${retryTitlePrefix} – ${convertedStop}` : retryTitlePrefix;

  const formattedDuration = typeof duration === "number" ? formatDuration(duration) : undefined;
  const errorPreview = getErrorPreview(error, controls("comparison"));
  const hasErrorDetails = Boolean(errorPreview);

  return (
    <div data-testid="test-result-retries-item">
      <div className={styles["test-result-retries-item-header"]} onClick={() => setIsOpen(!isOpened)}>
        {hasErrorDetails && (
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
          {errorPreview && (
            <Text
              data-testid="test-result-retries-item-error-preview"
              type="ui"
              size="s"
              className={styles["test-result-retries-item-error-preview"]}
            >
              {errorPreview}
            </Text>
          )}
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
              onClick={() => navigateToTestResult({ testResultId: id })}
            />
          </div>
        </div>
      </div>
      {isOpened && hasErrorDetails && (
        <div className={styles["test-result-retries-item-content"]}>
          <TrError {...(error ?? {})} status={status} />
        </div>
      )}
    </div>
  );
};

const getErrorPreview = (error: AwesomeTestResult["error"], diffPreview: string) => {
  const message = error?.message?.trim();
  if (message) return message;

  const tracePreview = error?.trace
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (tracePreview) return tracePreview;

  if (hasErrorDiff(error)) return diffPreview;
};
