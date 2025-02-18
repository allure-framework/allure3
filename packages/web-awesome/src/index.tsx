import { ensureReportDataReady } from "@allurereport/web-commons";
import { Spinner, SvgIcon, allureIcons } from "@allurereport/web-components";
import "@allurereport/web-components/index.css";
import clsx from "clsx";
import { render } from "preact";
import { useEffect } from "preact/hooks";
import "@/assets/scss/index.scss";
import { BaseLayout } from "@/components/BaseLayout";
import { SplitLayout } from "@/components/SplitLayout";
import { fetchStats, getLocale, getTheme } from "@/stores";
import { fetchPieChartData } from "@/stores/chart";
import { fetchEnvInfo } from "@/stores/envInfo";
import { getLayout, isLayoutLoading, isSplitMode } from "@/stores/layout";
import { handleHashChange, route } from "@/stores/router";
import { fetchTestResult, fetchTestResultNav } from "@/stores/testResults";
import { fetchTreeData } from "@/stores/tree";
import { isMac } from "@/utils/isMac";
import * as styles from "./styles.scss";

const Loader = () => {
  return (
    <div className={clsx(styles.loader, isLayoutLoading.value ? styles.loading : "")}>
      <SvgIcon id={allureIcons.reportLogo} size={"m"} />
      <Spinner />
    </div>
  );
};
const App = () => {
  const { id: testResultId } = route.value;

  useEffect(() => {
    if (testResultId) {
      fetchTestResult(testResultId);
      fetchTestResultNav();
    }
    getLayout();
    getTheme();
    getLocale();
    ensureReportDataReady();
    fetchStats();
    fetchPieChartData();
    fetchTreeData();
    fetchEnvInfo();
  }, []);

  useEffect(() => {
    handleHashChange();
    globalThis.addEventListener("hashchange", () => handleHashChange());

    return () => {
      globalThis.removeEventListener("hashchange", () => handleHashChange());
    };
  }, []);
  return (
    <div className={styles.main}>
      <Loader />
      {isSplitMode.value ? <SplitLayout /> : <BaseLayout />}
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

(async () => {
  render(<App />, rootElement);
})();
