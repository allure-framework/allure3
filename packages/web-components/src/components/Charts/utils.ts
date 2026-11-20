import type { TestStatus } from "@allurereport/core-api";
import { resolveCSSVarColor } from "@allurereport/web-commons";
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

export const withCumulativeTrend = <T extends { diffTrend: number }>(data: T[]) => {
  let total = 0;

  return data.map((item) => {
    total += item.diffTrend;

    return { ...item, cumulativeTrend: total / data.length };
  });
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
