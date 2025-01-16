import "@allurereport/web-components/index.css";
import { useSignal } from "@preact/signals";
import { render } from "preact";
import { useEffect } from "preact/compat";
import "@/assets/scss/index.scss";
import { BaseLayout } from "@/components/BaseLayout";
import Behavior from "@/components/Behavior";
import Categories from "@/components/Categories";
import Graphs from "@/components/Graphs";
import Overview from "@/components/Overview";
import Packages from "@/components/Packages";
import Suites from "@/components/Suites";
import Timeline from "@/components/Timeline";

const tabComponents = {
  overview: Overview,
  categories: Categories,
  suites: Suites,
  graphs: Graphs,
  timeline: Timeline,
  behaviors: Behavior,
  packages: Packages,
};

const App = () => {
  const route = useSignal({ tabName: "overview", params: {} });

  const parseHash = () => {
    const hash = globalThis.location.hash.slice(1);
    const [tabName, ...params] = hash.split("/");
    return { tabName: tabName || "overview", params: { id: params[0], subId: params[1] } };
  };

  useEffect(() => {
    const handleHashChange = () => {
      route.value = parseHash();
    };

    handleHashChange();
    globalThis.addEventListener("hashchange", handleHashChange);

    return () => {
      globalThis.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const ActiveComponent = tabComponents[route.value.tabName] || (() => <div>nav</div>);

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
