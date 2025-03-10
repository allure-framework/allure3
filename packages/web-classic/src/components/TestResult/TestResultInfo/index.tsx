import { formatDuration } from "@allurereport/core-api";
import { Counter, Heading, Text, TooltipWrapper } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import type { AwesomeTestResult } from "types";
import { TestResultInfoStatuses } from "@/components/TestResult/TestResultInfo/TestResultInfoStatuses";
import { TestResultNavigation } from "@/components/TestResult/TestResultNavigation";
import { TestResultPrevStatuses } from "@/components/TestResult/TestResultPrevStatuses";
import { TestResultSeverity } from "@/components/TestResult/TestResultSeverity";
import { TestResultStatus } from "@/components/TestResult/TestResultStatus";
import { TestResultTab, TestResultTabsList } from "@/components/TestResult/TestResultTabs";
import { useI18n } from "@/stores/locale";
import { timestampToDate } from "@/utils/time";
import * as styles from "./styles.scss";

export type TestResultInfoProps = {
  testResult?: AwesomeTestResult;
};

export const TestResultInfo: FunctionalComponent<TestResultInfoProps> = ({ testResult }) => {
  const { name, status, muted, flaky, known, duration, labels, history, retries, attachments, stop } = testResult ?? {};
  const formattedDuration = formatDuration(duration as number);
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
