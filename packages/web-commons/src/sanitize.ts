import DOMPurify from "dompurify";

/**
 * Sanitize HTML string.
 * @param html HTML string to sanitize.
 * @param config Config for the dompurify package.
 * @returns Sanitized HTML string.
 */
export const sanitize = DOMPurify.sanitize.bind(DOMPurify);
