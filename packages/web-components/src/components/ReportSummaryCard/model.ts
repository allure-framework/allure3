import type { Statistic, TestResult, TestStatus } from "@allurereport/core-api";

/**
 * Reduced test result information that can be used in summary
 */
type SummaryTestResult = Pick<TestResult, "name" | "id" | "status" | "duration">;

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
  newTests?: SummaryTestResult[];
  flakyTests?: SummaryTestResult[];
  retryTests?: SummaryTestResult[];
  createdAt?: number;
};

type StatusI18nKeys = "status.failed" | "status.broken" | "status.passed" | "status.skipped" | "status.unknown";
type MetadataI18nKeys = "metadata.new" | "metadata.retry" | "metadata.flaky";

type I18nKeys = MetadataI18nKeys | StatusI18nKeys | "in" | "new" | "retry" | "flaky" | "total" | "createdAt";

export type I18nProp = (key: I18nKeys, props?: Record<string, any>) => string | undefined;
