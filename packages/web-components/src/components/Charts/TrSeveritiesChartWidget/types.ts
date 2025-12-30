import type { TrSeveritiesChartData } from "@allurereport/charts-api";
import type { SeverityLevel, TestStatus } from "@allurereport/core-api";

type I18nKeys = `status.${TestStatus}` | `severity.${SeverityLevel | "unset"}` | "no-results" | "ticks.current";

export type I18nProp = (key: I18nKeys, props?: Record<string, unknown>) => string;

export type Props = Omit<TrSeveritiesChartData, "type"> & {
  i18n: I18nProp;
};
