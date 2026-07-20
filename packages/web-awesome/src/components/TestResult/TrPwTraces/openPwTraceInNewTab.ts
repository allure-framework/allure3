const PLAYWRIGHT_TRACE_ORIGIN = "https://trace.playwright.dev";
const PLAYWRIGHT_TRACE_VIEWER_URL = `${PLAYWRIGHT_TRACE_ORIGIN}/`;
// Give the hosted trace viewer time to load and bootstrap its postMessage listener on cold loads.
const TRACE_LOAD_DELAY_MS = 2_000;

export const openPlaywrightTraceInNewTab = (blob: Blob) => {
  const newWindow = window.open("", "_blank");
  if (!newWindow) {
    return false;
  }

  const payload = { method: "load", params: { trace: blob } };
  const sendTraceMessage = () => {
    if (newWindow.closed) {
      return;
    }

    newWindow.postMessage(payload, PLAYWRIGHT_TRACE_ORIGIN);
  };

  newWindow.location.href = PLAYWRIGHT_TRACE_VIEWER_URL;
  newWindow.focus();

  globalThis.setTimeout(() => {
    sendTraceMessage();
  }, TRACE_LOAD_DELAY_MS);

  return true;
};
