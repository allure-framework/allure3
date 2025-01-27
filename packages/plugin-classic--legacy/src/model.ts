import type { Statistic } from "@allurereport/core-api";

export type Allure2Status = "failed" | "broken" | "passed" | "skipped" | "unknown";

export interface Allure2Time {
  start?: number;
  stop?: number;
  duration?: number;
}

export interface Allure2Label {
  name?: string;
  value?: string;
}

export interface Allure2Link {
  name?: string;
  url?: string;
  type?: string;
}

export interface Allure2Parameter {
  name?: string;
  value?: string;
}

export interface Allure2Attachment {
  uid: string;
  name?: string;
  source?: string;
  type?: string;
  size?: number;
}

export interface Allure2Step {
  name: string;
  time: Allure2Time;
  status: Allure2Status;
  statusMessage?: string;
  statusTrace?: string;
  steps: Allure2Step[];
  attachments: Allure2Attachment[];
  parameters: Allure2Parameter[];
  stepsCount: number;
  attachmentsCount: number;
  shouldDisplayMessage: boolean;
  hasContent: boolean;
  attachmentStep: boolean;
}

export type Allure2StageResult = Allure2Step | Omit<Allure2Step, "name">;

export interface Allure2TestResult {
  uid: string;
  name: string;
  fullName?: string;
  historyId?: string;
  testId?: string;
  time: Allure2Time;
  description?: string;
  descriptionHtml?: string;
  status: Allure2Status;
  statusMessage?: string;
  statusTrace?: string;
  flaky: boolean;
  newFailed: boolean;
  newBroken: boolean;
  newPassed: boolean;
  retriesCount: number;
  retriesStatusChange: boolean;

  beforeStages: Allure2StageResult[];
  testStage: Allure2StageResult;
  afterStages: Allure2StageResult[];

  labels: Allure2Label[];
  parameters: Allure2Parameter[];
  links: Allure2Link[];

  hostId?: string;
  threadId?: string;

  hidden: boolean;
  retry: boolean;
  extra: { [key: string]: any };
}

// report related models

export const statisticKeys: (keyof Statistic)[] = ["failed", "broken", "passed", "skipped", "unknown", "total"];

export interface GroupTime {
  start?: number;
  stop?: number;
  duration?: number;
  minDuration?: number;
  maxDuration?: number;
  sumDuration?: number;
}

export interface SummaryData {
  reportName: string;
  statistic: Statistic;
  time: GroupTime;
}

export type Allure2SeverityLevel = "blocker" | "critical" | "normal" | "minor" | "trivial";
export const severityValues: Allure2SeverityLevel[] = ["blocker", "critical", "normal", "minor", "trivial"];

export interface StatusChartData {
  uid: string;
  name: string;
  time: Allure2Time;
  status: Allure2Status;
  severity: Allure2SeverityLevel;
}

export interface Allure2Category {
  name: string;
  description?: string;
  descriptionHtml?: string;
  messageRegex?: string;
  traceRegex?: string;
  matchedStatuses?: Allure2Status[];
  flaky?: boolean;
}

export interface Allure2RetryItem {
  uid: string;
  status: Allure2Status;
  statusDetails?: string;
  time: Allure2Time;
}

export interface Allure2HistoryItem {
  uid: string;
  reportUrl: string;
  status: Allure2Status;
  statusDetails?: string;
  time: Allure2Time;
}

export interface Allure2HistoryData {
  statistic: Statistic;
  items: Allure2HistoryItem[];
}

export interface Allure2HistoryTrendItem {
  data: Statistic;
  buildOrder?: number;
  reportUrl?: string;
  reportName?: string;
}

export type Allure2Options = {
  reportName?: string;
  singleFile?: boolean;
  reportLanguage?: string;
};

export type Allure2PluginOptions = Allure2Options;

// TODO should be replaced with information taken from store
export interface Allure2ExecutorInfo {
  name: string;
  type: string;
  url: string;
  buildOrder: number;
  buildName: string;
  buildUrl: string;
  reportName: string;
  reportUrl: string;
}
