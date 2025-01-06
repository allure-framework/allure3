import { formatDuration } from "@allurereport/core-api";
import type { FunctionalComponent } from "preact";
import type { AllureAwesomeTestResult } from "types";
import { TestResultInfoStatuses } from "@/components/app/TestResult/TestResultInfo/TestResultInfoStatuses";
import { TestResultNavigation } from "@/components/app/TestResult/TestResultNavigation";
import { TestResultPrevStatuses } from "@/components/app/TestResult/TestResultPrevStatuses";
import { TestResultSeverity } from "@/components/app/TestResult/TestResultSeverity";
import { TestResultStatus } from "@/components/app/TestResult/TestResultStatus";
import { TestResultTab, TestResultTabsList } from "@/components/app/TestResult/TestResultTabs";
import { Counter } from "@/components/commons/Counter";
import { TooltipWrapper } from "@/components/commons/Tooltip";
import { Heading, Text } from "@/components/commons/Typography";
import { useI18n } from "@/stores/locale";
import { timestampToDate } from "@/utils/time";
import * as styles from "./styles.scss";

export type TestResultInfoProps = {
  testResult?: AllureAwesomeTestResult;
};

export const TestResultInfo: FunctionalComponent<TestResultInfoProps> = ({ testResult }) => {
  const { name, status, muted, flaky, known, duration, labels, history, retries, attachments, stop } = testResult ?? {};
  const formattedDuration = formatDuration(duration);
  const fullDate = stop && timestampToDate(stop);
  const severity = labels?.find((label) => label.name === "severity")?.value ?? "normal";
  const { t } = useI18n("ui");
  const statuses = Object.entries({ flaky, muted, known }).filter(([, value]) => value);

  const Content = () => {
    return (
      <>
        {name && (
          <Heading data-testid="test-result-info-title" tag={"h1"} size={"s"} className={styles["test-result-name"]}>
            {name}
          </Heading>
        )}
        <div className={styles["test-result-info-data"]}>
          {Boolean(status) && <TestResultStatus status={status} />}
          {Boolean(history?.length) && <TestResultPrevStatuses history={history} />}
          <TestResultSeverity severity={severity} />
          {Boolean(statuses.length) && <TestResultInfoStatuses statuses={statuses} />}
          <TooltipWrapper tooltipText={fullDate}>
            <Text tag={"div"} size={"s"} bold className={styles["test-result-duration"]}>
              {formattedDuration}
            </Text>
          </TooltipWrapper>
        </div>
        <div className={styles["test-result-tabs"]}>
          <TestResultTabsList>
            <TestResultTab id="overview">{t("overview")}</TestResultTab>
            <TestResultTab id="history" disabled={!history?.length}>
              <div className={styles["test-result-tab"]}>
                {t("history")}
                {Boolean(history?.length) && <Counter size={"s"} count={history?.length} />}
              </div>
            </TestResultTab>
            <TestResultTab id="retries" disabled={!retries?.length}>
              <div className={styles["test-result-tab"]}>
                {t("retries")}
                {Boolean(retries?.length) && <Counter size={"s"} count={retries?.length} />}
              </div>
            </TestResultTab>
            <TestResultTab id="attachments" disabled={!attachments?.length}>
              <div className={styles["test-result-tab"]}>
                {t("attachments")}
                {Boolean(attachments?.length) && <Counter size={"s"} count={attachments?.length} />}
              </div>
            </TestResultTab>
          </TestResultTabsList>
        </div>
      </>
    );
  };

  return (
    <div className={styles["test-result-info"]}>
      <TestResultNavigation testResult={testResult} />
      {testResult && <Content />}
    </div>
  );
};
