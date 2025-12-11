import type { Statistic, TestStatus } from "@allurereport/core-api";

type DataItem = {
  id: string | "current";
  timestamp: number;
  prevItemTimestamp: number;
  /**
   * A previously "failed" or "broken" test that is now "passed"
   */
  fixed: number;
  /**
   * A previously "passed" or "broken" test that is now "failed"
   */
  regressed: number;
  /**
   * A previously "passed" or "failed" test that is now "broken"
   */
  malfunctioned: number;
};

type I18nKeys =
  | "transitions.new"
  | "transitions.fixed"
  | "transitions.regressed"
  | "transitions.malfunctioned"
  | "no-history"
  | "no-results"
  | "ticks.current"
  | "ticks.history"
  | "tooltips.current"
  | "tooltips.history";

export type I18nProp = (key: I18nKeys, props?: Record<string, unknown>) => string;

export type Props = {
  title?: string;
  data: DataItem[];
  limit?: number;
  lines?: ("fixed" | "regressed" | "malfunctioned")[];
  hideEmptyLines?: boolean;
  statuses?: TestStatus[];
  i18n: I18nProp;
};
