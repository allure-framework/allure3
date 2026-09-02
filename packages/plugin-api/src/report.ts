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

export type AwesomeRunSummary = {
  start: number;
  stop: number;
  duration: number;
};

export type AwesomeExecutorInfo = {
  name?: string;
  type?: string;
  url?: string;
  buildOrder?: number;
  buildName?: string;
  buildUrl?: string;
  reportName?: string;
  reportUrl?: string;
};

export type AwesomeReportOptions = {
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
  cacheKey: string;
  ci?: CiDescriptor;
  executor?: AwesomeExecutorInfo;
  runSummary?: AwesomeRunSummary;
  stepTreeExpansion?: StepTreeExpansion;
  defaultSortBy?: string;
};

export type AwesomeFixtureResult = Omit<
  TestFixtureResult,
  "testResultIds" | "start" | "stop" | "sourceMetadata" | "steps"
> & {
  steps: AwesomeTestStepResult[];
};

export type AwesomeStatus = TestStatus | "total";

export type AwesomeTestStepResult = TestStepResult;

type AwesomeBreadcrumbItem = string[] | string[][];

export interface AwesomeCategory {
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

export type AwesomeTestResult = Omit<
  TestResult,
  | "runSelector"
  | "sourceMetadata"
  | "expectedResult"
  | "expectedResultHtml"
  | "precondition"
  | "preconditionHtml"
  | "steps"
  | "environment"
> & {
  isRetry: boolean;
  setup: AwesomeFixtureResult[];
  teardown: AwesomeFixtureResult[];
  steps: AwesomeTestStepResult[];
  history: HistoryTestResult[];
  retries?: TestResult[];
  retriesCount?: number;
  groupedLabels: Record<string, string[]>;
  attachments?: AttachmentTestStepResult[];
  breadcrumbs: AwesomeBreadcrumbItem[];
  order?: number;
  groupOrder?: number;
  retry: boolean;
  categories?: AwesomeCategory[];
  environment?: string | "default";
  tooltips?: Record<string, string>;
};

export type AwesomeTreeLeaf = Pick<
  AwesomeTestResult,
  "duration" | "name" | "start" | "status" | "groupOrder" | "flaky" | "transition" | "retry" | "retriesCount" | "id"
> & {
  nodeId: string;
  transitionTooltip?: string;
  tooltips?: Record<string, string>;
  tags?: string[];
  categories?: string[];
};

export type AwesomeTreeGroup = WithChildren & DefaultTreeGroup & { nodeId: string };

export type AwesomeTree = TreeData<AwesomeTreeLeaf, AwesomeTreeGroup>;

export type AwesomeQualityGateValidationResult = QualityGateValidationResult & {
  testResultsTree?: AwesomeTree;
};

export type AwesomeQualityGateResults = Record<string, AwesomeQualityGateValidationResult[]>;

export type AwesomeSearchDocument = {
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
export type AwesomeRecursiveTree = DefaultTreeGroup & {
  nodeId: string;
  leaves: AwesomeTreeLeaf[];
  trees: AwesomeRecursiveTree[];
  duration: number;
  groupOrder: number;
  minStart?: number;
};

export type AwesomeTestResultGroup = Pick<AwesomeTestResult, "name" | "fullName" | "groupOrder"> & {
  testResults: AwesomeTestResult[];
};

export type Allure2ReportOptions = {
  reportName?: string;
  reportLanguage?: string;
  createdAt: number;
};

export type ClassicReportOptions = {
  reportName?: string;
  logo?: string;
  theme?: "light" | "dark" | "auto";
  groupBy?: string[];
  reportLanguage?: string;
  createdAt: number;
  reportUuid: string;
  allureVersion?: string;
  cacheKey?: string;
};

export type ClassicFixtureResult = Omit<
  TestFixtureResult,
  "testResultIds" | "start" | "stop" | "sourceMetadata" | "steps"
> & {
  steps: ClassicTestStepResult[];
};

export type ClassicStatus = TestStatus | "total";

export type ClassicTestStepResult = TestStepResult;

type ClassicBreadcrumbItem = string[] | string[][];

export type ClassicTestResult = Omit<
  TestResult,
  | "runSelector"
  | "sourceMetadata"
  | "expectedResult"
  | "expectedResultHtml"
  | "precondition"
  | "preconditionHtml"
  | "steps"
> & {
  isRetry: boolean;
  setup: ClassicFixtureResult[];
  teardown: ClassicFixtureResult[];
  steps: ClassicTestStepResult[];
  history: HistoryTestResult[];
  retries?: TestResult[];
  groupedLabels: Record<string, string[]>;
  attachments?: AttachmentTestStepResult[];
  breadcrumbs: ClassicBreadcrumbItem[];
  order?: number;
  groupOrder?: number;
  retry: boolean;
  time?: Record<string, string[]>;
  extra?: { severity: string };
};

export type ClassicTreeLeaf = Pick<
  ClassicTestResult,
  "duration" | "name" | "start" | "status" | "groupOrder" | "flaky" | "retry"
> & {
  nodeId: string;
};

export type ClassicTreeGroup = WithChildren & DefaultTreeGroup & { nodeId: string };

export type ClassicTree = TreeData<ClassicTreeLeaf, ClassicTreeGroup>;

/**
 * Tree which contains tree leaves instead of their IDs and recursive trees structure instead of groups.
 */
export type ClassicRecursiveTree = DefaultTreeGroup & {
  nodeId: string;
  leaves: ClassicTreeLeaf[];
  trees: ClassicRecursiveTree[];
};

export type DashboardReportOptions = {
  allureVersion: string;
  reportName?: string;
  logo?: string;
  theme?: "light" | "dark";
  reportLanguage?: string;
  createdAt: number;
  reportUuid: string;
};
