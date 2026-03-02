import { formatDuration } from "@allurereport/core-api";
import { ChartType } from "@allurereport/charts-api";
import type { UIChartData } from "@allurereport/web-commons";
import { themeStore } from "@allurereport/web-commons";
import {
  CurrentStatusChartWidget,
  Grid,
  GridItem,
  HeatMapWidget,
  Loadable,
  PageLoader,
  Text,
  ThemeProvider,
  TreeMapChartWidget,
} from "@allurereport/web-components";
import { computed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { useI18n } from "@/stores";
import { chartsStore, fetchChartsData } from "@/stores/charts";
import type { SummaryData } from "@/stores/summary";
import * as styles from "../Overview/Overview.module.scss";

function isStatistic(v: unknown): v is { total?: number; passed?: number; failed?: number; broken?: number; skipped?: number; unknown?: number } {
  return typeof v === "object" && v !== null && "total" in v && !("type" in v);
}

function isSummary(v: unknown): v is SummaryData {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !("type" in v);
}

const getChartWidgetByType = (
  chartData: UIChartData,
  { t, empty }: Record<string, (key: string, options?: any) => string>,
) => {
  const i18n = (key: string, opts?: Record<string, string | number>) => (t(key, opts) ?? key);
  switch (chartData.type) {
    case ChartType.CurrentStatus:
      return (
        <CurrentStatusChartWidget
          title={chartData.title}
          data={chartData.data}
          statuses={chartData.statuses}
          metric={chartData.metric}
          i18n={i18n}
        />
      );
    case ChartType.CoverageDiff:
      return (
        <TreeMapChartWidget
          chartType={ChartType.CoverageDiff}
          data={chartData.treeMap}
          title={chartData.title}
          formatLegend={chartData.formatLegend}
          colors={chartData.colors}
          legendDomain={chartData.legendDomain}
          tooltipRows={chartData.tooltipRows}
          translations={{ "no-results": empty("no-results") }}
        />
      );
    case ChartType.SuccessRateDistribution:
      return (
        <TreeMapChartWidget
          chartType={ChartType.SuccessRateDistribution}
          data={chartData.treeMap}
          title={chartData.title}
          formatLegend={chartData.formatLegend}
          colors={chartData.colors}
          legendDomain={chartData.legendDomain}
          tooltipRows={chartData.tooltipRows}
          translations={{ "no-results": empty("no-results") }}
        />
      );
    case ChartType.ProblemsDistribution:
      return (
        <HeatMapWidget
          title={chartData.title}
          data={chartData.data}
          translations={{ "no-results": empty("no-results") }}
        />
      );
    default:
      return null;
  }
};

const currentTheme = computed(() => themeStore.value.current);

const Graphs = () => {
  const { t } = useI18n("charts");
  const { t: empty } = useI18n("empty");

  useEffect(() => {
    fetchChartsData();
  }, []);

  return (
    <ThemeProvider theme={currentTheme.value}>
      <Loadable
        source={chartsStore}
        renderLoader={() => <PageLoader />}
        renderData={(data) => {
          const summary = isSummary(data?.summary) ? data.summary : undefined;
          const chartItems: Array<{ id: string; chart: UIChartData }> = [];
          if (!data) return <div className={styles.overview} />;
          for (const [key, value] of Object.entries(data)) {
            if (key === "summary") continue;
            if (key === "pie" && isStatistic(value)) {
              chartItems.push({ id: "current-status", chart: { type: ChartType.CurrentStatus, data: value, title: "" } });
            } else if (key === "trends" && typeof value === "object" && value !== null && !Array.isArray(value)) {
              for (const [chartId, chart] of Object.entries(value as Record<string, UIChartData>)) {
                if (chart && typeof chart === "object" && "type" in chart) {
                  chartItems.push({ id: chartId, chart: chart as UIChartData });
                }
              }
            } else if (value && typeof value === "object" && "type" in value) {
              chartItems.push({ id: key, chart: value as UIChartData });
            }
          }
          const summaryCards = [];
          if (summary) {
            if (typeof summary.duration === "number" && summary.duration >= 0) {
              summaryCards.push(
                <GridItem key="summary-duration" className={styles["overview-grid-item"]}>
                  <div className={styles["overview-summary-card"]}>
                    <Text tag="div" type="ui" size="s" className={styles["overview-summary-label"]}>{t("totalDuration")}</Text>
                    <Text tag="div" size="l" bold className={styles["overview-summary-value"]}>{formatDuration(summary.duration)}</Text>
                  </div>
                </GridItem>
              );
            }
            if (typeof summary.flakyCount === "number") {
              summaryCards.push(
                <GridItem key="summary-flaky" className={styles["overview-grid-item"]}>
                  <div className={styles["overview-summary-card"]}>
                    <Text tag="div" type="ui" size="s" className={styles["overview-summary-label"]}>{t("flakyCount")}</Text>
                    <Text tag="div" size="l" bold className={styles["overview-summary-value"]}>{String(summary.flakyCount)}</Text>
                  </div>
                </GridItem>
              );
            }
            if (typeof summary.retriesCount === "number") {
              summaryCards.push(
                <GridItem key="summary-retries" className={styles["overview-grid-item"]}>
                  <div className={styles["overview-summary-card"]}>
                    <Text tag="div" type="ui" size="s" className={styles["overview-summary-label"]}>{t("retriesCount")}</Text>
                    <Text tag="div" size="l" bold className={styles["overview-summary-value"]}>{String(summary.retriesCount)}</Text>
                  </div>
                </GridItem>
              );
            }
          }
          const charts = chartItems.map(({ id, chart }) => (
            <GridItem key={id} className={styles["overview-grid-item"]}>
              {getChartWidgetByType(chart, { t, empty })}
            </GridItem>
          ));
          return (
            <div className={styles.overview}>
              <Grid kind="swap" className={styles["overview-grid"]}>
                {summaryCards}
                {charts}
              </Grid>
            </div>
          );
        }}
      />
    </ThemeProvider>
  );
};

export default Graphs;
