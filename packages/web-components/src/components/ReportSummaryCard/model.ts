import type { Statistic, TestStatus } from "@allurereport/core-api";

export type ReportSummary = {
  href?: string;
  remoteHref?: string;
  jobHref?: string;
  pullRequestHref?: string;
  name: string;
  stats: Statistic;
  status: TestStatus;
  duration: number;
  plugin?: string;
  newTests?: string[];
  flakyTests?: string[];
  retryTests?: string[];
  knownTests?: string[];
  createdAt?: number;
};

type StatusI18nKeys = "status.failed" | "status.broken" | "status.passed" | "status.skipped" | "status.unknown";
type MetadataI18nKeys = "metadata.new" | "metadata.retry" | "metadata.flaky" | "metadata.known";

type I18nKeys = MetadataI18nKeys | StatusI18nKeys | "in" | "new" | "retry" | "flaky" | "known" | "total" | "createdAt";

export type I18nProp = (key: I18nKeys, props?: Record<string, any>) => string | undefined;
