import type { StabilityDistributionChartData } from "@allurereport/charts-api";

type I18nKeys = "no-results" | "legend.stabilityRate";

export type I18nProp = (key: I18nKeys, props?: Record<string, unknown>) => string;

export type Props = Omit<StabilityDistributionChartData, "type"> & {
  i18n: I18nProp;
};
