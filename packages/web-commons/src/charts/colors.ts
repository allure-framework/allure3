import type { TestStatus } from "@allurereport/core-api";

export const statusColors: Record<TestStatus, string> = {
  failed: "var(--bg-support-capella)",
  broken: "var(--bg-support-atlas)",
  passed: "var(--bg-support-castor)",
  skipped: "var(--bg-support-rau)",
  unknown: "var(--bg-support-skat)",
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
