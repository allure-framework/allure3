/* eslint-disable @stylistic/quotes */

/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { ChartType } from "@allurereport/charts-api";
import type { UIChartData } from "@allurereport/web-commons";
import {
  Grid,
  GridItem,
  HeatMapWidget,
  Loadable,
  PageLoader,
  ThemeProvider,
  TreeMapChartWidget,
} from "@allurereport/web-components";
import { useEffect } from "preact/hooks";
import { themeStore, useI18n } from "@/stores";
import { chartsStore, fetchChartsData } from "@/stores/charts";
import * as styles from "./Overview.module.scss";

const getChartWidgetByType = (
  chartData: UIChartData,
  { t, empty }: Record<string, (key: string, options?: any) => string>,
) => {
  switch (chartData.type) {
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
    default: {
      return null;
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
    <ThemeProvider theme={themeStore.value}>
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
    </ThemeProvider>
  );
};

export default Overview;
