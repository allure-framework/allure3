import type { StatusTransitionsChartData } from "@allurereport/charts-api";
import type { TestStatus } from "@allurereport/core-api";

type I18nKeys =
  | "transitions.new"
  | "transitions.fixed"
  | "transitions.regressed"
  | "transitions.malfunctioned"
  | "legend.trend"
  | "no-history"
  | "no-results"
  | "ticks.current"
  | "ticks.history"
  | "tooltips.current"
  | "tooltips.history";

export type I18nProp = (key: I18nKeys, props?: Record<string, unknown>) => string;

export type Props = Omit<StatusTransitionsChartData, "type"> & {
  statuses?: TestStatus[];
  i18n: I18nProp;
};
