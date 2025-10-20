import { type HistoryTestResult, type TestLabel } from "@allurereport/core-api";
import { capitalize, getReportOptions } from "@allurereport/web-commons";
import { SvgIcon, Text, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import type { AwesomeReportOptions, AwesomeTestResult } from "types";
import { useI18n } from "@/stores";
import { timestampToDate } from "@/utils/time";
import * as styles from "./styles.scss";

const TrPrevStatus: FunctionalComponent<{ item: HistoryTestResult }> = ({ item }) => {
  const reportOptions = getReportOptions<AwesomeReportOptions & { id: string }>();

  if (!item.url) {
    return (
      <div className={styles["test-result-prev-status"]}>
        <SvgIcon id={allureIcons.lineShapesDotCircle} className={styles[`status-${item?.status}`]} />
      </div>
    );
  }

  const { origin, pathname } = new URL(item.url);
  const navigateUrl = new URL([pathname, reportOptions.id].join("/"), origin);

  navigateUrl.hash = item.id;

  return (
    <a className={styles["test-result-prev-status"]} href={navigateUrl.toString()}>
      <SvgIcon id={allureIcons.lineShapesDotCircle} className={styles[`status-${item?.status}`]} />
    </a>
  );
};
const TrPrevStatusTooltip: FunctionalComponent<{ item: HistoryTestResult }> = ({ item }) => {
  const reportOptions = getReportOptions<AwesomeReportOptions & { id: string }>();
  const convertedStop = item.stop && timestampToDate(item.stop);
  const { t } = useI18n("statuses");
  const status = t(item.status);
  const versionLabel = reportOptions?.versionLabel;
  const labelValue = versionLabel ? item.labels?.find((label: TestLabel) => label.name === versionLabel)?.value : undefined;

  return (
    <div className={styles["test-result-prev-status-tooltip"]}>
      <Text tag={"div"} size={"m"} bold>
        {capitalize(status)}
      </Text>
      <Text tag={"div"} size={"m"}>{convertedStop}</Text>
      {Boolean(labelValue) && <Text size={"m"}>{labelValue}</Text>}
    </div>
  );
};

export type TrPrevStatusesProps = {
  history: AwesomeTestResult["history"];
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
