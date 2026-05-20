const PLAYWRIGHT_TRACE_ORIGIN = "https://trace.playwright.dev";
const PLAYWRIGHT_TRACE_VIEWER_URL = `${PLAYWRIGHT_TRACE_ORIGIN}/`;

export const openPlaywrightTraceInNewTab = (traceUrl: string) => {
  const viewerUrl = new URL(PLAYWRIGHT_TRACE_VIEWER_URL);
  viewerUrl.searchParams.set("trace", traceUrl);

  const newWindow = window.open(viewerUrl.toString(), "_blank");
  if (!newWindow) {
    return false;
  }

  newWindow.focus();

  return true;
};
