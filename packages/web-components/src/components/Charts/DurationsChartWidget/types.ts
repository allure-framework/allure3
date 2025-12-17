import type { DurationsChartData } from "@allurereport/charts-api";

type I18nKeys =
  | "no-history"
  | "no-results"
  | "ticks.durationRange"
  | "tooltips.durationRange"
  | "legend.value"
  | "legend.total";

export type I18nProp = (key: I18nKeys, props?: Record<string, unknown>) => string;

export type Props = Omit<DurationsChartData, "type"> & {
  i18n: I18nProp;
};
