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
  axesTickColor: "var(--color-text-secondary)",
  gridLineColor: "var(--color-border-default)",
  chartBackgroundColor: "var(--color-bg-primary)",
  textFillColor: "var(--color-text-primary)",
} as const;

export const CHART_THEME: PartialTheme = {
  background: CHART_PALETTE.chartBackgroundColor,
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
      strokeLinecap: "round",
    },
  },
  dots: {
    text: {
      fill: CHART_PALETTE.axesTickColor,
      fontSize: 12,
    },
  },
  labels: {
    text: {
      fill: CHART_PALETTE.textFillColor,
      fontSize: 12,
    },
  },
  text: {
    fill: CHART_PALETTE.textFillColor,
    fontSize: 12,
  },
  markers: {
    lineColor: "var(--color-border-default)",
    lineStrokeWidth: 2,
    text: {
      fill: CHART_PALETTE.textFillColor,
      fontSize: 12,
      fontWeight: 600,
    },
  },
  legends: {
    text: {
      fill: CHART_PALETTE.textFillColor,
      fontSize: 12,
    },
  },
  tooltip: {
    container: {
      background: "var(--color-bg-raised)",
      color: "var(--color-text-primary)",
    },
  },
};
