import { ReportFailureSummary as ReportFailureSummaryView } from "@allurereport/web-components/core";

import { reportStatsStore } from "@/stores";
import { globalsStore } from "@/stores/globals";
import { useI18n } from "@/stores/locale";
import { qualityGateStore } from "@/stores/qualityGate";

import { getReportFailureSummary } from "./model";

import * as styles from "./styles.scss";

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

  return (
    <ReportFailureSummaryView
      className={styles["report-failure-summary"]}
      title={t("failureSummary.title")}
      items={[
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
      ]}
    />
  );
};
