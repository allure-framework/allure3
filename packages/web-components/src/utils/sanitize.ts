import DOMPurify from "dompurify";

// Default DOMPurify instance - will work in browser, undefined in Node.js
const defaultDOMPurify = DOMPurify;

/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param html - The HTML content to sanitize
 * @param options - DOMPurify configuration options
 * @param customDOMPurify - Optional custom DOMPurify instance for testing
 * @returns Sanitized HTML string
 */
export const sanitizeHtml = (html: string, options?: DOMPurify.Config, customDOMPurify?: typeof DOMPurify): string => {
  if (!html || typeof html !== "string") {
    return "";
  }

  const DOMPurifyInstance = customDOMPurify || defaultDOMPurify;

  // Use DOMPurify's built-in HTML profile, with optional extra tags/attrs
  const defaultOptions: DOMPurify.Config = {
    USE_PROFILES: { html: true },
    // Optionally allow extra tags/attrs if needed for your app:
    ADD_TAGS: ["code", "pre", "kbd", "samp", "var", "mark", "time", "abbr", "acronym", "dfn"],
    ADD_ATTR: ["data-lang", "data-line", "datetime"],
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false
  };

  const config = { ...defaultOptions, ...options };
  
  return String(DOMPurifyInstance.sanitize(html, config));
};

/**
 * Sanitizes ANSI-to-HTML converted content specifically for code display
 * @param html - The HTML content from ANSI conversion
 * @param customDOMPurify - Optional custom DOMPurify instance for testing
 * @returns Sanitized HTML string safe for code display
 */
export const sanitizeAnsiHtml = (html: string, customDOMPurify?: typeof DOMPurify): string => {
  if (!html || typeof html !== "string") {
    return "";
  }

  const DOMPurifyInstance = customDOMPurify || defaultDOMPurify;

  // Use minimal profile for ANSI-converted content - only allow span with style
  const ansiOptions: DOMPurify.Config = {
    ALLOWED_TAGS: ["span"],
    ALLOWED_ATTR: ["style"],
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false
  };

  return String(DOMPurifyInstance.sanitize(html, ansiOptions));
};

/**
 * Sanitizes HTML content for attachment previews with minimal allowed content
 * @param html - The HTML content to sanitize
 * @param customDOMPurify - Optional custom DOMPurify instance for testing
 * @returns Sanitized HTML string safe for attachment preview
 */
export const sanitizeAttachmentHtml = (html: string, customDOMPurify?: typeof DOMPurify): string => {
  if (!html || typeof html !== "string") {
    return "";
  }

  const DOMPurifyInstance = customDOMPurify || defaultDOMPurify;

  // Use DOMPurify's built-in HTML profile, but further restrict dangerous elements
  const attachmentOptions: DOMPurify.Config = {
    USE_PROFILES: { html: true },
    FORBID_TAGS: [
      "script", "object", "embed", "form", "input", "textarea", "select", "button", "iframe", "img", "a", "link", "meta", "style"
    ],
    FORBID_ATTR: [
      "onerror", "onload", "onclick", "onmouseover", "onmouseout", "onfocus", "onblur", "href", "src", "data", "action", "method", "target", "rel"
    ],
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false
  };

  return String(DOMPurifyInstance.sanitize(html, attachmentOptions));
}; 