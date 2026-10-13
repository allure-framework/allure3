import { Counter, Heading, SvgIcon, Text, allureIcons } from "@allurereport/web-components";

import { reportStatsStore } from "@/stores";
import { globalsStore } from "@/stores/globals";
import { useI18n } from "@/stores/locale";
import { qualityGateStore } from "@/stores/qualityGate";

import { getReportFailureSummary } from "./model";

import * as styles from "./styles.scss";

const failureSummaryTitleId = "report-failure-summary-title";

export const ReportFailureSummary = () => {
  const { t } = useI18n("ui");
  const summary = getReportFailureSummary(
    reportStatsStore.value.data,
    qualityGateStore.value.data,
    globalsStore.value.data,
  );

  if (!summary.hasFailure) {
    return null;
  }

  const items = [
    {
      count: summary.unsuccessfulTests,
      label: t("failureSummary.unsuccessfulTests"),
      testId: "failure-summary-unsuccessful-tests",
    },
    {
      count: summary.failedQualityGates,
      label: t("failureSummary.failedQualityGates"),
      testId: "failure-summary-failed-quality-gates",
    },
    {
      count: summary.globalErrors,
      label: t("failureSummary.globalErrors"),
      testId: "failure-summary-global-errors",
    },
  ];

  return (
    <section
      className={styles["report-failure-summary"]}
      role="alert"
      aria-labelledby={failureSummaryTitleId}
      data-testid="report-failure-summary"
    >
      <SvgIcon id={allureIcons.solidAlertCircle} size="m" className={styles["report-failure-summary-icon"]} />
      <div className={styles["report-failure-summary-body"]}>
        <Heading id={failureSummaryTitleId} tag="h3" size="s" className={styles["report-failure-summary-title"]}>
          {t("failureSummary.title")}
        </Heading>
        <ul className={styles["report-failure-summary-items"]}>
          {items.map(({ count, label, testId }) => (
            <li key={testId} className={styles["report-failure-summary-item"]} data-testid={testId}>
              <Counter count={count} status={count > 0 ? "failed" : undefined} />
              <Text type="ui" size="s">
                {label}
              </Text>
            </li>
          ))}
        </ul>
        {summary.hasExitCodeOnlyFailure && (
          <Text type="paragraph" size="s" className={styles["report-failure-summary-exit-code"]}>
            {t("failureSummary.exitCode", { code: summary.effectiveExitCode })}
          </Text>
        )}
      </div>
    </section>
  );
};
