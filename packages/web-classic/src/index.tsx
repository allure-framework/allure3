import "@allurereport/web-components/index.css";
import { render } from "preact";
import "@/assets/scss/index.scss";
import { App } from "@/App";
import { LaunchesPage } from "@/components/LaunchesPage";
import { getReportOptions } from "@allurereport/web-commons";

declare const __ALLURE_API_BASE_URL__: string | undefined;

if (typeof window !== "undefined" && typeof __ALLURE_API_BASE_URL__ !== "undefined") {
  (window as unknown as { allureReportOptions?: Record<string, unknown> }).allureReportOptions =
    (window as unknown as { allureReportOptions?: Record<string, unknown> }).allureReportOptions ?? {};
  (window as unknown as { allureReportOptions: Record<string, unknown> }).allureReportOptions.apiBaseUrl =
    __ALLURE_API_BASE_URL__.replace(/\/$/, "");
}

const rootElement = document.getElementById("app");

function getLaunchIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("launch_id") || params.get("launchId");
}

(async () => {
  const opts = getReportOptions<{ apiBaseUrl?: string; launchId?: string }>();
  const launchId = getLaunchIdFromUrl() ?? opts?.launchId ?? null;
  const renderReport = Boolean(launchId && opts?.apiBaseUrl);
  // #region agent log
  if (typeof fetch !== "undefined") fetch("http://127.0.0.1:7769/ingest/a8122316-6c42-40f6-b56b-8ed62be2f997",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"f7a19b"},body:JSON.stringify({sessionId:"f7a19b",location:"index.tsx:entry",message:"App vs LaunchesPage",data:{launchId,hasApiBaseUrl:!!opts?.apiBaseUrl,renderReport},timestamp:Date.now(),hypothesisId:"C"})}).catch(()=>{});
  // #endregion
  if (renderReport) {
    render(<App />, rootElement);
  } else {
    render(<LaunchesPage />, rootElement);
  }
})();
