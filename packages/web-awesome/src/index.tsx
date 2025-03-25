import { ensureReportDataReady } from "@allurereport/web-commons";
import { Spinner, SvgIcon, allureIcons } from "@allurereport/web-components";
import "@allurereport/web-components/index.css";
import clsx from "clsx";
import { render } from "preact";
import "preact/debug";
import { useEffect, useState } from "preact/hooks";
import "@/assets/scss/index.scss";
import { BaseLayout } from "@/components/BaseLayout";
import { ModalComponent } from "@/components/Modal";
import { SplitLayout } from "@/components/SplitLayout";
import { fetchEnvStats, fetchReportStats, getLocale, getTheme, waitForI18next } from "@/stores";
import { fetchPieChartData } from "@/stores/chart";
import { currentEnvironment, environmentsStore, fetchEnvironments } from "@/stores/env";
import { fetchEnvInfo } from "@/stores/envInfo";
import { getLayout, isLayoutLoading, isSplitMode } from "@/stores/layout";
import { handleHashChange, route } from "@/stores/router";
import { fetchTestResult, fetchTestResultNav } from "@/stores/testResults";
import { fetchEnvTreesData } from "@/stores/tree";
import { isMac } from "@/utils/isMac";
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
  const [prefetched, setPrefetched] = useState(false);
  const { id: testResultId } = route.value;
  const prefetchData = async () => {
    const fns = [ensureReportDataReady, fetchReportStats, fetchPieChartData, fetchEnvironments, fetchEnvInfo];

    if (globalThis) {
      fns.unshift(getLocale, getLayout as () => Promise<void>, getTheme as () => Promise<void>);
    }

    await waitForI18next;
    await Promise.all(fns.map((fn) => fn(currentEnvironment.value)));

    if (currentEnvironment.value) {
      await fetchEnvTreesData([currentEnvironment.value]);
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
    handleHashChange();
    globalThis.addEventListener("hashchange", () => handleHashChange());

    return () => {
      globalThis.removeEventListener("hashchange", () => handleHashChange());
    };
  }, []);

  return (
    <div className={styles.main}>
      {!prefetched && <Loader />}
      {prefetched && (
        <>
          {isSplitMode.value ? <SplitLayout /> : <BaseLayout />}
          <ModalComponent />
        </>
      )}
    </div>
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
