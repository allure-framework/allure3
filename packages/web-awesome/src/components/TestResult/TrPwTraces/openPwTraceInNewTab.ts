const PLAYWRIGHT_TRACE_ORIGIN = "https://trace.playwright.dev";
const PLAYWRIGHT_TRACE_VIEWER_URL = `${PLAYWRIGHT_TRACE_ORIGIN}/`;
const TRACE_VIEWER_OPEN_DELAY_MS = 750;
// Give the hosted trace viewer time to load and bootstrap its postMessage listener on cold loads.
const TRACE_VIEWER_BOOTSTRAP_DELAY_MS = 1_750;
const TRACE_LOADING_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Opening Playwright Trace</title>
    <style>
      body {
        align-items: center;
        background: #fff;
        color: #111827;
        display: flex;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        height: 100vh;
        justify-content: center;
        margin: 0;
      }
    </style>
  </head>
  <body>Opening Playwright trace...</body>
</html>`;
const TRACE_LOAD_ERROR_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Failed to Open Playwright Trace</title>
    <style>
      body {
        align-items: center;
        background: #fff;
        color: #111827;
        display: flex;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        height: 100vh;
        justify-content: center;
        margin: 0;
      }
    </style>
  </head>
  <body>Failed to load Playwright trace attachment.</body>
</html>`;

const wait = (timeout: number) => new Promise((resolve) => globalThis.setTimeout(resolve, timeout));

const writePage = (newWindow: Window, page: string) => {
  newWindow.document.write(page);
  newWindow.document.close();
};

export const openPlaywrightTraceInNewTab = (loadTrace: () => Promise<Blob>) => {
  const newWindow = window.open("", "_blank");
  if (!newWindow) {
    return false;
  }

  const sendTraceMessage = (trace: Blob) => {
    if (newWindow.closed) {
      return;
    }

    newWindow.postMessage({ method: "load", params: { trace } }, PLAYWRIGHT_TRACE_ORIGIN);
  };

  writePage(newWindow, TRACE_LOADING_PAGE);
  newWindow.focus();

  void Promise.all([loadTrace(), wait(TRACE_VIEWER_OPEN_DELAY_MS)])
    .then(([trace]) => {
      if (newWindow.closed) {
        return;
      }

      newWindow.location.href = PLAYWRIGHT_TRACE_VIEWER_URL;
      globalThis.setTimeout(() => {
        sendTraceMessage(trace);
      }, TRACE_VIEWER_BOOTSTRAP_DELAY_MS);
    })
    .catch(() => {
      if (newWindow.closed) {
        return;
      }

      writePage(newWindow, TRACE_LOAD_ERROR_PAGE);
    });

  return true;
};
