import { Text } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";

import { TestResultHistoryItem } from "@/components/TestResult/TestResultHistory/TestResultHistoryItem";
import { useI18n } from "@/stores";
import { getHistorySuccessRate } from "@/utils/historySuccessRate";

import { type ReportTestResult } from "../../../../types";

import * as styles from "./styles.scss";

export type TestResultHistoryViewProps = {
  testResult?: ReportTestResult;
};

const TestResultHistoryView: FunctionalComponent<TestResultHistoryViewProps> = ({ testResult }) => {
  const { history, status } = testResult ?? {};
  const { t } = useI18n("empty");
  const { t: tUi } = useI18n("ui");
  const successRate = history?.length ? getHistorySuccessRate(status, history) : undefined;

  return (
    <div className={styles["test-result-history"]}>
      {history?.length ? (
        <>
          {successRate && (
            <Text tag={"div"} size={"m"} bold className={styles["test-result-history-success-rate"]}>
              <span data-testid="test-result-history-success-rate">
                {tUi("successRate", { rate: successRate.rate, passed: successRate.passed, total: successRate.total })}
              </span>
            </Text>
          )}
          {history.map((item, key) => (
            <TestResultHistoryItem testResultItem={item} key={key} />
          ))}
        </>
      ) : (
        <div className={styles["test-result-empty"]}>{t("no-history-results")}</div>
      )}
    </div>
  );
};

export default TestResultHistoryView;
