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
        return (
          <div className={styles.overview}>
            <Grid kind="swap" className={styles.overview__grid}>
                  <GridItem style={{ padding: "12px", width: "100%" }}>
                    <TrendChartWidget data={trendData.data} />
                  </GridItem>
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
