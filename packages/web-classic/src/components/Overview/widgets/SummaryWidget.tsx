import type { ReportOptions } from "@allurereport/plugin-api";
import { Heading, Loadable, Text, Widget } from "@allurereport/web-components/core";
import { SuccessRatePieChart } from "@allurereport/web-components/SuccessRatePieChart";

import { pieChartStore } from "@/stores/chart";
import { useI18n } from "@/stores/locale";
import { statsStore } from "@/stores/stats";

import { CiInfo } from "./CiInfo";

import * as styles from "../Overview.module.scss";

export const SummaryWidget = ({ reportOptions }: { reportOptions?: ReportOptions }) => {
  const { t } = useI18n("overview");
  const { t: charts } = useI18n("charts");
  const { t: status } = useI18n("statuses");
  const { reportName, runSummary } = reportOptions ?? {};
  const total = statsStore.value.data?.total ?? 0;

  return (
    <div className={styles["overview-widget"]} data-testid="overview-summary">
      <Widget title={t("summary")}>
        <div className={styles["overview-summary"]}>
          <div className={styles["overview-summary-info"]}>
            {reportName && (
              <Heading size="s" tag="h2" className={styles["overview-summary-name"]}>
                {reportName}
              </Heading>
            )}
            {runSummary && (
              <Text type="ui" size="m" className={styles["overview-secondary"]} data-testid="overview-summary-dates">
                {t("dates", { start: runSummary.start, stop: runSummary.stop })}
              </Text>
            )}
            {runSummary && (
              <Text type="ui" size="m" className={styles["overview-secondary"]} data-testid="overview-summary-duration">
                {t("duration", { duration: runSummary.duration })}
              </Text>
            )}
            <Text type="ui" size="m" bold data-testid="overview-summary-total">
              {t("testCases", { count: total })}
            </Text>
            <CiInfo reportOptions={reportOptions} />
          </div>
          <div className={styles["overview-summary-pie"]}>
            <Loadable
              source={pieChartStore}
              renderError={() => null}
              renderData={(chartData) =>
                chartData ? (
                  <SuccessRatePieChart
                    {...chartData}
                    i18n={(key, values) => {
                      if (key.startsWith("status.")) {
                        return status(key.slice(7));
                      }

                      // Classic counts the rate over all tests, so skipped or unknown ones never leave it undefined
                      if (key === "successRateDescription" || key === "noEligibleResults") {
                        return t("successRateDescription");
                      }

                      return charts(`successRate.${key}`, values);
                    }}
                  />
                ) : null
              }
            />
          </div>
        </div>
      </Widget>
    </div>
  );
};
