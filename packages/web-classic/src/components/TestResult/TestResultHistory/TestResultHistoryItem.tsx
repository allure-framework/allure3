import { type HistoryTestResult, formatDuration } from "@allurereport/core-api";
import { IconButton, Text, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import { clsx } from "clsx";
import { type FunctionalComponent } from "preact";
import { useState } from "preact/hooks";

import { ArrowButton } from "@/components/ArrowButton";
import { TestResultError } from "@/components/TestResult/TestResultError";
import TreeItemIcon from "@/components/Tree/TreeItemIcon";
import { useI18n } from "@/stores";
import { timestampToDate } from "@/utils/time";

import * as styles from "@/components/TestResult/TestResultHistory/styles.scss";

const getHistoryDate = ({ stop, start, duration }: HistoryTestResult) => {
  if (stop) {
    return timestampToDate(stop);
  }

  if (start && duration) {
    return timestampToDate(start + duration);
  }

  return undefined;
};

export const TestResultHistoryItem: FunctionalComponent<{
  testResultItem: HistoryTestResult;
}> = ({ testResultItem }) => {
  const { status, error, duration, url } = testResultItem;
  // local history stores error details as top-level fields
  const message = testResultItem.message ?? error?.message;
  const trace = testResultItem.trace ?? error?.trace;
  const [isOpened, setIsOpen] = useState(false);
  const historyDate = getHistoryDate(testResultItem);
  const formattedDuration = typeof duration === "number" ? formatDuration(duration) : undefined;
  const { t } = useI18n("controls");
  // history results belong to previous reports, so they can be opened only by the resolved url of that report
  const navigateUrl = url || undefined;

  const content = (
    <>
      <TreeItemIcon status={status} className={styles["test-result-history-item-status"]} />
      <div className={styles["test-result-history-item-body"]}>
        <Text className={styles["test-result-history-item-text"]}>{historyDate}</Text>
        {Boolean(message) && (
          <Text
            tag={"div"}
            size={"s"}
            className={styles["test-result-history-item-message"]}
            data-testid="test-result-history-item-message"
          >
            {message}
          </Text>
        )}
      </div>
      <div className={styles["test-result-history-item-info"]}>
        {Boolean(formattedDuration) && (
          <Text type="ui" size={"s"} className={styles["item-time"]}>
            {formattedDuration}
          </Text>
        )}
        {navigateUrl && (
          <TooltipWrapper tooltipText={t("openInNewTab")}>
            <IconButton
              icon={allureIcons.lineGeneralLinkExternal}
              style={"ghost"}
              size={"s"}
              className={styles["test-result-history-item-link"]}
              data-testid="test-result-history-item-link"
              onClick={(e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                globalThis.open(navigateUrl, "_blank", "noopener,noreferrer");
              }}
            />
          </TooltipWrapper>
        )}
      </div>
    </>
  );

  return (
    <div data-testid="test-result-history-item">
      <div className={styles["test-result-history-item-header"]}>
        {Boolean(message) && (
          <span onClick={() => setIsOpen(!isOpened)}>
            <ArrowButton isOpened={isOpened} icon={allureIcons.arrowsChevronDown} />
          </span>
        )}
        {navigateUrl ? (
          <a href={navigateUrl} className={styles["test-result-history-item-wrap"]}>
            {content}
          </a>
        ) : (
          <div
            className={clsx(styles["test-result-history-item-wrap"], styles["test-result-history-item-wrap-static"])}
          >
            {content}
          </div>
        )}
      </div>
      {isOpened && message && (
        <div className={styles["test-result-history-item-content"]}>
          <TestResultError message={message} trace={trace ?? ""} />
        </div>
      )}
    </div>
  );
};
