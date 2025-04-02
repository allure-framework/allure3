import { ensureReportDataReady } from "@allurereport/web-commons";
import "@allurereport/web-components/index.css";
import { render } from "preact";
import { useEffect } from "preact/hooks";
import "@/assets/scss/index.scss";
import { BaseLayout } from "@/components/BaseLayout";
import { getLocale, waitForI18next } from "@/stores/locale";
import { getTheme } from "@/stores/theme";
import { fetchTrendData } from "@/stores/trends";
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

  return (
    <div className={styles.main}>
      <BaseLayout />
    </div>
  );
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
  await fetchTrendData();


  render(<App />, rootElement);
})();
