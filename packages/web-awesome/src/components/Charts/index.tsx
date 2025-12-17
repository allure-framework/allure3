/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { BarChartType, ChartDataType, ChartType, FunnelChartType } from "@allurereport/charts-api";
import { capitalize, statusesList } from "@allurereport/core-api";
import { type UIChartData } from "@allurereport/web-commons";
import {
  BarChartWidget,
  CurrentStatusChartWidget,
  DurationsChartWidget,
  FBSUAgePyramidChartWidget,
  Grid,
  GridItem,
  HeatMapWidget,
  Loadable,
  PageLoader,
  StabilityDistributionWidget,
  StatusDynamicsChartWidget,
  StatusTransitionsChartWidget,
  TestBaseGrowthDynamicsChartWidget,
  TestingPyramidWidget,
  TreeMapChartWidget,
  TrendChartWidget,
} from "@allurereport/web-components";
import { useEffect } from "preact/hooks";
import { chartsStore, fetchChartsData } from "@/stores/chart";
import { currentEnvironment } from "@/stores/env";
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
      let isDataEmpty = false;

      if (chartData.dataType === ChartDataType.Status) {
        isDataEmpty = !chartData.slices.some((slice) => slice.min > 0 || slice.max > 0);
      }

      return (
        <TrendChartWidget
          title={title}
          mode={chartData.mode}
          items={isDataEmpty ? [] : chartData.items}
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
    case ChartType.StatusTransitions: {
      const title = chartData.title ?? t("statusTransitions.title");

      return (
        <StatusTransitionsChartWidget
          title={title}
          data={chartData.data}
          lines={chartData.lines}
          linesSharpness={chartData.linesSharpness}
          hideEmptyLines={chartData.hideEmptyLines}
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
    case ChartType.FBSUAgePyramid: {
      const title = chartData.title ?? t("fbsuAgePyramid.title");

      return (
        <FBSUAgePyramidChartWidget
          title={title}
          data={chartData.data}
          statuses={chartData.statuses}
          i18n={(key, props = {}) => t(`fbsuAgePyramid.${key}`, props)}
        />
      );
    }
    case ChartType.Bar: {
      const type = t(`bar.type.${chartData.dataType}`);
      const title = chartData.title ?? t("bar.title", { type: capitalize(type) });
      /**
       * A flag that indicates whether the chart data should be considered empty.
       * For some chart types, simply checking the `data` array length is not sufficient,
       * because additional logic may be needed to assess the presence of meaningful data.
       * This flag ensures that specific conditions for data emptiness are handled per chart type.
       */
      let isDataEmpty = false;

      if (chartData.dataType === BarChartType.StatusBySeverity) {
        /*
         * Data for this chart type consists of statistics where each group contains
         * metrics such as passed, failed, broken, etc., represented as numbers.
         * To determine if the chart should be displayed, we need to check if any of these
         * metrics in any group is greater than 0. If at least one of the statistics is
         * greater than 0, we display the chart; otherwise, we consider the data empty.
         */
        isDataEmpty = !chartData.data.some(
          (item) => chartData.keys.includes(item.groupId) && statusesList.some((status) => (item[status] ?? 0) > 0),
        );
      }

      return (
        <BarChartWidget
          title={title}
          mode={chartData.mode}
          data={isDataEmpty ? [] : chartData.data}
          keys={chartData.keys}
          indexBy={chartData.indexBy}
          colors={chartData.colors}
          groupMode={chartData.groupMode}
          xAxisConfig={chartData.xAxisConfig}
          yAxisConfig={chartData.yAxisConfig}
          layout={chartData.layout}
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

export const Charts = () => {
  const { t } = useI18n("charts");
  const { t: empty } = useI18n("empty");

  useEffect(() => {
    fetchChartsData();
  }, []);

  return (
    <Loadable
      source={chartsStore}
      renderLoader={() => <PageLoader />}
      renderData={(data) => {
        const currentChartsData = currentEnvironment.value ? data.byEnv[currentEnvironment.value] : data.general;

        if (!currentChartsData) {
          return null;
        }

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
