/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Loadable, PageLoader, Grid, TrendChart, GridItem, defaultAxisBottomConfig } from "@allurereport/web-components";
import { Widget } from "./components/Widget";
import { TrendChartWidget } from "./components/TrendChartWidget";
import * as styles from "./Overview.module.scss";
import { useEffect } from "preact/hooks";
import { trendStore, fetchTrendData } from "@/stores/trend";
import type { ScaleSymlogSpec } from "@nivo/scales";

const Y_SCALE_CONSTANT = 8;

const Overview = () => {
  useEffect(() => {
    fetchTrendData();
  }, []);

  return (
    <Loadable
      source={trendStore}
      renderLoader={() => <PageLoader />}
      renderData={(trendData) => {
        const { min: min2, max: max2 } = trendData.data.flatMap(series => series.data).reduce<{min: number; max: number}>((acc, point) => ({
          min: Math.min(acc.min, point.y),
          max: Math.max(acc.max, point.y),
        }), { min: Infinity, max: -Infinity });

        const yScaleConfig2: ScaleSymlogSpec = {
          type: "symlog",
          constant: Y_SCALE_CONSTANT*8,
          min: min2,
          max: max2,
        };

        return (
          <div className={styles.overview}>
            <Grid kind="swap" className={styles.overview__grid}>
                  <GridItem style={{ padding: "12px", width: "100%" }}>
                    <TrendChartWidget data={trendData.data} />
                  </GridItem>
                  <GridItem style={{ padding: "12px", width: "100%" }}>
                    <Widget title="Test Results Trend">
                      <TrendChart
                        data={trendData.data}
                        rootArialLabel="Test Results Trend"
                        height={400}
                        width="100%"
                        colors={({ color }) => color}
                        yScale={yScaleConfig2}
                        axisBottom={{
                          ...defaultAxisBottomConfig,
                          truncateTickAt: 16,
                        }}
                      />
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
