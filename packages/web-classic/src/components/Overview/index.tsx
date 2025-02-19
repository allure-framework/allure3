import { Loadable, PageLoader, Grid, TrendChart, GridItem } from "@allurereport/web-components";
import { treeStore } from "@/stores/tree";
import { Widget } from "./components/Widget";
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
            <Grid kind="swap">
                  <GridItem style={{ padding: "12px", width: "100%" }}>
                    <Widget title="Test Results Trend">
                      <TrendChart
                        data={trendData.data}
                        rootArialLabel="Test Results Trend"
                        height={400}
                        width="100%"
                        colors={({ color }) => color}
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
