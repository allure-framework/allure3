import { themeStore } from "@allurereport/web-commons";
import { ChartWidget } from "@allurereport/web-components/ChartWidget";
import { Loadable, PageLoader, ThemeProvider } from "@allurereport/web-components/core";
import { Grid, GridItem } from "@allurereport/web-components/Grid";
import { computed } from "@preact/signals";
import { useEffect } from "preact/hooks";

import { dashboardStore, fetchDashboardData } from "@/stores/dashboard";
import { currentEnvironment, fetchEnvironments } from "@/stores/env";
import { useI18n } from "@/stores/locale";

import * as styles from "./styles.scss";

const currentTheme = computed(() => themeStore.value.current);

export const Dashboard = () => {
  const { t } = useI18n("charts");
  const { t: empty } = useI18n("empty");

  useEffect(() => {
    fetchDashboardData();
    fetchEnvironments();
  }, []);

  return (
    <ThemeProvider theme={currentTheme.value}>
      <Loadable
        source={dashboardStore}
        renderLoader={() => (
          <div className={styles.loader}>
            <PageLoader />
          </div>
        )}
        renderData={(data) => {
          const currentChartsData = currentEnvironment.value ? data.byEnv[currentEnvironment.value] : data.general;

          const charts = Object.entries(currentChartsData).map(([chartId, value]) => {
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
