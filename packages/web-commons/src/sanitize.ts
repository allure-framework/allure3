import DOMPurify, { type Config } from "dompurify";

// Use globalThis.DOMPurify if available (test env), otherwise use the default import (browser build)
// @ts-ignore
const DOMPurifyInstance = typeof globalThis !== 'undefined' && globalThis.DOMPurify ? globalThis.DOMPurify : DOMPurify;

/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param html - The HTML content to sanitize
 * @param options - DOMPurify configuration options
 * @returns Sanitized HTML string
 */
export const sanitizeHtml = (html: string, options?: Config): string => {
  if (!html || typeof html !== "string") {
    return "";
  }

  // Use DOMPurify's built-in HTML profile, with optional extra tags/attrs
  const defaultOptions: Config = {
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
 * @returns Sanitized HTML string safe for code display
 */
export const sanitizeAnsiHtml = (html: string): string => {
  if (!html || typeof html !== "string") {
    return "";
  }

  // Use minimal profile for ANSI-converted content - only allow span with style
  const ansiOptions: Config = {
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
 * @returns Sanitized HTML string safe for attachment preview
 */
export const sanitizeAttachmentHtml = (html: string): string => {
  if (!html || typeof html !== "string") {
    return "";
  }

  // Use DOMPurify's built-in HTML profile, but further restrict dangerous elements
  const attachmentOptions: Config = {
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