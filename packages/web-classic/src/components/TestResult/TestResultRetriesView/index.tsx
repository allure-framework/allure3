import type { FunctionalComponent } from "preact";
import type { AwesomeTestResult } from "types";
import * as styles from "@/components/TestResult/TestResultHistory/styles.scss";
import { TestResultRetriesItem } from "@/components/TestResult/TestResultRetriesView/TestResultRetriesItem";
import { useI18n } from "@/stores";

export const TestResultRetriesView: FunctionalComponent<{ testResult: AwesomeTestResult }> = ({ testResult }) => {
  const { retries } = testResult ?? {};
  const { t } = useI18n("empty");

  return (
    <div className={styles["test-result-history"]}>
      {retries.length ? (
        retries?.map((item, key) => (
          <TestResultRetriesItem
            testResultItem={item}
            key={key}
            attempt={retries.length - key}
            totalAttempts={retries.length + 1}
          />
        ))
      ) : (
        <div className={styles["test-result-empty"]}>{t("no-retries-results")}</div>
      )}
    </div>
  );
};
