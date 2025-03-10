import { type HistoryTestResult } from "@allurereport/core-api";
import { SvgIcon, Text, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import type { AwesomeTestResult } from "types";
import { useI18n } from "@/stores";
import { capitalize } from "@/utils/capitalize";
import { navigateTo } from "@/utils/navigate";
import { timestampToDate } from "@/utils/time";
import * as styles from "./styles.scss";

const TestResultPrevStatus: FunctionalComponent<{ item: HistoryTestResult }> = ({ item }) => {
  return (
    <div className={styles["test-result-prev-status"]} onClick={() => navigateTo(`testresult/${item.id}`)}>
      <SvgIcon id={allureIcons.lineShapesDotCircle} className={styles[`status-${item?.status}`]} />
    </div>
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
  history: AwesomeTestResult["history"];
};

export const TestResultPrevStatuses: FunctionalComponent<TestResultPrevStatusesProps> = ({ history }) => {
  return (
    <div className={styles["test-result-prev-statuses"]}>
      {history?.slice(0, 6).map((item, key) => (
        <div key={key} className={styles["test-result-prev-status"]}>
          <TooltipWrapper key={key} tooltipComponent={<TestResultPrevStatusTooltip item={item} />}>
            <TestResultPrevStatus item={item} />
          </TooltipWrapper>
        </div>
      ))}
    </div>
  );
};
