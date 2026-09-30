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
