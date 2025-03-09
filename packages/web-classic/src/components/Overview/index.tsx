/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Loadable, PageLoader, Grid, GridItem } from "@allurereport/web-components";
import { Widget } from "./components/Widget";
import { TrendChartWidget } from "./components/TrendChartWidget";
import * as styles from "./Overview.module.scss";
import { useEffect } from "preact/hooks";
import { trendStore, fetchTrendData } from "@/stores/trend";

const Overview = () => {
  useEffect(() => {
    fetchTrendData();
  }, []);

  return (
    <Loadable
      source={trendStore}
      renderLoader={() => <PageLoader />}
      renderData={(trendData) => {
        // eslint-disable-next-line no-console
        console.log("TREND DATA", trendData);

        const TrendChartGridItems = Object.entries(trendData.charts).map(([key, value]) => (
          <GridItem key={key} style={{ padding: "12px", width: "100%" }}>
            <TrendChartWidget
              title={`${key.charAt(0).toUpperCase() + key.slice(1)} Trend`}
              items={value.items}
              slices={value.slices}
              min={value.min}
              max={value.max}
            />
          </GridItem>
        ));

        return (
          <div className={styles.overview}>
            <Grid kind="swap" className={styles.overview__grid}>
                  {TrendChartGridItems}
                  <GridItem style={{ padding: "12px", width: "100%" }}>
                    <Widget title="Test Results Trend">
                      PIE_CHART_PLACEHOLDER
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
