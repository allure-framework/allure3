import { getReportOptions, themeStore } from "@allurereport/web-commons";
import { ThemeProvider } from "@allurereport/web-components/core";
import { computed } from "@preact/signals";
import { useEffect } from "preact/hooks";

import { useI18n } from "@/stores";
import { fetchChartsData } from "@/stores/charts";
import { fetchEnvironmentData } from "@/stores/environment";
import { behaviorsTree, categoriesTree, suitesTree } from "@/stores/tree";

import type { ReportOptions } from "../../../types.js";
import { EnvironmentWidget } from "./widgets/EnvironmentWidget";
import { ExecutorsWidget } from "./widgets/ExecutorsWidget";
import { SummaryWidget } from "./widgets/SummaryWidget";
import { TreeWidget } from "./widgets/TreeWidget";
import { TrendWidget } from "./widgets/TrendWidget";

import * as styles from "./Overview.module.scss";

const currentTheme = computed(() => themeStore.value.current);

/**
 * The Allure 2 dashboard: the summary, suites and environment in the left column,
 * the trend, categories, features and executors in the right one
 */
const Overview = () => {
  const { t } = useI18n("overview");
  const reportOptions = getReportOptions<ReportOptions>();

  useEffect(() => {
    fetchChartsData();
    suitesTree.fetchData();
    behaviorsTree.fetchData();
    categoriesTree.fetchData();
    fetchEnvironmentData();
  }, []);

  return (
    <ThemeProvider theme={currentTheme.value}>
      <div className={styles.overview} data-testid="overview">
        <div className={styles["overview-columns"]}>
          <div className={styles["overview-column"]}>
            <SummaryWidget reportOptions={reportOptions} />
            <TreeWidget title={t("suites")} source={suitesTree.data} tabName="suites" testId="overview-suites" />
            <EnvironmentWidget />
          </div>
          <div className={styles["overview-column"]}>
            <TrendWidget />
            <TreeWidget
              title={t("categories")}
              source={categoriesTree.data}
              tabName="categories"
              testId="overview-categories"
            />
            <TreeWidget
              title={t("features")}
              source={behaviorsTree.data}
              tabName="behaviors"
              testId="overview-features"
            />
            <ExecutorsWidget executor={reportOptions?.executor} />
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default Overview;
