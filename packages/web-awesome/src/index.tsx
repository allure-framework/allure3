import { ensureReportDataReady } from "@allurereport/web-commons";
import { Spinner, SvgIcon, allureIcons } from "@allurereport/web-components";
import "@allurereport/web-components/index.css";
import { computed, useSignalEffect } from "@preact/signals";
import clsx from "clsx";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import "@/assets/scss/index.scss";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ModalComponent } from "@/components/Modal";
import { SectionSwitcher } from "@/components/SectionSwitcher";
import { fetchEnvStats, fetchReportStats, getLocale, waitForI18next } from "@/stores";
import { fetchPieChartData } from "@/stores/chart";
import { currentEnvironment, environmentsStore, fetchEnvironments } from "@/stores/env";
import { fetchEnvInfo } from "@/stores/envInfo";
import { fetchGlobals } from "@/stores/globals";
import { isLayoutLoading, layoutStore } from "@/stores/layout";
import { fetchTestResult, fetchTestResultNav } from "@/stores/testResults";
import { fetchEnvTreesData } from "@/stores/tree";
import { isMac } from "@/utils/isMac";
import { fetchQualityGateResults } from "./stores/qualityGate";
import { testResultRoute } from "./stores/router";
import { currentSection } from "./stores/sections";
import { currentTrId } from "./stores/testResult";
import { fetchTreeFiltersData } from "./stores/treeFilters/actions";
import { migrateFilterParam } from "./stores/treeFilters/utils";
import * as styles from "./styles.scss";

const Loader = () => {
  return (
    <div className={clsx(styles.loader, isLayoutLoading.value ? styles.loading : "")} data-testid="loader">
      <SvgIcon id={allureIcons.reportLogo} size={"m"} />
      <Spinner />
    </div>
  );
};

const isTestResultRoute = computed(() => testResultRoute.value.matches);

const App = () => {
  const className = styles[`layout-${currentSection.value !== "default" ? currentSection.value : layoutStore.value}`];
  const [prefetched, setPrefetched] = useState(false);

  const prefetchData = async () => {
    const fns = [
      ensureReportDataReady,
      fetchReportStats,
      fetchPieChartData,
      fetchEnvironments,
      fetchEnvInfo,
      fetchGlobals,
      fetchQualityGateResults,
    ];

    if (globalThis) {
      fns.unshift(getLocale);
    }

    await waitForI18next;
    await Promise.all(fns.map((fn) => fn(currentEnvironment.value)));

    if (currentEnvironment.value) {
      await fetchEnvTreesData([currentEnvironment.value]);
      await fetchEnvStats(environmentsStore.value.data);
    } else {
      await fetchEnvTreesData(environmentsStore.value.data);
      await fetchEnvStats(environmentsStore.value.data);
    }

    setPrefetched(true);
  };

  useEffect(() => {
    prefetchData();
  }, [currentEnvironment.value]);

  useSignalEffect(() => {
    const testResultId = currentTrId.value;
    if (isTestResultRoute.value && testResultId) {
      fetchTestResult(testResultId);
      fetchTestResultNav(currentEnvironment.value);
    }
  });

  useEffect(() => {
    fetchTreeFiltersData();
  }, []);

  return (
    <>
      {!prefetched && <Loader />}
      {prefetched && (
        <div className={styles.main}>
          <Header className={className} />
          <SectionSwitcher />
          <Footer className={className} />
          <ModalComponent />
        </div>
      )}
    </>
  );
};

const rootElement = document.getElementById("app");

document.addEventListener("DOMContentLoaded", () => {
  if (isMac) {
    document.documentElement.setAttribute("data-os", "mac");
  }
});

migrateFilterParam();

render(<App />, rootElement);
