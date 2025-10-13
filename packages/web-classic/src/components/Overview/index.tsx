/* eslint-disable @stylistic/quotes */

/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { ChartType, capitalize } from "@allurereport/core-api";
import type { UIChartData } from "@allurereport/web-commons";
import {
  BarChartWidget,
  ComingSoonChartWidget,
  Grid,
  GridItem,
  HeatMapWidget,
  Loadable,
  PageLoader,
  SuccessRatePieChart,
  TreeMapChartWidget,
  TrendChartWidget,
  Widget,
} from "@allurereport/web-components";
import { useEffect } from "preact/hooks";
import { useI18n } from "@/stores";
import { chartsStore, fetchChartsData } from "@/stores/charts";
import * as styles from "./Overview.module.scss";

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
    case ChartType.Pie: {
      const title = chartData.title ?? t("pie.title");

      return (
        <Widget title={title}>
          <div className={styles["overview-grid-item-pie-chart-wrapper"]}>
            <div className={styles["overview-grid-item-pie-chart-wrapper-squeezer"]}>
              <SuccessRatePieChart slices={chartData.slices} percentage={chartData.percentage} />
            </div>
          </div>
        </Widget>
      );
    }
    case ChartType.Bar: {
      const type = t(`bar.type.${chartData.dataType}`);
      const title = chartData.title ?? t("bar.title", { type: capitalize(type) });

      return (
        <BarChartWidget
          title={title}
          mode={chartData.mode}
          data={chartData.data}
          keys={chartData.keys}
          indexBy={chartData.indexBy}
          colors={chartData.colors}
          groupMode={chartData.groupMode}
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
    default: {
      const title = chartData.title ?? t(`charts.${chartData.type}.title`, { fallback: `${chartData.type} Chart` });

      return <ComingSoonChartWidget title={title} />;
    }
  }
};

const Overview = () => {
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
        const charts = Object.entries(data).map(([chartId, value]) => {
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

export default Overview;
