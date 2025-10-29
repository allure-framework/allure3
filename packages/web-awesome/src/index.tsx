import { ensureReportDataReady } from "@allurereport/web-commons";
import { Spinner, SvgIcon, allureIcons } from "@allurereport/web-components";
import "@allurereport/web-components/index.css";
import clsx from "clsx";
import { render } from "preact";
import "preact/debug";
import { useEffect, useState } from "preact/hooks";
import "@/assets/scss/index.scss";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ModalComponent } from "@/components/Modal";
import { SectionSwitcher } from "@/components/SectionSwitcher";
import { fetchEnvStats, fetchReportStats, getLocale, getTheme, waitForI18next } from "@/stores";
import { fetchPieChartData } from "@/stores/chart";
import { currentEnvironment, environmentsStore, fetchEnvironments } from "@/stores/env";
import { fetchEnvInfo } from "@/stores/envInfo";
import { fetchGlobals } from "@/stores/globals";
import { getLayout, isLayoutLoading, layoutStore } from "@/stores/layout";
import { handleHashChange, route } from "@/stores/router";
import { currentSection, getSection } from "@/stores/sections";
import { fetchTestResult, fetchTestResultNav } from "@/stores/testResults";
import { fetchEnvTreesData } from "@/stores/tree";
import { isMac } from "@/utils/isMac";
import { fetchQualityGateResults } from "./stores/qualityGate";
import * as styles from "./styles.scss";

const Loader = () => {
  return (
    <div className={clsx(styles.loader, isLayoutLoading.value ? styles.loading : "")} data-testid="loader">
      <SvgIcon id={allureIcons.reportLogo} size={"m"} />
      <Spinner />
    </div>
  );
};

const App = () => {
  const className = styles[`layout-${currentSection.value !== "" ? currentSection.value : layoutStore.value}`];
  const [prefetched, setPrefetched] = useState(false);
  const testResultId = route.value.params?.testResultId ?? null;
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
      fns.unshift(
        getSection as () => Promise<void>,
        getLocale,
        getLayout as () => Promise<void>,
        getTheme as () => Promise<void>,
      );
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

  useEffect(() => {
    if (testResultId) {
      fetchTestResult(testResultId);
      fetchTestResultNav(currentEnvironment.value);
    }
  }, [testResultId, currentEnvironment]);

  useEffect(() => {
    const onHashChange = () => handleHashChange();

    handleHashChange();
    globalThis.addEventListener("hashchange", onHashChange);

    return () => {
      globalThis.removeEventListener("hashchange", onHashChange);
    };
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

export const openInNewTab = (path: string) => {
  window.open(`#${path}`, "_blank");
};

const rootElement = document.getElementById("app");

document.addEventListener("DOMContentLoaded", () => {
  if (isMac) {
    document.documentElement.setAttribute("data-os", "mac");
  }
});

render(<App />, rootElement);
