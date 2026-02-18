import type { StatusAgePyramidChartData } from "@allurereport/charts-api";
import type { TestStatus } from "@allurereport/core-api";

export type FBSUStatus = Exclude<TestStatus, "passed">;

type I18nKeys =
  | `status.${FBSUStatus}`
  | "no-history"
  | "no-results"
  | "ticks.current"
  | "ticks.history"
  | "tooltips.current"
  | "tooltips.history";

export type I18nProp = (key: I18nKeys, props?: Record<string, unknown>) => string;

export type Props = Omit<StatusAgePyramidChartData, "type" | "statuses"> & {
  i18n: I18nProp;
  statuses: FBSUStatus[];
};
