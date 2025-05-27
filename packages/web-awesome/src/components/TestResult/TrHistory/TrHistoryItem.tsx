import { type HistoryTestResult, formatDuration } from "@allurereport/core-api";
import { IconButton, Text, TooltipWrapper, TreeItemIcon, allureIcons } from "@allurereport/web-components";
import { type FunctionalComponent } from "preact";
import { useMemo, useState } from "preact/hooks";
import { ArrowButton } from "@/components/ArrowButton";
import { TrError } from "@/components/TestResult/TrError";
import * as styles from "@/components/TestResult/TrHistory/styles.scss";
import { useI18n } from "@/stores";
import { timestampToDate } from "@/utils/time";

export const TrHistoryItem: FunctionalComponent<{
  testResultItem: HistoryTestResult;
}> = ({ testResultItem }: { testResultItem: HistoryTestResult }) => {
  const { status, error, stop, duration, id, url } = testResultItem;
  const [isOpened, setIsOpen] = useState(false);
  const convertedStop = timestampToDate(stop);
  const formattedDuration = formatDuration(duration as number);
  const { t } = useI18n("controls");
  const navigateUrl = useMemo(() => {
    if (!url) {
      return undefined;
    }

    const navUrl = new URL(url);

    navUrl.hash = id;

    return navUrl.toString();
  }, [url]);
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
        <Text className={styles["test-result-history-item-text"]}>{convertedStop}</Text>
        <div className={styles["test-result-history-item-info"]}>
          <Text type="ui" size={"s"} className={styles["item-time"]}>
            {formattedDuration}
          </Text>
          {renderExternalLink()}
        </div>
      </>
    );
  };

  return (
    <div>
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
