import { EmptyView } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import type { AwesomeTestResult } from "types";
import { TrRetriesItem } from "@/components/TestResult/TrRetriesView/TrRetriesItem";
import { useI18n } from "@/stores";
import * as styles from "./styles.scss";

export const TrRetriesView: FunctionalComponent<{
  testResult: AwesomeTestResult;
}> = ({ testResult }) => {
  const { retries } = testResult ?? {};
  const { t } = useI18n("empty");

  return (
    <div className={styles["test-result-retries"]}>
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
        <EmptyView description={t("no-retries-results")} />
      )}
    </div>
  );
};
