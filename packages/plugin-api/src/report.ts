import type {
  AttachmentTestStepResult,
  CiDescriptor,
  DefaultTreeGroup,
  HistoryTestResult,
  TestFixtureResult,
  TestResult,
  TestStatus,
  TestStepResult,
  TreeData,
  WithChildren,
} from "@allurereport/core-api";

import type { QualityGateValidationResult } from "./qualityGate.js";

export type Layout = "base" | "split";

export type StepTreeExpansion = "collapsed" | "expand_failed_only" | "expanded";

export type ReportRunSummary = {
  start: number;
  stop: number;
  duration: number;
};

export type ReportExecutorInfo = {
  name?: string;
  type?: string;
  url?: string;
  buildOrder?: number;
  buildName?: string;
  buildUrl?: string;
  reportName?: string;
  reportUrl?: string;
};

export type ReportOptions = {
  id?: string;
  allureVersion: string;
  reportName?: string;
  logo?: string;
  theme?: "light" | "dark" | "auto";
  groupBy?: string[];
  reportLanguage?: string;
  createdAt: number;
  reportUuid: string;
  layout?: Layout;
  defaultSection?: string;
  sections?: string[];
  cacheKey?: string;
  ci?: CiDescriptor;
  executor?: ReportExecutorInfo;
  runSummary?: ReportRunSummary;
  runSummaryByEnv?: Record<string, ReportRunSummary>;
  stepTreeExpansion?: StepTreeExpansion;
  defaultSortBy?: string;
};

export type ReportFixtureResult = Omit<
  TestFixtureResult,
  "testResultIds" | "start" | "stop" | "sourceMetadata" | "steps"
> & {
  steps: ReportTestStepResult[];
};

export type ReportStatus = TestStatus | "total";

export type ReportTestStepResult = TestStepResult;

type ReportBreadcrumbItem = string[] | string[][];

export interface ReportCategory {
  id?: string;
  name: string;
  grouping?: { key: string; value?: string; name?: string }[];
  description?: string;
  descriptionHtml?: string;
  messageRegex?: string;
  traceRegex?: string;
  matchedStatuses?: TestStatus[];
  flaky?: boolean;
}

export type ReportTestResult = Omit<
  TestResult,
  | "runSelector"
  | "sourceMetadata"
  | "expectedResult"
  | "expectedResultHtml"
  | "precondition"
  | "preconditionHtml"
  | "steps"
  | "categories"
  | "environment"
> & {
  isRetry: boolean;
  setup: ReportFixtureResult[];
  teardown: ReportFixtureResult[];
  steps: ReportTestStepResult[];
  history: HistoryTestResult[];
  retries?: TestResult[];
  retriesCount?: number;
  groupedLabels: Record<string, string[]>;
  attachments?: AttachmentTestStepResult[];
  breadcrumbs: ReportBreadcrumbItem[];
  order?: number;
  groupOrder?: number;
  retry: boolean;
  categories?: ReportCategory[];
  environment?: string | "default";
  tooltips?: Record<string, string>;
  time?: Record<string, string[]>;
  extra?: { severity: string };
};

export type ReportTreeLeaf = Pick<
  ReportTestResult,
  "duration" | "name" | "start" | "status" | "groupOrder" | "flaky" | "transition" | "retry" | "retriesCount"
> & {
  nodeId: string;
  id?: string;
  transitionTooltip?: string;
  tooltips?: Record<string, string>;
  tags?: string[];
  categories?: string[];
};

export type ReportTreeGroup = WithChildren & DefaultTreeGroup & { nodeId: string };

export type ReportTree = TreeData<ReportTreeLeaf, ReportTreeGroup>;

export type ReportQualityGateValidationResult = QualityGateValidationResult & {
  testResultsTree?: ReportTree;
};

export type ReportQualityGateResults = Record<string, ReportQualityGateValidationResult[]>;

export type ReportSearchDocument = {
  id: string;
  nodeId: string;
  name: string;
  fullName?: string;
  historyId?: string;
  labels?: string;
  owner?: string;
  tags?: string;
  parameters?: string;
  categories?: string;
  statusMessage?: string;
  links?: string;
};

/**
 * Tree which contains tree leaves instead of their IDs and recursive trees structure instead of groups.
 */
export type ReportRecursiveTree = DefaultTreeGroup & {
  nodeId: string;
  leaves: ReportTreeLeaf[];
  trees: ReportRecursiveTree[];
  duration?: number;
  groupOrder?: number;
  minStart?: number;
};

export type ReportTestResultGroup = Pick<ReportTestResult, "name" | "fullName" | "groupOrder"> & {
  testResults: ReportTestResult[];
};
