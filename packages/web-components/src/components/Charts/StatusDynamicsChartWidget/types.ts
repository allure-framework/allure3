import type { Statistic, TestStatus } from "@allurereport/core-api";

type I18nKeys =
  | "status.passed"
  | "status.failed"
  | "status.skipped"
  | "status.unknown"
  | "status.broken"
  | "no-history"
  | "no-results"
  | "ticks.current"
  | "ticks.history"
  | "tooltips.current"
  | "tooltips.history";

export type I18nProp = (key: I18nKeys, props?: Record<string, unknown>) => string;

export type Props = {
  title?: string;
  data: { statistic: Statistic; id: string; timestamp: number; name: string }[];
  limit?: number;
  statuses?: TestStatus[];
  i18n: I18nProp;
};
