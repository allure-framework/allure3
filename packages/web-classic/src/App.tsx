import { PageLoader } from "@allurereport/web-components";
import { useEffect, useMemo } from "preact/compat";
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

/** Report App component; exported for embedding in report-app (API mode with launch_id). */
export const App = () => {
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

  const ActiveComponent = useMemo(() => {
    const comp = tabComponents[route.value.tabName] ?? (() => null);
    // #region agent log
    if (typeof fetch !== "undefined") fetch("http://127.0.0.1:7769/ingest/a8122316-6c42-40f6-b56b-8ed62be2f997",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"f7a19b"},body:JSON.stringify({sessionId:"f7a19b",location:"App.tsx:ActiveComponent",message:"tab component resolve",data:{tabName:route.value.tabName,hasComponent:!!tabComponents[route.value.tabName]},timestamp:Date.now(),hypothesisId:"B"})}).catch(()=>{});
    // #endregion
    return comp;
  }, [route.value.tabName]);

  if (!currentLocale.value) {
    return <PageLoader />;
  }
  return (
    <BaseLayout>
      <ActiveComponent params={route.value.params} />
    </BaseLayout>
  );
};
