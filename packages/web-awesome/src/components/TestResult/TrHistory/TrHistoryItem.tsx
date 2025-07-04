import { type HistoryTestResult, formatDuration } from "@allurereport/core-api";
import { getReportOptions } from "@allurereport/web-commons";
import { ArrowButton, IconButton, Text, TooltipWrapper, TreeItemIcon, allureIcons } from "@allurereport/web-components";
import { type FunctionalComponent } from "preact";
import { useMemo, useState } from "preact/hooks";
import type { AwesomeReportOptions } from "types";
import { TrError } from "@/components/TestResult/TrError";
import * as styles from "@/components/TestResult/TrHistory/styles.scss";
import { useI18n } from "@/stores";
import { timestampToDate } from "@/utils/time";

export const TrHistoryItem: FunctionalComponent<{
  testResultItem: HistoryTestResult;
}> = ({ testResultItem }: { testResultItem: HistoryTestResult }) => {
  const reportOptions = getReportOptions<AwesomeReportOptions & { id: string }>();
  const { status, error, stop, duration, id, url } = testResultItem;
  const [isOpened, setIsOpen] = useState(false);
  const convertedStop = stop ? timestampToDate(stop) : undefined;
  const formattedDuration = duration ? formatDuration(duration) : undefined;
  const { t } = useI18n("controls");
  const navigateUrl = useMemo(() => {
    if (!url) {
      return undefined;
    }

    const { origin, pathname } = new URL(url);
    const navUrl = new URL([pathname, reportOptions.id].join("/"), origin);

    navUrl.hash = id;

    return navUrl.toString();
  }, [reportOptions, id, url]);
  const renderExternalLink = () => {
    if (!navigateUrl) {
      return null;
    }

    return (
      <TooltipWrapper tooltipText={t("openInNewTab")}>
        <IconButton
          href={navigateUrl.toString()}
          target={"_blank"}
          icon={allureIcons.lineGeneralLinkExternal}
          style={"ghost"}
          size={"s"}
          className={styles["test-result-history-item-link"]}
          onClick={(e) => {
            e.stopPropagation();
          }}
        />
      </TooltipWrapper>
    );
  };
  const renderItemContent = () => {
    return (
      <>
        <TreeItemIcon status={status} className={styles["test-result-history-item-status"]} />
        {convertedStop && <Text className={styles["test-result-history-item-text"]}>{convertedStop}</Text>}
        <div className={styles["test-result-history-item-info"]}>
          {formattedDuration && (
            <Text type="ui" size={"s"} className={styles["item-time"]}>
              {formattedDuration}
            </Text>
          )}
          {renderExternalLink()}
        </div>
      </>
    );
  };

  return (
    <div data-testid={"test-result-history-item"}>
      <div className={styles["test-result-history-item-header"]}>
        {Boolean(error) && (
          <span onClick={() => setIsOpen(!isOpened)}>
            <ArrowButton isOpened={isOpened} icon={allureIcons.arrowsChevronDown} />
          </span>
        )}
        {navigateUrl ? (
          <a href={navigateUrl} className={styles["test-result-history-item-wrap"]}>
            {renderItemContent()}
          </a>
        ) : (
          <div className={styles["test-result-history-item-wrap"]}>{renderItemContent()}</div>
        )}
      </div>
      {isOpened && error && (
        <div>
          <TrError {...error} status={status} />
        </div>
      )}
    </div>
  );
};
