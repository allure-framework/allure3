import type { FunctionalComponent } from "preact";
import type { AllureAwesomeTestResult } from "types";
import { TestResultHistoryItem } from "@/components/app/TestResult/TestResultHistory/TestResultHistoryItem";
import { useI18n } from "@/stores";
import * as styles from "./styles.scss";

export type TestResultHistoryViewProps = {
  testResult?: AllureAwesomeTestResult;
};

const TestResultHistoryView: FunctionalComponent<TestResultHistoryViewProps> = ({ testResult }) => {
  const { history } = testResult ?? {};
  const { t } = useI18n("empty");

  return (
    <div className={styles["test-result-history"]}>
      {history.length ? (
        history?.map((item, key) => <TestResultHistoryItem testResultItem={item} key={key} />)
      ) : (
        <div className={styles["test-result-empty"]}>{t("no-history-results")}</div>
      )}
    </div>
  );
};

export default TestResultHistoryView;