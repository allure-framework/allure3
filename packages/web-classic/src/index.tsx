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
import { currentLocale, getLocale, getTheme } from "@/stores";
import { handleHashChange, route } from "@/stores/router";

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
    getTheme();
    getLocale();
    handleHashChange();
  }, []);

  useEffect(() => {
    globalThis.addEventListener("hashchange", handleHashChange);

    return () => {
      globalThis.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const ActiveComponent = useMemo(() => tabComponents[route.value.tabName] || (() => null), [route.value.tabName]);

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
