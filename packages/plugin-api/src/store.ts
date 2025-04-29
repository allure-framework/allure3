import type {
  AttachmentLink,
  HistoryDataPoint,
  HistoryTestResult,
  KnownTestFailure,
  RepoData,
  Statistic,
  TestCase,
  TestEnvGroup,
  TestFixtureResult,
  TestResult,
} from "@allurereport/core-api";
import type { ResultFile } from "./resultFile.js";

export type TestResultFilter = (testResult: TestResult) => boolean;

export interface AllureStore {
  // git state
  repoData: () => Promise<RepoData | undefined>;
  // base state
  allTestCases: () => Promise<TestCase[]>;
  allTestResults: (options?: { includeHidden?: boolean }) => Promise<TestResult[]>;
  allAttachments: () => Promise<AttachmentLink[]>;
  allMetadata: () => Promise<Record<string, any>>;
  allFixtures: () => Promise<TestFixtureResult[]>;
  allHistoryDataPoints: () => Promise<HistoryDataPoint[]>;
  allKnownIssues: () => Promise<KnownTestFailure[]>;
  // search api
  testCaseById: (tcId: string) => Promise<TestCase | undefined>;
  testResultById: (trId: string) => Promise<TestResult | undefined>;
  attachmentById: (attachmentId: string) => Promise<AttachmentLink | undefined>;
  attachmentContentById: (attachmentId: string) => Promise<ResultFile | undefined>;
  metadataByKey: <T>(key: string) => Promise<T | undefined>;
  testResultsByTcId: (tcId: string) => Promise<TestResult[]>;
  attachmentsByTrId: (trId: string) => Promise<AttachmentLink[]>;
  retriesByTrId: (trId: string) => Promise<TestResult[]>;
  historyByTrId: (trId: string) => Promise<HistoryTestResult[]>;
  fixturesByTrId: (trId: string) => Promise<TestFixtureResult[]>;
  // aggregate api
  failedTestResults: () => Promise<TestResult[]>;
  unknownFailedTestResults: () => Promise<TestResult[]>;
  testResultsByLabel: (labelName: string) => Promise<{
    _: TestResult[];
    [x: string]: TestResult[];
  }>;
  testsStatistic: (filter?: (testResult: TestResult) => boolean) => Promise<Statistic>;
  // environments
  allEnvironments: () => Promise<string[]>;
  testResultsByEnvironment: (env: string) => Promise<TestResult[]>;
  allTestEnvGroups: () => Promise<TestEnvGroup[]>;
  // variables
  allVariables: () => Promise<Record<string, any>>;
  envVariables: (env: string) => Promise<Record<string, any>>;
}
