import type { FunctionalComponent } from "preact";
import { TrHistoryItem } from "@/components/TestResult/TrHistory/TrHistoryItem";
import { useI18n } from "@/stores";
import { type AwesomeTestResult } from "../../../../types";
import * as styles from "./styles.scss";

export type TrHistoryViewProps = {
  testResult?: AwesomeTestResult;
};

const TrHistoryView: FunctionalComponent<TrHistoryViewProps> = ({ testResult }) => {
  const { history } = testResult ?? {};
  const { t } = useI18n("empty");

  return (
    <div className={styles["test-result-history"]}>
      {history.length ? (
        history?.map((item, key) => <TrHistoryItem testResultItem={item} key={key} />)
      ) : (
        <div className={styles["test-result-empty"]}>{t("no-history-results")}</div>
      )}
    </div>
  );
};

export default TrHistoryView;
