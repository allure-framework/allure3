/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { BarChartType, ChartType, FunnelChartType } from "@allurereport/charts-api";
import { capitalize } from "@allurereport/core-api";
import { type UIChartData } from "@allurereport/web-commons";
import {
  BarChartWidget,
  ComingSoonChartWidget,
  CurrentStatusChartWidget,
  Grid,
  GridItem,
  HeatMapWidget,
  Loadable,
  PageLoader,
  StabilityRateDistributionWidget,
  StatusDynamicsChartWidget,
  TestingPyramidWidget,
  TreeMapChartWidget,
  TrendChartWidget,
} from "@allurereport/web-components";
import { useEffect } from "preact/hooks";
import { dashboardStore, fetchDashboardData } from "@/stores/dashboard";
import { currentEnvironment, fetchEnvironments } from "@/stores/env";
import { useI18n } from "@/stores/locale";
import * as styles from "./styles.scss";

const getChartWidgetByType = (
  chartData: UIChartData,
  { t, empty }: Record<string, (key: string, options?: any) => string>,
) => {
  switch (chartData.type) {
    case ChartType.Trend: {
      const type = t(`trend.type.${chartData.dataType}`);
      const title = chartData.title ?? t("trend.title", { type: capitalize(type) });

      return (
        <TrendChartWidget
          title={title}
          mode={chartData.mode}
          items={chartData.items}
          slices={chartData.slices}
          min={chartData.min}
          max={chartData.max}
          translations={{ "no-results": empty("no-results") }}
        />
      );
    }
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
    case ChartType.Bar: {
      const type = t(`bar.type.${chartData.dataType}`);
      const title = chartData.title ?? t("bar.title", { type: capitalize(type) });

      if (chartData.dataType === BarChartType.StabilityRateDistribution) {
        return (
          <StabilityRateDistributionWidget
            title={title}
            mode={chartData.mode}
            data={chartData.data}
            keys={chartData.keys}
            indexBy={chartData.indexBy}
            colors={chartData.colors}
            groupMode={chartData.groupMode}
            xAxisConfig={chartData.xAxisConfig}
            yAxisConfig={chartData.yAxisConfig}
            layout={chartData.layout}
            threshold={chartData.threshold}
            translations={{ "no-results": empty("no-results") }}
          />
        );
      }

      return (
        <BarChartWidget
          title={title}
          mode={chartData.mode}
          data={chartData.data}
          keys={chartData.keys}
          indexBy={chartData.indexBy}
          colors={chartData.colors}
          groupMode={chartData.groupMode}
          xAxisConfig={chartData.xAxisConfig}
          yAxisConfig={chartData.yAxisConfig}
          translations={{ "no-results": empty("no-results") }}
        />
      );
    }
    case ChartType.TreeMap: {
      return (
        <TreeMapChartWidget
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
    case ChartType.HeatMap: {
      return (
        <HeatMapWidget
          title={chartData.title}
          data={chartData.data}
          colors={chartData.colors}
          translations={{ "no-results": empty("no-results") }}
        />
      );
    }
    case ChartType.Funnel: {
      if (chartData.dataType !== FunnelChartType.TestingPyramid) {
        return null;
      }

      return (
        <TestingPyramidWidget
          title={chartData.title}
          data={chartData.data}
          translations={{ "no-results": empty("no-results") }}
        />
      );
    }
    default: {
      const title = chartData.title ?? t(`charts.${chartData.type}.title`, { fallback: `${chartData.type} Chart` });

      return <ComingSoonChartWidget title={title} />;
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
  );
};
