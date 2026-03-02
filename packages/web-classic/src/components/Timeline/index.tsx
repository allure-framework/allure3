import { formatDuration } from "@allurereport/core-api";
import { ChartType } from "@allurereport/charts-api";
import type { UIChartData } from "@allurereport/web-commons";
import { themeStore } from "@allurereport/web-commons";
import {
  CurrentStatusChartWidget,
  Grid,
  GridItem,
  Loadable,
  PageLoader,
  Text,
  ThemeProvider,
} from "@allurereport/web-components";
import { computed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { useI18n } from "@/stores";
import { chartsStore, fetchChartsData } from "@/stores/charts";
import type { SummaryData } from "@/stores/summary";
import * as styles from "./styles.scss";
import * as overviewStyles from "../Overview/Overview.module.scss";

function isStatistic(v: unknown): v is { total?: number; passed?: number; failed?: number; broken?: number; skipped?: number; unknown?: number } {
  return typeof v === "object" && v !== null && "total" in v && !("type" in v);
}

function isSummary(v: unknown): v is SummaryData {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !("type" in v);
}

const currentTheme = computed(() => themeStore.value.current);

const Timeline = () => {
  const { t } = useI18n("charts");
  const { t: empty } = useI18n("empty");

  useEffect(() => {
    fetchChartsData();
  }, []);

  return (
    <ThemeProvider theme={currentTheme.value}>
      <div className={styles.timeline}>
        <Loadable
          source={chartsStore}
          renderLoader={() => <PageLoader />}
          renderData={(data) => {
            if (!data) return <div className={styles["timeline-empty"]} />;
            const summary = isSummary(data.summary) ? data.summary : undefined;
            const chartItems: Array<{ id: string; chart: UIChartData }> = [];
            if (data.pie && isStatistic(data.pie)) {
              chartItems.push({
                id: "current-status",
                chart: { type: ChartType.CurrentStatus, data: data.pie, title: "" },
              });
            }
            const summaryCards = [];
            if (summary) {
              if (typeof summary.duration === "number" && summary.duration >= 0) {
                summaryCards.push(
                  <GridItem key="duration" className={overviewStyles["overview-grid-item"]}>
                    <div className={overviewStyles["overview-summary-card"]}>
                      <Text tag="div" type="ui" size="s" className={overviewStyles["overview-summary-label"]}>{t("totalDuration")}</Text>
                      <Text tag="div" size="l" bold className={overviewStyles["overview-summary-value"]}>{formatDuration(summary.duration)}</Text>
                    </div>
                  </GridItem>
                );
              }
              if (typeof summary.flakyCount === "number") {
                summaryCards.push(
                  <GridItem key="flaky" className={overviewStyles["overview-grid-item"]}>
                    <div className={overviewStyles["overview-summary-card"]}>
                      <Text tag="div" type="ui" size="s" className={overviewStyles["overview-summary-label"]}>{t("flakyCount")}</Text>
                      <Text tag="div" size="l" bold className={overviewStyles["overview-summary-value"]}>{String(summary.flakyCount)}</Text>
                    </div>
                  </GridItem>
                );
              }
              if (typeof summary.retriesCount === "number") {
                summaryCards.push(
                  <GridItem key="retries" className={overviewStyles["overview-grid-item"]}>
                    <div className={overviewStyles["overview-summary-card"]}>
                      <Text tag="div" type="ui" size="s" className={overviewStyles["overview-summary-label"]}>{t("retriesCount")}</Text>
                      <Text tag="div" size="l" bold className={overviewStyles["overview-summary-value"]}>{String(summary.retriesCount)}</Text>
                    </div>
                  </GridItem>
                );
              }
            }
            const charts = chartItems.map(({ id, chart }) => (
              <GridItem key={id} className={overviewStyles["overview-grid-item"]}>
                <CurrentStatusChartWidget
                  title={chart.title}
                  data={chart.data}
                  statuses={chart.statuses}
                  metric={chart.metric}
                  i18n={(key: string, opts?: Record<string, string | number>) => t(key, opts) ?? key}
                />
              </GridItem>
            ));
            return (
              <Grid kind="swap" className={overviewStyles["overview-grid"]}>
                {summaryCards}
                {charts}
              </Grid>
            );
          }}
        />
      </div>
    </ThemeProvider>
  );
};

export default Timeline;
