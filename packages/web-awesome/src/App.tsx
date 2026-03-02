import { ensureReportDataReady } from "@allurereport/web-commons";
import { Spinner, SvgIcon, allureIcons } from "@allurereport/web-components";
import { computed, useSignalEffect } from "@preact/signals";
import clsx from "clsx";
import { useEffect, useState } from "preact/hooks";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ModalComponent } from "@/components/Modal";
import { SectionSwitcher } from "@/components/SectionSwitcher";
import { fetchEnvStats, fetchReportStats, getLocale, waitForI18next } from "@/stores";
import { fetchPieChartData } from "@/stores/chart";
import { currentEnvironment, environmentsStore, fetchEnvironments } from "@/stores/env";
import { fetchEnvInfo } from "@/stores/envInfo";
import { fetchCi } from "@/stores/ci";
import { fetchGlobals } from "@/stores/globals";
import { isLayoutLoading, layoutStore } from "@/stores/layout";
import { fetchTestResult, fetchTestResultNav } from "@/stores/testResults";
import { fetchEnvTreesData } from "@/stores/tree";
import { fetchTimelineData } from "@/stores/timeline";
import { fetchQualityGateResults } from "./stores/qualityGate";
import { testResultRoute } from "./stores/router";
import { currentSection } from "./stores/sections";
import { currentTrId } from "./stores/testResult";
import { fetchTreeFiltersData } from "./stores/treeFilters/actions";
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

export const App = () => {
  const className = styles[`layout-${currentSection.value !== "default" ? currentSection.value : layoutStore.value}`];
  const [prefetched, setPrefetched] = useState(false);

  const prefetchData = async () => {
    const fns = [
      fetchReportStats,
      fetchPieChartData,
      fetchEnvironments,
      fetchEnvInfo,
      fetchGlobals,
      fetchCi,
      fetchQualityGateResults,
    ];

    if (globalThis) {
      fns.unshift(getLocale);
    }

    await waitForI18next;
    // Ensure options (apiBaseUrl, launchId) are set before any API fetches
    await ensureReportDataReady();
    await Promise.all(fns.map((fn) => fn(currentEnvironment.value)));

    // Static report uses "default" when no envs; API may return []. Use ["default"] fallback so tree always loads.
    const envItems = environmentsStore.value.data ?? [];
    const envs = envItems.length ? envItems.map((e) => e.id) : ["default"];
    await fetchEnvTreesData(envs);
    await fetchEnvStats(envs);
    await fetchTimelineData();

    await fetchTreeFiltersData();
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
