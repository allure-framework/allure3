import {
  ensureReportDataReady,
  goTo,
  parseTestResultRoute,
  subscribeToUrlChange,
  testPlatform,
} from "@allurereport/web-commons";

import "@allurereport/web-components/index.css";
import { render } from "preact";
import { useEffect } from "preact/hooks";

import "@/assets/scss/index.scss";
import { BaseLayout } from "@/components/BaseLayout";
import { getLocale, waitForI18next } from "@/stores/locale";

import * as styles from "./styles.scss";

const isMac = testPlatform(/^Mac/i);

const App = () => {
  useEffect(() => {
    const fallbackToRoot = () => {
      if (parseTestResultRoute(window.location.hash)) {
        const url = new URL(window.location.href);
        url.hash = "";
        goTo(url, { replace: true });
      }
    };

    fallbackToRoot();
    return subscribeToUrlChange(fallbackToRoot);
  }, []);

  return (
    <div className={styles.main}>
      <BaseLayout />
    </div>
  );
};

const rootElement = document.getElementById("app")!;

document.addEventListener("DOMContentLoaded", () => {
  if (isMac) {
    document.documentElement.setAttribute("data-os", "mac");
  }
});

(async () => {
  await waitForI18next;
  if (globalThis) {
    await getLocale();
  }
  await ensureReportDataReady();

  render(<App />, rootElement);
})();
