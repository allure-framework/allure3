/* eslint-disable @stylistic/quotes */

/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { ChartType } from "@allurereport/core-api";
import type { UIChartData } from "@allurereport/web-commons";
import {
  ComingSoonChartWidget,
  Grid,
  GridItem,
  Loadable,
  PageLoader,
  SuccessRatePieChart,
  TrendChartWidget,
  Widget,
} from "@allurereport/web-components";
import { useEffect } from "preact/hooks";
import { useI18n } from "@/stores";
import { chartsStore, fetchChartsData } from "@/stores/charts";
import { capitalize } from "@/utils/capitalize";
import * as styles from "./Overview.module.scss";

const getChartWidgetByType = (
  chartData: UIChartData,
  { t, empty }: Record<string, (key: string, options?: any) => string>,
) => {
  switch (chartData.type) {
    case ChartType.Trend: {
      const type = t(`trend.type.${chartData.dataType}`);
      const title = chartData.title ?? t("trend.title", { type: capitalize(type) });
      const translations = empty("no-results");

      return (
        <TrendChartWidget
          title={title}
          mode={chartData.mode}
          items={chartData.items}
          slices={chartData.slices}
          min={chartData.min}
          max={chartData.max}
          translations={{ "no-results": translations }}
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
    case ChartType.HeatMap:
    case ChartType.Bar:
    case ChartType.Funnel:
    case ChartType.TreeMap: {
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
