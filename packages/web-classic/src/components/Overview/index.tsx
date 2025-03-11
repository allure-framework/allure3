/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Loadable, PageLoader, Grid, GridItem, SuccessRatePieChart } from "@allurereport/web-components";
import { Widget } from "./components/Widget";
import { TrendChartWidget } from "./components/TrendChartWidget";
import * as styles from "./Overview.module.scss";
import { useEffect } from "preact/hooks";
import { chartsStore, fetchChartsData } from "@/stores/charts";

const Overview = () => {
  useEffect(() => {
    fetchChartsData();
  }, []);

  return (
    <Loadable
      source={chartsStore}
      renderLoader={() => <PageLoader />}
      renderData={({ pie, trends }) => {
        const TrendChartGridItems = Object.entries(trends.charts).map(([key, value]) => (
          <GridItem key={key} style={{ padding: "12px", width: "100%" }}>
            <TrendChartWidget
              title={`Test ${key.charAt(0).toUpperCase() + key.slice(1)} Trend`}
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
                    <Widget title="Test Success Rate">
                      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%", height: "100%" }}>
                        <div style={{ width: "50%" }}>
                          <SuccessRatePieChart
                            slices={pie.slices}
                            percentage={pie.percentage}
                          />
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
