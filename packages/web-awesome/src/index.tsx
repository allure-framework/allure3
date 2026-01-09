import {
  currentEnvironment,
  ensureReportDataReady,
  environmentsStore,
  fetchEnvironments,
  initRouterStore,
  initThemeStore,
} from "@allurereport/web-commons";
import { Spinner, SvgIcon, allureIcons } from "@allurereport/web-components";
import "@allurereport/web-components/index.css";
import { computed, effect, signal } from "@preact/signals";
import clsx from "clsx";
import { render } from "preact";
import "@/assets/scss/index.scss";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ModalComponent } from "@/components/Modal";
import { SectionSwitcher } from "@/components/SectionSwitcher";
import { fetchEnvStats, fetchReportStats, getLocale, waitForI18next } from "@/stores";
import { fetchPieChartData } from "@/stores/chart";
import { fetchEnvInfo } from "@/stores/envInfo";
import { fetchGlobals } from "@/stores/globals";
import { getLayout, isLayoutLoading, layoutStore } from "@/stores/layout";
import { currentSection } from "@/stores/sections";
import { fetchTestResult, fetchTestResultNav } from "@/stores/testResults";
import { fetchEnvTreesData } from "@/stores/tree";
import { isMac } from "@/utils/isMac";
import { fetchQualityGateResults } from "./stores/qualityGate";
import { testResultIdStore } from "./stores/testResult";
import * as styles from "./styles.scss";

const Loader = () => {
  return (
    <div className={clsx(styles.loader, isLayoutLoading.value ? styles.loading : "")} data-testid="loader">
      <SvgIcon id={allureIcons.reportLogo} size={"m"} />
      <Spinner />
    </div>
  );
};

initThemeStore();
initRouterStore();

effect(() => {
  const testResultId = testResultIdStore.value;

  if (testResultId) {
    fetchTestResult(testResultId);
    fetchTestResultNav(currentEnvironment.value);
  }
});

const envs = computed(() => environmentsStore.value.data.value);

const prefetchState = signal<"idle" | "pending" | "completed">("idle");

effect(() => {
  if (prefetchState.peek() !== "idle") {
    return;
  }

  prefetchState.value = "pending";

  const fns = [fetchReportStats, fetchEnvironments, fetchEnvInfo, fetchGlobals, fetchQualityGateResults];

  if (globalThis) {
    fns.unshift(getLocale, getLayout as () => Promise<void>);
  }

  Promise.all(fns.map((fn) => fn())).then(() => {
    prefetchState.value = "completed";
  });
});

effect(() => {
  fetchPieChartData(currentEnvironment.value);
  fetchEnvTreesData([currentEnvironment.value]);
});

effect(() => {
  fetchEnvStats(envs.value);
});

const isPrefetched = computed(() => prefetchState.value === "completed");

const App = () => {
  const className = styles[`layout-${currentSection.value !== "default" ? currentSection.value : layoutStore.value}`];

  if (!isPrefetched.value) {
    return <Loader />;
  }

  return (
    <div className={styles.main}>
      <Header className={className} />
      <SectionSwitcher />
      <Footer className={className} />
      <ModalComponent />
    </div>
  );
};

const rootElement = document.getElementById("app");

document.addEventListener("DOMContentLoaded", () => {
  if (isMac) {
    document.documentElement.setAttribute("data-os", "mac");
  }
});
const initApp = async () => {
  await waitForI18next;
  await Promise.all([ensureReportDataReady, waitForI18next]);
  render(<App />, rootElement);
};

initApp();
