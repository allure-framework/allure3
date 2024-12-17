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

export type AllureAwesomeReportOptions = {
  reportName?: string;
  logo?: string;
  theme?: "light" | "dark";
  reportLanguage?: "en" | "ru";
  createdAt: number;
  reportUuid: string;
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
};

export type AllureAwesomeTree = TreeData<AllureAwesomeTestResult, DefaultTreeGroup>;

export type AllureAwesomeTreeLeaf = AllureAwesomeTestResult & { nodeId: string };

export type AllureAwesomeTreeGroup = WithChildren & DefaultTreeGroup & { nodeId: string };

export type AllureAwesomeOrderedTree = DefaultTreeGroup & {
  nodeId: string;
  leaves: AllureAwesomeTreeLeaf[];
  groups: AllureAwesomeOrderedTree[];
};
