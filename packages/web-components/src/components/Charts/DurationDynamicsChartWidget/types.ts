import type { DurationDynamicsChartData } from "@allurereport/charts-api";

type I18nKeys =
  | "no-results"
  | "durations.sequential"
  | "durations.duration"
  | "durations.speedup"
  | "ticks.current"
  | "ticks.history"
  | "tooltips.current"
  | "tooltips.history"
  | "legend.duration"
  | "legend.speedup";

export type I18nProp = (key: I18nKeys, props?: Record<string, unknown>) => string;

export type Props = Omit<DurationDynamicsChartData, "type"> & {
  i18n: I18nProp;
};
