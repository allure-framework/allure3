/**
 * Normalize Config.resultsDir to a non-empty string[].
 */
export const normalizeResultsDir = (value?: string | string[]): string[] => {
  if (value === undefined) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];

  return values.filter((entry) => entry.length > 0);
};
