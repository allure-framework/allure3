import type { TestBaseGrowthDynamicsChartData } from "@allurereport/charts-api";
import type { TestStatus } from "@allurereport/core-api";

type I18nKeys =
  | `statuses:${TestStatus}`
  | `status.new${TestStatus}`
  | `status.removed${TestStatus}`
  | "legend.cumulativeTrend"
  | "legend.diffTrend"
  | "trendHelp.label"
  | "trendHelp.description"
  | "no-history"
  | "no-results"
  | "ticks.current"
  | "ticks.history"
  | "tooltips.current"
  | "tooltips.history"
  | "tooltips.newTests"
  | "tooltips.removedTests"
  | "tooltips.number"
  | "tooltips.statusCount"
  | "tooltips.noChanges";

export type I18nProp = (key: I18nKeys, props?: Record<string, unknown>) => string;

export type Props = Omit<TestBaseGrowthDynamicsChartData, "type"> & {
  i18n: I18nProp;
};

export type StatusWithPrefix = `new:${TestStatus}` | `removed:${TestStatus}`;
