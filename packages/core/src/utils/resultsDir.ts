/**
 * Normalize Config.resultsDir to a non-empty string[].
 * Drops "", whitespace-only entries, and empty arrays — treated as unset → [].
 */
export const normalizeResultsDir = (value?: string | string[]): string[] => {
  if (value === undefined) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];

  return values.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
};
