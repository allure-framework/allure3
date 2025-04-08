/* eslint-disable @stylistic/quotes */

/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Grid, GridItem, Loadable, PageLoader, SuccessRatePieChart } from "@allurereport/web-components";
import { useEffect } from "preact/hooks";
import { useI18n } from "@/stores";
import { chartsStore, fetchChartsData } from "@/stores/charts";
import { capitalize } from "@/utils/capitalize";
import * as styles from "./Overview.module.scss";
import { TrendChartWidget } from "./components/TrendChartWidget";
import { Widget } from "./components/Widget";

const Overview = () => {
  const { t } = useI18n("charts");

  useEffect(() => {
    fetchChartsData();
  }, []);

  return (
    <Loadable
      source={chartsStore}
      renderLoader={() => <PageLoader />}
      renderData={({ pie, trends }) => {
        const pieTitle = t("pie.title");

        const TrendChartGridItems = Object.entries(trends.charts).map(([chartId, value]) => {
          const title = value.title ?? t("trend.title", { type: capitalize(value.type) });

          return (
            <GridItem key={chartId} className={styles["overview-grid-item"]}>
              <TrendChartWidget
                title={title}
                items={value.items}
                slices={value.slices}
                min={value.min}
                max={value.max}
                rootAriaLabel={title}
              />
            </GridItem>
          );
        });

        return (
          <div className={styles.overview}>
            <Grid kind="swap" className={styles["overview-grid"]}>
              {TrendChartGridItems}
              <GridItem className={styles["overview-grid-item"]}>
                <Widget title={pieTitle}>
                  <div className={styles["overview-grid-item-pie-chart-wrapper"]}>
                    <div className={styles["overview-grid-item-pie-chart-wrapper-squeezer"]}>
                      <SuccessRatePieChart slices={pie.slices} percentage={pie.percentage} />
                    </div>
                  </div>
                </Widget>
              </GridItem>
            </Grid>
          </div>
        );
      }}
    />
  );
};

export default Overview;
