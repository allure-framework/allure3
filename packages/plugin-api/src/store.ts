import type {
  AttachmentLink,
  HistoryDataPoint,
  HistoryTestResult,
  KnownTestFailure,
  ReportVariables,
  Statistic,
  TestCase,
  TestEnvGroup,
  TestError,
  TestFixtureResult,
  TestResult,
} from "@allurereport/core-api";
import type { ExitCode } from "./plugin.js";
import type { QualityGateValidationResult } from "./qualityGate.js";
import type { ResultFile } from "./resultFile.js";

export type TestResultFilter = (testResult: TestResult) => boolean;

export interface AllureStore {
  // base state
  allTestCases: () => Promise<TestCase[]>;
  allTestResults: (options?: { includeHidden?: boolean; filter?: TestResultFilter }) => Promise<TestResult[]>;
  allAttachments: () => Promise<AttachmentLink[]>;
  allMetadata: () => Promise<Record<string, any>>;
  allFixtures: () => Promise<TestFixtureResult[]>;
  allHistoryDataPoints: () => Promise<HistoryDataPoint[]>;
  allHistoryDataPointsByEnvironment: (environment: string) => Promise<HistoryDataPoint[]>;
  allKnownIssues: () => Promise<KnownTestFailure[]>;
  allNewTestResults: (filter?: TestResultFilter) => Promise<TestResult[]>;
  // quality gate data
  qualityGateResults: () => Promise<QualityGateValidationResult[]>;
  // global data
  globalExitCode: () => Promise<ExitCode | undefined>;
  allGlobalErrors: () => Promise<TestError[]>;
  allGlobalAttachments: () => Promise<AttachmentLink[]>;
  // search api
  testCaseById: (tcId: string) => Promise<TestCase | undefined>;
  testResultById: (trId: string) => Promise<TestResult | undefined>;
  attachmentById: (attachmentId: string) => Promise<AttachmentLink | undefined>;
  attachmentContentById: (attachmentId: string) => Promise<ResultFile | undefined>;
  metadataByKey: <T>(key: string) => Promise<T | undefined>;
  testResultsByTcId: (tcId: string) => Promise<TestResult[]>;
  attachmentsByTrId: (trId: string) => Promise<AttachmentLink[]>;
  retriesByTr: (tr: TestResult) => Promise<TestResult[]>;
  retriesByTrId: (trId: string) => Promise<TestResult[]>;
  historyByTrId: (trId: string) => Promise<HistoryTestResult[] | undefined>;
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

export interface AllureStoreDump {
  testResults: Record<string, TestResult>;
  attachments: Record<string, AttachmentLink>;
  globalAttachmentIds: string[];
  globalErrors: TestError[];
  testCases: Record<string, TestCase>;
  fixtures: Record<string, TestFixtureResult>;
  environments: string[];
  reportVariables: ReportVariables;
  qualityGateResultsByRules: Record<string, QualityGateValidationResult>;
  indexAttachmentByTestResult: Record<string, string[]>;
  indexTestResultByHistoryId: Record<string, string[]>;
  indexTestResultByTestCase: Record<string, string[]>;
  indexLatestEnvTestResultByHistoryId: Record<string, string>;
  indexAttachmentByFixture: Record<string, string[]>;
  indexFixturesByTestResult: Record<string, string[]>;
  indexKnownByHistoryId: Record<string, KnownTestFailure[]>;
}

export enum AllureStoreDumpFiles {
  TestResults = "test-results.json",
  TestCases = "test-cases.json",
  Fixtures = "fixtures.json",
  GlobalErrors = "global-errors.json",
  GlobalAttachments = "global-attachments.json",
  Attachments = "attachments.json",
  Environments = "environments.json",
  ReportVariables = "report-variables.json",
  IndexAttachmentsByTestResults = "index-attachments-by-test-results.json",
  IndexTestResultsByHistoryId = "index-test-results-by-history-id.json",
  IndexTestResultsByTestCase = "index-test-results-by-test-case.json",
  IndexLatestEnvTestResultsByHistoryId = "index-latest-env-test-results-by-history-id.json",
  IndexAttachmentsByFixture = "index-attachments-by-fixture.json",
  IndexFixturesByTestResult = "index-fixtures-by-test-result.json",
  IndexKnownByHistoryId = "index-known-by-history-id.json",
  QualityGateResultsByRules = "quality-gate-results-by-rules.json",
}
