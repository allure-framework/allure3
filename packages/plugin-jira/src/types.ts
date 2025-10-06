import type { Statistic, TestLink, TestParameter, TestStatus } from "@allurereport/core-api";

type JiraIssue = string;

export type ForgePluginTestResult = {
  id: string;
  runs: { status: TestStatus; env?: string; date: number }[];
  keyParams: TestParameter[];
  issue: TestLink;
  name: string;
};

export type ForgePluginReport = {
  id: string;
  history: string[];
  status: TestStatus;
  ciInfo?: {
    url: string;
    label?: string;
  };
  statistic: Statistic;
  statisticByEnv?: Record<string, Statistic>;
  name: string;
  url?: string;
  date: number;
};

export type ForgeAppOperations = "upload-report" | "upload-results" | "upload-all" | "clear";
export type ForgeAppVersions = "v1";

export type UploadReportPayload = {
  issue: JiraIssue;
  report: ForgePluginReport;
};

export type UploadResultsPayload = {
  results: ForgePluginTestResult[];
  reportUrl: string;
};
