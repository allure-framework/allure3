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

export type AllureAwesomeReportOptions = {
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

export type AllureAwesomeFixtureResult = Omit<
  TestFixtureResult,
  "testResultIds" | "start" | "stop" | "sourceMetadata" | "steps"
> & {
  steps: AllureAwesomeTestStepResult[];
};

export type AllureAwesomeStatus = TestStatus | "total";

export type AllureAwesomeTestStepResult = TestStepResult;

type AllureAwesomeBreadcrumbItem = string[] | string[][];

export interface AllureAwesomeCategory {
  name: string;
  description?: string;
  descriptionHtml?: string;
  messageRegex?: string;
  traceRegex?: string;
  matchedStatuses?: TestStatus[];
  flaky?: boolean;
}

export type AllureAwesomeTestResult = Omit<
  TestResult,
  | "runSelector"
  | "sourceMetadata"
  | "expectedResult"
  | "expectedResultHtml"
  | "precondition"
  | "preconditionHtml"
  | "steps"
> & {
  setup: AllureAwesomeFixtureResult[];
  teardown: AllureAwesomeFixtureResult[];
  steps: AllureAwesomeTestStepResult[];
  history: HistoryTestResult[];
  retries?: TestResult[];
  groupedLabels: Record<string, string[]>;
  attachments?: AttachmentTestStepResult[];
  breadcrumbs: AllureAwesomeBreadcrumbItem[];
  order?: number;
  groupOrder?: number;
  retry: boolean;
  categories?: AllureAwesomeCategory[];
};

export type AllureAwesomeTreeLeaf = Pick<
  AllureAwesomeTestResult,
  "duration" | "name" | "start" | "status" | "groupOrder" | "flaky" | "retry"
> & {
  nodeId: string;
};

export type AllureAwesomeTreeGroup = WithChildren & DefaultTreeGroup & { nodeId: string };

export type AllureAwesomeTree = TreeData<AllureAwesomeTreeLeaf, AllureAwesomeTreeGroup>;
/**
 * Tree which contains tree leaves instead of their IDs and recursive trees structure instead of groups
 */
export type AllureAwesomeRecursiveTree = DefaultTreeGroup & {
  nodeId: string;
  leaves: AllureAwesomeTreeLeaf[];
  trees: AllureAwesomeRecursiveTree[];
};
