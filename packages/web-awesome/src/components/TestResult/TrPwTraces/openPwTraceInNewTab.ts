const PLAYWRIGHT_TRACE_ORIGIN = "https://trace.playwright.dev";
const PLAYWRIGHT_TRACE_URL = `${PLAYWRIGHT_TRACE_ORIGIN}/next/`;
const RETRY_DELAY_MS = 300;

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

  newWindow.location.href = PLAYWRIGHT_TRACE_URL;
  newWindow.focus();

  sendTraceMessage();
  globalThis.setTimeout(() => {
    sendTraceMessage();
  }, RETRY_DELAY_MS);

  return true;
};
