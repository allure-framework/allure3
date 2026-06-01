import type { TestStatus } from "@allurereport/core-api";
import { interpolateRgb } from "d3-interpolate";
import { scaleLinear } from "d3-scale";

export type StatusColorRole = "chart" | "chartFill";

export const getColorFromStatus = (status: TestStatus, role: StatusColorRole = "chart") => {
  const suffix = role === "chartFill" ? "chart-fill" : "chart";

  switch (status) {
    case "passed":
      return `var(--color-status-passed-${suffix})`;
    case "failed":
      return `var(--color-status-failed-${suffix})`;
    case "broken":
      return `var(--color-status-broken-${suffix})`;
    case "unknown":
      return `var(--color-status-unknown-${suffix})`;
    case "skipped":
      return `var(--color-status-skipped-${suffix})`;
    default:
      return `var(--color-status-unknown-${suffix})`;
  }
};

export const getPercentage = (value: number, total: number) => Math.floor((value / total) * 10000) / 100;

export const getTrendForDivergingChart = (props: {
  positiveValue: number;
  negativeValue: number;
  absTotal: number;
  noValuePercentage?: number;
}) => {
  const { positiveValue, negativeValue, absTotal, noValuePercentage = -1 } = props;
  const summ = Math.abs(positiveValue) + Math.abs(negativeValue);

  if (summ === 0) {
    return noValuePercentage;
  }

  const diff = Math.abs(positiveValue) - Math.abs(negativeValue);
  const trendPercentage = getPercentage(Math.abs(diff), absTotal);

  if (diff > 0) {
    return 50 + trendPercentage;
  }

  if (diff < 0) {
    return 50 - trendPercentage;
  }

  return 50;
};

export const getTrendForChart = (props: { value: number; total: number; noValuePercentage?: number }) => {
  const { value, total, noValuePercentage = 0 } = props;

  if (total === 0) {
    return noValuePercentage;
  }

  const trendPercentage = getPercentage(Math.abs(value), total);

  return trendPercentage;
};

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

export const getColorScale = (domain: [number, number], colors: string[]) => {
  const [min, max] = domain;
  // Generate evenly spaced domain values to match colors length
  const expandedDomain = colors.map((_, i) => min + (max - min) * (i / (colors.length - 1)));

  return scaleLinear<string>()
    .domain(expandedDomain)
    .range(colors.map((c) => resolveCSSVarColor(c)))
    .interpolate(interpolateRgb)
    .clamp(true);
};
