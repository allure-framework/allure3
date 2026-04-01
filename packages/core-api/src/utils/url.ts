const ALLOWED_EXTERNAL_URL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Returns a normalized URL string only for explicitly allowed external schemes.
 * Unsafe or malformed values return undefined.
 */
export const sanitizeExternalUrl = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    return undefined;
  }

  const schemeMatch = normalized.match(/^([A-Za-z][A-Za-z0-9+.-]*):/);

  if (!schemeMatch) {
    return undefined;
  }

  const protocol = `${schemeMatch[1].toLowerCase()}:`;

  if (!ALLOWED_EXTERNAL_URL_PROTOCOLS.has(protocol)) {
    return undefined;
  }

  try {
    return new URL(normalized).toString();
  } catch {
    return undefined;
  }
};
