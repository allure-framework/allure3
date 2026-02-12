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

export type DashboardReportOptions = {
  allureVersion: string;
  reportName?: string;
  logo?: string;
  theme?: "light" | "dark";
  reportLanguage?: string;
  createdAt: number;
  reportUuid: string;
};
