import type { TestStatus } from "@allurereport/core-api";
import { interpolateRgb } from "d3-interpolate";
import { scaleLinear } from "d3-scale";

export const getColorFromStatus = (status: TestStatus) => {
  switch (status) {
    case "passed":
      return "var(--bg-support-castor)";
    case "failed":
      return "var(--bg-support-capella)";
    case "broken":
      return "var(--bg-support-atlas)";
    case "unknown":
      return "var(--bg-support-skat)";
    case "skipped":
      return "var(--bg-support-rau)";
    default:
      return "var(--bg-support-skat)";
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
