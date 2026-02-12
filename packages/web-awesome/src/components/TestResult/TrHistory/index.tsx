import { EmptyView } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { type AwesomeTestResult } from "@/../types";
import { TrHistoryItem } from "@/components/TestResult/TrHistory/TrHistoryItem";
import { useI18n } from "@/stores";
import * as styles from "./styles.scss";

export type TrHistoryViewProps = {
  testResult?: AwesomeTestResult;
};

const TrHistoryView: FunctionalComponent<TrHistoryViewProps> = (props) => {
  const { testResult = {} as AwesomeTestResult } = props;
  const { history = [] } = testResult;
  const { t } = useI18n("empty");

  const hasHistory = history.length > 0;

  if (!hasHistory) {
    return (
      <div className={styles["test-result-history"]}>
        <EmptyView description={t("no-history-results")} />
      </div>
    );
  }

  return (
    <div className={styles["test-result-history"]}>
      {history.map((item, key) => (
        <TrHistoryItem key={key} historyTr={item} />
      ))}
    </div>
  );
};

export default TrHistoryView;
