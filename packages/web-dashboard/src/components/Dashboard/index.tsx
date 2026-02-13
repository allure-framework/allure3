/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { ChartType } from "@allurereport/charts-api";
import { type UIChartData, themeStore } from "@allurereport/web-commons";
import {
  CurrentStatusChartWidget,
  DurationDynamicsChartWidget,
  DurationsChartWidget,
  Grid,
  GridItem,
  HeatMapWidget,
  Loadable,
  PageLoader,
  StabilityDistributionWidget,
  StatusAgePyramidChartWidget,
  StatusDynamicsChartWidget,
  StatusTransitionsChartWidget,
  TestBaseGrowthDynamicsChartWidget,
  TestingPyramidWidget,
  ThemeProvider,
  TrSeveritiesChartWidget,
  TreeMapChartWidget,
} from "@allurereport/web-components";
import { computed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { dashboardStore, fetchDashboardData } from "@/stores/dashboard";
import { currentEnvironment, fetchEnvironments } from "@/stores/env";
import { useI18n } from "@/stores/locale";
import * as styles from "./styles.scss";

const currentTheme = computed(() => themeStore.value.current);

const getChartWidgetByType = (
  chartData: UIChartData,
  { t, empty }: Record<string, (key: string, options?: any) => string>,
) => {
  switch (chartData.type) {
    case ChartType.CurrentStatus: {
      const title = chartData.title ?? t("currentStatus.title");

      return (
        <CurrentStatusChartWidget
          title={title}
          data={chartData.data}
          statuses={chartData.statuses}
          metric={chartData.metric}
          i18n={(key, props = {}) => t(`currentStatus.${key}`, props)}
        />
      );
    }
    case ChartType.StatusDynamics: {
      const title = chartData.title ?? t("statusDynamics.title");

      return (
        <StatusDynamicsChartWidget
          title={title}
          data={chartData.data}
          limit={chartData.limit}
          statuses={chartData.statuses}
          i18n={(key, props = {}) => t(`statusDynamics.${key}`, props)}
        />
      );
    }
    case ChartType.StatusTransitions: {
      const title = chartData.title ?? t("statusTransitions.title");

      return (
        <StatusTransitionsChartWidget
          title={title}
          data={chartData.data}
          i18n={(key, props = {}) => t(`statusTransitions.${key}`, props)}
        />
      );
    }
    case ChartType.Durations: {
      const title =
        chartData.title ??
        (chartData.groupBy === "none"
          ? t("durations.title_none")
          : t("durations.title", { groupBy: chartData.groupBy }));

      return (
        <DurationsChartWidget
          title={title}
          data={chartData.data}
          groupBy={chartData.groupBy}
          keys={chartData.keys}
          i18n={(key, props = {}) => t(`durations.${key}`, props)}
        />
      );
    }
    case ChartType.StabilityDistribution: {
      const title = chartData.title ?? t("stabilityDistribution.title");

      return (
        <StabilityDistributionWidget
          title={title}
          data={chartData.data}
          keys={chartData.keys}
          i18n={(key, props = {}) => t(`stabilityDistribution.${key}`, props)}
        />
      );
    }
    case ChartType.TestBaseGrowthDynamics: {
      const title = chartData.title ?? t("testBaseGrowthDynamics.title");

      return (
        <TestBaseGrowthDynamicsChartWidget
          title={title}
          data={chartData.data}
          statuses={chartData.statuses}
          i18n={(key, props = {}) => t(`testBaseGrowthDynamics.${key}`, props)}
        />
      );
    }
    case ChartType.StatusAgePyramid: {
      const title = chartData.title ?? t("statusAgePyramid.title");

      return (
        <StatusAgePyramidChartWidget
          title={title}
          data={chartData.data}
          statuses={chartData.statuses}
          i18n={(key, props = {}) => t(`statusAgePyramid.${key}`, props)}
        />
      );
    }
    case ChartType.TrSeverities: {
      const title = chartData.title ?? t("trSeverities.title");

      return (
        <TrSeveritiesChartWidget
          title={title}
          data={chartData.data}
          levels={chartData.levels}
          statuses={chartData.statuses}
          i18n={(key, props = {}) => t(`trSeverities.${key}`, props)}
        />
      );
    }
    case ChartType.DurationDynamics: {
      const title = chartData.title ?? t("durationDynamics.title");

      return (
        <DurationDynamicsChartWidget
          title={title}
          data={chartData.data}
          i18n={(key, props = {}) => t(`durationDynamics.${key}`, props)}
        />
      );
    }
    case ChartType.CoverageDiff: {
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
    }

    case ChartType.SuccessRateDistribution: {
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
    }
    case ChartType.ProblemsDistribution: {
      return (
        <HeatMapWidget
          title={chartData.title}
          data={chartData.data}
          translations={{ "no-results": empty("no-results") }}
        />
      );
    }
    case ChartType.TestingPyramid: {
      const isDataEmpty = !chartData.data.some((item) => item.testCount > 0);

      return (
        <TestingPyramidWidget
          title={chartData.title}
          data={isDataEmpty ? [] : chartData.data}
          translations={{ "no-results": empty("no-results") }}
        />
      );
    }
    default: {
      return null;
    }
  }
};

export const Dashboard = () => {
  const { t } = useI18n("charts");
  const { t: empty } = useI18n("empty");

  useEffect(() => {
    fetchDashboardData();
    fetchEnvironments();
  }, []);

  return (
    <ThemeProvider theme={currentTheme.value}>
      <Loadable
        source={dashboardStore}
        renderLoader={() => <PageLoader />}
        renderData={(data) => {
          const currentChartsData = currentEnvironment.value ? data.byEnv[currentEnvironment.value] : data.general;

          const charts = Object.entries(currentChartsData).map(([chartId, value]) => {
            const chartWidget = getChartWidgetByType(value, { t, empty });
            return (
              <GridItem key={chartId} className={styles["overview-grid-item"]}>
                {chartWidget}
              </GridItem>
            );
          });

          return (
            <div className={styles.overview}>
              <Grid kind="swap" className={styles["overview-grid"]}>
                {charts}
              </Grid>
            </div>
          );
        }}
      />
    </ThemeProvider>
  );
};
