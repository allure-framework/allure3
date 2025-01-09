import type { FunctionalComponent } from "preact";
import type { AllureAwesomeTestResult } from "types";
import LineShapesDotCircle from "@/assets/svg/line-shapes-dot-circle.svg";
import { useTestResultTabsContext } from "@/components/app/TestResult/TestResultTabs";
import { SvgIcon } from "@/components/commons/SvgIcon";
import { TooltipWrapper } from "@/components/commons/Tooltip";
import { Text } from "@/components/commons/Typography";
import { navigateTo, openInNewTab } from "@/index";
import { useI18n } from "@/stores";
import { capitalize } from "@/utils/capitalize";
import { timestampToDate } from "@/utils/time";
import * as styles from "./styles.scss";

const TestResultPrevStatus = ({ item }) => {
  return (
    <div className={styles["test-result-prev-status"]} onClick={() => navigateTo(`testresult/${item.id}`)}>
      <SvgIcon id={LineShapesDotCircle.id} className={styles[`status-${item?.status}`]} />
    </div>
  );
};
const TestResultPrevStatusTooltip = ({ item }) => {
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
  history: AllureAwesomeTestResult["history"];
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
