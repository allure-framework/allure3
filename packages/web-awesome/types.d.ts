import type {
  AttachmentTestStepResult,
  DefaultTreeGroup,
  HistoryTestResult,
  TestFixtureResult,
  TestResult,
  TestStatus,
  TestStepResult,
  TreeData,
  WithChildren,
} from "@allurereport/core-api";

export type Layout = "base" | "split";

export type AwesomeReportOptions = {
  allureVersion: string;
  reportName?: string;
  logo?: string;
  theme?: "light" | "dark";
  groupBy?: string[];
  reportLanguage?: "en" | "ru";
  createdAt: number;
  reportUuid: string;
  layout?: Layout;
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
  name: string;
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
  setup: AwesomeFixtureResult[];
  teardown: AwesomeFixtureResult[];
  steps: AwesomeTestStepResult[];
  history: HistoryTestResult[];
  retries?: TestResult[];
  groupedLabels: Record<string, string[]>;
  attachments?: AttachmentTestStepResult[];
  breadcrumbs: AwesomeBreadcrumbItem[];
  order?: number;
  groupOrder?: number;
  retry: boolean;
  categories?: AwesomeCategory[];
  environment?: string | "default";
};

export type AwesomeTreeLeaf = Pick<
  AwesomeTestResult,
  "duration" | "name" | "start" | "status" | "groupOrder" | "flaky" | "retry"
> & {
  nodeId: string;
};

export type AwesomeTreeGroup = WithChildren & DefaultTreeGroup & { nodeId: string };

export type AwesomeTree = TreeData<AwesomeTreeLeaf, AwesomeTreeGroup>;
/**
 * Tree which contains tree leaves instead of their IDs and recursive trees structure instead of groups
 */
export type AwesomeRecursiveTree = DefaultTreeGroup & {
  nodeId: string;
  leaves: AwesomeTreeLeaf[];
  trees: AwesomeRecursiveTree[];
};

// TODO: maybe it should call `TestCase` instead of Group
// TODO: add worst status
export type AwesomeTestResultGroup = Pick<AwesomeTestResult, "name" | "fullName" | "groupOrder"> & {
  testResults: AwesomeTestResult[];
}
