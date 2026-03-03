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
import { testResultNavStore } from "@/stores/testResults";
import { navigateTo } from "@/utils/navigate";

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
  }, []);

  useEffect(() => {
    globalThis.addEventListener("hashchange", handleHashChange);

    return () => {
      globalThis.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        route.value.tabName !== "testresult" ||
        !route.value.params.testResultId ||
        (event.target as HTMLElement)?.tagName === "INPUT" ||
        (event.target as HTMLElement)?.tagName === "TEXTAREA" ||
        (event.target as HTMLElement)?.isContentEditable ||
        (event.key !== "ArrowUp" && event.key !== "ArrowDown")
      ) {
        return;
      }

      const navData = testResultNavStore.value.data;
      if (!navData || navData.length === 0) {
        return;
      }

      const currentId = route.value.params.testResultId;
      const currentIndex = navData.indexOf(currentId);

      if (currentIndex === -1) {
        return;
      }

      const indexPlusOne = currentIndex + 1;

      switch (event.key) {
        case "ArrowUp":
          // Navigate to previous test result (earlier in the list)
          if (indexPlusOne < navData.length) {
            event.preventDefault();
            navigateTo(navData[indexPlusOne]);
          }
          break;
        case "ArrowDown":
          if (indexPlusOne > 1) {
            event.preventDefault();
            navigateTo(navData[indexPlusOne - 2]);
          }
          break;
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);

    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
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
