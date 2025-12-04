import type { PartialTheme } from "@nivo/theming";

export const CHART_MOTION_CONFIG = {
  mass: 1,
  tension: 500,
  friction: 40,
  clamp: false,
  precision: 0.01,
  velocity: 0,
};

export const REDUCE_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const CHART_PALETTE = {
  axesTickColor: "var(--on-text-secondary)",
  gridLineColor: "var(--on-border-muted)",
  chartBackgroundColor: "var(--bg-base-primary)",
} as const;

export const CHART_THEME: PartialTheme = {
  axis: {
    ticks: {
      text: {
        fill: CHART_PALETTE.axesTickColor,
        fontSize: 12,
      },
    },
  },
  grid: {
    line: {
      stroke: CHART_PALETTE.gridLineColor,
      strokeDasharray: "4",
    },
  },
};
