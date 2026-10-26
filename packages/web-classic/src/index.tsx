import { PageLoader } from "@allurereport/web-components";

import "@allurereport/web-components/index.css";
import { render } from "preact";
import { useEffect, useMemo } from "preact/compat";

import "@/assets/scss/index.scss";
import { BaseLayout } from "@/components/BaseLayout";
import Behaviors from "@/components/Behaviors";
import Categories from "@/components/Categories";
import Graphs from "@/components/Graphs";
import Overview from "@/components/Overview";
import Packages from "@/components/Packages";
import Suites from "@/components/Suites";
import { TestResultView } from "@/components/TestResultView";
import Timeline from "@/components/Timeline";
import { currentLocale, getLocale } from "@/stores";
import { handleHashChange, route } from "@/stores/router";
import { fetchTestResultNav } from "@/stores/testResults";

const tabComponents = {
  overview: Overview,
  behaviors: Behaviors,
  categories: Categories,
  graphs: Graphs,
  packages: Packages,
  suites: Suites,
  timeline: Timeline,
  testresult: TestResultView,
};

const App = () => {
  useEffect(() => {
    getLocale();
    handleHashChange();
    // the list of test results for the previous/next buttons of the test result page
    fetchTestResultNav();
  }, []);

  useEffect(() => {
    globalThis.addEventListener("hashchange", handleHashChange);

    return () => {
      globalThis.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const ActiveComponent = useMemo(
    // Unknown tabs fall back to Overview, like the Allure 2 default route
    () => tabComponents[route.value.tabName] || Overview,
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
    [route.value.tabName],
  );

  if (!currentLocale.value) {
    return <PageLoader />;
  }
  return (
    <BaseLayout>
      <ActiveComponent params={route.value.params} />
    </BaseLayout>
  );
};

const rootElement = document.getElementById("app");

(async () => {
  render(<App />, rootElement);
})();
