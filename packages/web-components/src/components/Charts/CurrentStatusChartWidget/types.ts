import type { Statistic, TestStatus } from "@allurereport/core-api";

type I18nKeys =
  | "status.passed"
  | "status.failed"
  | "status.skipped"
  | "status.unknown"
  | "status.broken"
  | "percentage"
  | "of"
  | "tests.new"
  | "tests.flaky"
  | "tests.retries"
  | "total";

export type I18nProp = (key: I18nKeys, props?: Record<string, unknown>) => string;

export type Props = {
  title?: string;
  i18n?: I18nProp;
  data: Statistic;
  statuses?: TestStatus[];
  metric?: TestStatus;
};

export type ChartDatum = {
  id: string;
  // We need to set value to 1 to make sure that the arc is visible
  value: number;
  color: string;
  label: string;
};

export type ChartData = ChartDatum[];
