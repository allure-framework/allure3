import type { FunctionalComponent } from "preact";
import type { AllureAwesomeTestResult } from "types";
import * as styles from "@/components/app/TestResult/TestResultHistory/styles.scss";
import { TestResultRetriesItem } from "@/components/app/TestResult/TestResultRetriesView/TestResultRetriesItem";
import { useI18n } from "@/stores";

export type TestResultRetriesViewProps = {
  testResult?: AllureAwesomeTestResult;
};

export const TestResultRetriesView: FunctionalComponent<TestResultRetriesViewProps> = ({ testResult }) => {
  const { retries } = testResult ?? {};
  const { t } = useI18n("empty");

  return (
    <div className={styles["test-result-history"]}>
      {retries.length ? (
        retries?.map((item, key) => <TestResultRetriesItem testResultItem={item} key={key} />)
      ) : (
        <div className={styles["test-result-empty"]}>{t("no-retries-results")}</div>
      )}
    </div>
  );
};
