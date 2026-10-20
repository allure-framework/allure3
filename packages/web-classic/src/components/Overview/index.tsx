import { themeStore } from "@allurereport/web-commons";
import { ChartWidget } from "@allurereport/web-components/ChartWidget";
import { Loadable, PageLoader, ThemeProvider } from "@allurereport/web-components/core";
import { Grid, GridItem } from "@allurereport/web-components/Grid";
import { computed } from "@preact/signals";
import { useEffect } from "preact/hooks";

import { useI18n } from "@/stores";
import { chartsStore, fetchChartsData } from "@/stores/charts";

import * as styles from "./Overview.module.scss";

const currentTheme = computed(() => themeStore.value.current);

const Overview = () => {
  const { t } = useI18n("charts");
  const { t: empty } = useI18n("empty");

  useEffect(() => {
    fetchChartsData();
  }, []);

  return (
    <ThemeProvider theme={currentTheme.value}>
      <Loadable
        source={chartsStore}
        renderLoader={() => <PageLoader />}
        renderData={(data) => {
          const charts = Object.entries(data.trends).map(([chartId, value]) => {
            return (
              <GridItem key={chartId} className={styles["overview-grid-item"]}>
                <ChartWidget chartData={value} t={t} empty={empty} />
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
