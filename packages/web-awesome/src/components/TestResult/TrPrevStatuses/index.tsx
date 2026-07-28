import { type HistoryTestResult, capitalize } from "@allurereport/core-api";
import { SvgIcon, Text, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import type { ReportTestResult } from "types";

import { getHistoryNavigationUrl } from "@/components/TestResult/historyNavigation";
import { useI18n } from "@/stores";
import { timestampToDate } from "@/utils/time";

import * as styles from "./styles.scss";

const TrPrevStatus: FunctionalComponent<{ item: HistoryTestResult }> = ({ item }) => {
  const navigateUrl = getHistoryNavigationUrl(item.url, item.id);

  if (!navigateUrl) {
    return (
      <div className={styles["test-result-prev-status"]}>
        <SvgIcon id={allureIcons.lineShapesDotCircle} className={styles[`status-${item?.status}`]} />
      </div>
    );
  }

  return (
    <a className={styles["test-result-prev-status"]} href={navigateUrl}>
      <SvgIcon id={allureIcons.lineShapesDotCircle} className={styles[`status-${item?.status}`]} />
    </a>
  );
};
const TrPrevStatusTooltip: FunctionalComponent<{ item: HistoryTestResult }> = ({ item }) => {
  const convertedStop = item.stop && timestampToDate(item.stop);
  const { t } = useI18n("statuses");
  const status = t(item.status);

  return (
    <div className={styles["test-result-prev-status-tooltip"]}>
      <Text tag={"div"} size={"m"} bold>
        {capitalize(status)}
      </Text>
      <Text size={"m"}>{convertedStop}</Text>
    </div>
  );
};

export type TrPrevStatusesProps = {
  history: ReportTestResult["history"];
};

export const TrPrevStatuses: FunctionalComponent<TrPrevStatusesProps> = ({ history }) => {
  return (
    <div className={styles["test-result-prev-statuses"]}>
      {history?.slice(0, 6).map((item, key) => (
        <div key={key} data-testid={"test-result-prev-status"} className={styles["test-result-prev-status"]}>
          <TooltipWrapper key={key} tooltipComponent={<TrPrevStatusTooltip item={item} />}>
            <TrPrevStatus item={item} />
          </TooltipWrapper>
        </div>
      ))}
    </div>
  );
};
