export const HTML_PREVIEW_RESIZE_MESSAGE_TYPE = "allure:html-preview:resize";

const HTML_PREVIEW_MAX_HEIGHT = 10000;

const HTML_PREVIEW_CSP = [
  "default-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "worker-src 'none'",
  "connect-src 'none'",
  "img-src data: blob: https:",
  "media-src data: blob: https:",
  "font-src data: https:",
  "style-src 'unsafe-inline' https:",
  "script-src 'unsafe-inline' 'unsafe-eval' https:",
].join("; ");

const DARK_STYLE =
  ":root,html,body{background:#1c1c1e !important;color:#e5e5e7 !important;}body *{border-color:rgba(255,255,255,0.12) !important;}";

const createResizeScript = (token: string) => `
(() => {
  const type = ${JSON.stringify(HTML_PREVIEW_RESIZE_MESSAGE_TYPE)};
  const token = ${JSON.stringify(token)};
  let scheduled = false;
  const measure = () => {
    const body = document.body;
    const root = document.documentElement;
    const heights = [body?.scrollHeight ?? 0, body?.offsetHeight ?? 0, root.scrollHeight, root.offsetHeight];
    return Math.min(Math.ceil(Math.max(...heights)), ${HTML_PREVIEW_MAX_HEIGHT});
  };
  const send = () => {
    scheduled = false;
    parent.postMessage({ type, token, height: measure() }, "*");
  };
  const schedule = () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(send);
    }
  };
  window.addEventListener("load", schedule);
  document.addEventListener("DOMContentLoaded", schedule);
  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(schedule);
    observer.observe(document.documentElement);
    if (document.body) {
      observer.observe(document.body);
    }
  }
  setTimeout(schedule, 0);
  setTimeout(schedule, 500);
})();
`;

const createElementWithText = (doc: Document, tag: string, text: string) => {
  const element = doc.createElement(tag);
  element.textContent = text;
  return element;
};

const createMeta = (doc: Document, attributes: Record<string, string>) => {
  const meta = doc.createElement("meta");
  Object.entries(attributes).forEach(([name, value]) => meta.setAttribute(name, value));
  return meta;
};

export const createHtmlPreviewDocument = (html: string, token: string, dark: boolean) => {
  const doc = new DOMParser().parseFromString(html.replace(/^﻿/, ""), "text/html");

  doc.querySelectorAll("base, meta[http-equiv]").forEach((element) => element.remove());
  doc.head.prepend(
    createMeta(doc, { charset: "utf-8" }),
    createMeta(doc, { "http-equiv": "Content-Security-Policy", "content": HTML_PREVIEW_CSP }),
    createMeta(doc, { name: "referrer", content: "no-referrer" }),
  );
  if (dark) {
    doc.head.append(createElementWithText(doc, "style", DARK_STYLE));
  }
  doc.body.append(createElementWithText(doc, "script", createResizeScript(token)));

  return `<!DOCTYPE html>${doc.documentElement.outerHTML}`;
};
