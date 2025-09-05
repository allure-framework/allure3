import sanitizeHtml from "sanitize-html";

/**
 * Sanitize HTML string.
 * @param html HTML string to sanitize.
 * @param config Config for the dompurify package.
 * @returns Sanitized HTML string.
 */
export const sanitize = sanitizeHtml;
