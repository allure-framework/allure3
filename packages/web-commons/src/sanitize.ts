import DOMPurify from "dompurify";

/**
 * Sanitize HTML string.
 * @param html HTML string to sanitize.
 * @param config Config for the dompurify package.
 * @returns Sanitized HTML string.
 */
export const sanitize = (html: string, config?: Record<string, any>) => DOMPurify.sanitize(html, config);

const IFRAME_SANITIZE_CONFIG = {
  USE_PROFILES: { html: true },
};

export const sanitizeIframeHtml = (html: string) => sanitize(html, IFRAME_SANITIZE_CONFIG);

const HTML_DOCUMENT_SANITIZE_CONFIG = {
  WHOLE_DOCUMENT: true,
  // DOMPurify drops meta/link/title by default (they're treated as unsafe "document metadata" tags,
  // not expected when sanitizing a snippet for insertion into an existing page). They're needed here
  // to preserve an attachment's own stylesheet links and charset declaration.
  ADD_TAGS: ["meta", "link", "title"],
  ADD_ATTR: ["charset", "http-equiv", "content", "name", "rel", "href", "media", "property"],
  // `base` can hijack how every relative url in the document resolves; `http-equiv` (e.g. meta refresh)
  // can redirect the iframe on its own, without any script execution. Neither is needed to render an
  // attachment, so both are dropped even though the sandboxed iframe has no allow-scripts.
  FORBID_TAGS: ["base"],
  FORBID_ATTR: ["http-equiv"],
};

/**
 * Sanitize a full HTML document (doctype/head/body) for rendering in a preview iframe,
 * preserving `<head>` content such as `<style>` and `<meta charset>`.
 */
export const sanitizeHtmlDocument = (html: string) => {
  const sanitized = sanitize(html, HTML_DOCUMENT_SANITIZE_CONFIG);
  // DOMPurify has no concept of a doctype node, so WHOLE_DOCUMENT always drops it. Re-add it
  // unconditionally: without it the iframe renders in quirks mode, which affects box sizing and
  // other layout rules regardless of what the original attachment declared.
  return sanitized ? `<!DOCTYPE html>${sanitized}` : sanitized;
};
