import { ensureReportDataReady } from "@allurereport/web-commons";
import "@allurereport/web-components/index.css";
import { render } from "preact";
import { useEffect } from "preact/hooks";
import "@/assets/scss/index.scss";
import { BaseLayout } from "@/components/BaseLayout";
import { getLocale, getTheme, waitForI18next } from "@/stores";
import { fetchTrendData } from "@/stores/trends";
import { fetchEnvInfo } from "@/stores/envInfo";
import { handleHashChange } from "@/stores/router";
import { isMac } from "@/utils/isMac";
import * as styles from "./styles.scss";

const App = () => {
  useEffect(() => {
    if (globalThis) {
      getLocale();
      getTheme();
    }
    ensureReportDataReady();
    fetchTrendData();
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
      <BaseLayout />
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
  await waitForI18next;
  if (globalThis) {
    await getLocale();
    getTheme();
  }
  await ensureReportDataReady();
  await fetchEnvInfo();
  await fetchTrendData();


  render(<App />, rootElement);
})();
