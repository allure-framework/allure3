import type { TestStatus } from "@allurereport/core-api";

export const statusColors: Record<TestStatus, string> = {
  failed: "var(--color-status-failed-chart-fill)",
  broken: "var(--color-status-broken-chart-fill)",
  passed: "var(--color-status-passed-chart-fill)",
  skipped: "var(--color-status-skipped-chart-fill)",
  unknown: "var(--color-status-unknown-chart-fill)",
};

/**
 * Convert CSS var(--something) to color
 * @param value
 * @param el - optional element to resolve the color from
 * @returns
 */
export const resolveCSSVarColor = (value: string, el: Element = document.documentElement): string => {
  if (value.startsWith("var(")) {
    const match = value.match(/var\((--[^),\s]+)/);
    if (match) {
      const cssVarName = match[1];
      const resolved = getComputedStyle(el).getPropertyValue(cssVarName).trim();
      return resolved || value;
    }
  }

  return value;
};
