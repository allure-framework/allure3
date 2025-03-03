import type { Statistic } from "./aggregate.js";
import type { HistoryDataPoint, HistoryTestResult } from "./history.js";
import type { KnownTestFailure } from "./known.js";
import type { AttachmentLink, TestFixtureResult, TestResult } from "./model.js";
import type { ResultFile } from "./resultFile.js";
import type { TestCase } from "./testCase.js";

export interface AllureStore {
  // base state
  allTestCases: () => Promise<TestCase[]>;
  allTestResults: (options?: { includeHidden: boolean }) => Promise<TestResult[]>;
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
}
