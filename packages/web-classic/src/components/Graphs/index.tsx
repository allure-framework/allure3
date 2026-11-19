import { themeStore } from "@allurereport/web-commons";
import { ChartWidget } from "@allurereport/web-components/ChartWidget";
import { Loadable, PageLoader, ThemeProvider } from "@allurereport/web-components/core";
import { Grid, GridItem } from "@allurereport/web-components/Grid";
import { computed } from "@preact/signals";
import { useEffect } from "preact/hooks";

import { useI18n } from "@/stores";
import { fetchTrendData, trendStore } from "@/stores/trend";

import * as styles from "./styles.scss";

const currentTheme = computed(() => themeStore.value.current);

const Graphs = () => {
  const { t } = useI18n("charts");
  const { t: empty } = useI18n("empty");

  useEffect(() => {
    fetchTrendData();
  }, []);

  return (
    <ThemeProvider theme={currentTheme.value}>
      <Loadable
        source={trendStore}
        renderLoader={() => <PageLoader />}
        renderData={(data) => (
          <div className={styles.graphs} data-testid="graphs">
            <Grid kind="swap" className={styles["graphs-grid"]}>
              {Object.entries(data ?? {}).map(([chartId, value]) => (
                <GridItem key={chartId} className={styles["graphs-grid-item"]}>
                  <ChartWidget chartData={value} t={t} empty={empty} />
                </GridItem>
              ))}
            </Grid>
          </div>
        )}
      />
    </ThemeProvider>
  );
};

export default Graphs;
