import type { FunctionalComponent } from "preact";
import type { AwesomeTestResult } from "types";
import * as styles from "@/components/TestResult/TrHistory/styles.scss";
import { TrRetriesItem } from "@/components/TestResult/TrRetriesView/TrRetriesItem";
import { useI18n } from "@/stores";

export const TrRetriesView: FunctionalComponent<{
  testResult: AwesomeTestResult;
}> = ({ testResult }) => {
  const { retries } = testResult ?? {};
  const { t } = useI18n("empty");

  return (
    <div className={styles["test-result-history"]}>
      {retries.length ? (
        retries?.map((item, key) => (
          <TrRetriesItem
            testResultItem={item as unknown as AwesomeTestResult}
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
