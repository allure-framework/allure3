export type DiffStatistic = {
  regressed?: number;
  fixed?: number;
  malfunctioned?: number;
  new?: number;
};

export type Statistic = DiffStatistic & {
  failed?: number;
  broken?: number;
  passed?: number;
  skipped?: number;
  unknown?: number;
  total: number;
  retries?: number;
  flaky?: number;
};
