export type Statistic = {
  failed?: number;
  broken?: number;
  passed?: number;
  skipped?: number;
  unknown?: number;
  total: number;
  retries?: number;
  flaky?: number;
};
