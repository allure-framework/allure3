import { type HistoryTestResult, capitalize } from "@allurereport/core-api";
import { HISTORY_DATA_POINT_LIMIT } from "@allurereport/plugin-api/internal/report";
import { SvgIcon, Text, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import type { ReportTestResult } from "types";

import { useI18n } from "@/stores";
import { timestampToDate } from "@/utils/time";

import * as styles from "./styles.scss";

const TestResultPrevStatus: FunctionalComponent<{ item: HistoryTestResult }> = ({ item }) => {
  // the url is resolved by the plugin and is empty when the historical report cannot be opened
  if (!item.url) {
    return (
      <div className={styles["test-result-prev-status"]}>
        <SvgIcon id={allureIcons.lineShapesDotCircle} className={styles[`status-${item?.status}`]} />
      </div>
    );
  }

  return (
    <a className={styles["test-result-prev-status"]} href={item.url} target={"_blank"} rel={"noreferrer"}>
      <SvgIcon id={allureIcons.lineShapesDotCircle} className={styles[`status-${item?.status}`]} />
    </a>
  );
};
const TestResultPrevStatusTooltip: FunctionalComponent<{ item: HistoryTestResult }> = ({ item }) => {
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

export type TestResultPrevStatusesProps = {
  history: ReportTestResult["history"];
};

export const TestResultPrevStatuses: FunctionalComponent<TestResultPrevStatusesProps> = ({ history }) => {
  return (
    <div className={styles["test-result-prev-statuses"]}>
      {history
        ?.slice(0, HISTORY_DATA_POINT_LIMIT)
        .sort((a: HistoryTestResult, b: HistoryTestResult) => (a.stop ?? 0) - (b.stop ?? 0))
        .map((item, key) => (
          <div key={key} data-testid={"test-result-prev-status"} className={styles["test-result-prev-status"]}>
            <TooltipWrapper key={key} tooltipComponent={<TestResultPrevStatusTooltip item={item} />}>
              <TestResultPrevStatus item={item} />
            </TooltipWrapper>
          </div>
        ))}
    </div>
  );
};
