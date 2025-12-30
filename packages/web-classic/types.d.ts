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
  reportLanguage?: "en";
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
 * Tree which contains tree leaves instead of their IDs and recursive trees structure instead of groups
 */
export type ClassicRecursiveTree = DefaultTreeGroup & {
  nodeId: string;
  leaves: ClassicTreeLeaf[];
  trees: ClassicRecursiveTree[];
};
