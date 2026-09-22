import type { Statistic } from "@allurereport/core-api";

export type GitlabReportSummary = {
  name: string;
  duration: number;
  stats: Statistic;
  newTests: number;
  flakyTests: number;
  retryTests: number;
};
