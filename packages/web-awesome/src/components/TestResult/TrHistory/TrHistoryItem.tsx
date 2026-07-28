import { type HistoryTestResult, formatDuration } from "@allurereport/core-api";
import { getReportOptions } from "@allurereport/web-commons";
import { ArrowButton, IconButton, Text, TooltipWrapper, TreeItemIcon, allureIcons } from "@allurereport/web-components";
import { type FunctionalComponent } from "preact";
import { useMemo, useState } from "preact/hooks";
import type { ReportOptions } from "types";

import { getHistoryNavigationUrl } from "@/components/TestResult/historyNavigation";
import { TrError } from "@/components/TestResult/TrError";
import { useI18n } from "@/stores";
import { timestampToDate } from "@/utils/time";

import * as styles from "@/components/TestResult/TrHistory/styles.scss";

type Props = {
  historyTr: HistoryTestResult;
};

const getDate = (historyTr: HistoryTestResult) => {
  const { stop, duration, start } = historyTr;

  if (stop) {
    return timestampToDate(stop);
  }

  if (start && duration) {
    return timestampToDate(start + duration);
  }

  return undefined;
};

const HistoryDate = (props: { date: string | undefined }) => {
  const { t } = useI18n("trHistory");
  const { date } = props;

  return (
    <Text data-unknown={!date || undefined} className={styles["test-result-history-item-text"]}>
      {date ?? t("unknown-date")}
    </Text>
  );
};

export const TrHistoryItem: FunctionalComponent<Props> = (props) => {
  const reportOptions = getReportOptions<ReportOptions & { id: string }>();
  const { historyTr } = props;
  const { status, error, duration, id, url } = historyTr;
  const [isOpened, setIsOpen] = useState(false);
  const historyDate = getDate(historyTr);
  const formattedDuration = duration ? formatDuration(duration) : undefined;

  const { t } = useI18n("controls");

  const navigateUrl = useMemo(() => {
    return getHistoryNavigationUrl(url, reportOptions.id, id);
  }, [id, reportOptions.id, url]);

  const renderExternalLink = () => {
    if (!navigateUrl) {
      return null;
    }

    return (
      <TooltipWrapper tooltipText={t("openInNewTab")}>
        <IconButton
          href={navigateUrl}
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
        <HistoryDate date={historyDate} />
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
          <ArrowButton
            aria-label={"toggle history error"}
            isOpened={isOpened}
            icon={allureIcons.arrowsChevronDown}
            onClick={() => setIsOpen((value) => !value)}
          />
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
