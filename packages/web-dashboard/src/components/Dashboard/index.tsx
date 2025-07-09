/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { ChartType, capitalize } from "@allurereport/web-commons";
import {
  Grid,
  GridItem,
  Loadable,
  PageLoader,
  SuccessRatePieChart,
  TrendChartWidget,
  Widget,
} from "@allurereport/web-components";
import { useEffect } from "preact/hooks";
import { type ChartData, dashboardStore, fetchDashboardData } from "@/stores/dashboard";
import { useI18n } from "@/stores/locale";
import * as styles from "./styles.scss";

const getChartWidgetByType = (
  chartData: ChartData,
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
  }
};

export const Dashboard = () => {
  const { t } = useI18n("charts");
  const { t: empty } = useI18n("empty");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <Loadable
      source={dashboardStore}
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
