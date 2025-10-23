import type { NewKey, RemovedKey } from "@allurereport/charts-api";
import type { SeverityLevel, TestStatus } from "@allurereport/core-api";

export const statusColors: Record<TestStatus, string> = {
  failed: "var(--bg-support-capella)",
  broken: "var(--bg-support-atlas)",
  passed: "var(--bg-support-castor)",
  skipped: "var(--bg-support-rau)",
  unknown: "var(--bg-support-skat)",
};

export const severityColors: Record<SeverityLevel, string> = {
  blocker: "var(--bg-support-capella)",
  critical: "var(--bg-support-atlas)",
  normal: "var(--bg-support-castor)",
  minor: "var(--bg-support-rau)",
  trivial: "var(--bg-support-skat)",
};

export const statusChangeColors: Record<NewKey<TestStatus> | RemovedKey<TestStatus>, string> = {
  newFailed: "var(--bg-support-capella)",
  newBroken: "var(--bg-support-atlas)",
  newPassed: "var(--bg-support-castor)",
  newSkipped: "var(--bg-support-rau)",
  newUnknown: "var(--bg-support-skat)",

  removedFailed: "color-mix(in srgb, var(--bg-support-capella) 80%, black)",
  removedBroken: "color-mix(in srgb, var(--bg-support-atlas) 80%, black)",
  removedPassed: "color-mix(in srgb, var(--bg-support-castor) 80%, black)",
  removedSkipped: "color-mix(in srgb, var(--bg-support-rau) 80%, black)",
  removedUnknown: "color-mix(in srgb, var(--bg-support-skat) 80%, black)",
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
