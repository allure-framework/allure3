import type {
  AllureCheckResult,
  AttachmentLink,
  EnvironmentIdentity,
  GlobalAttachmentLink,
  HistoryDataPoint,
  HistoryTestResult,
  KnownTestFailure,
  QuarantineTestFailure,
  ReportVariables,
  Statistic,
  TestCase,
  TestEnvGroup,
  TestError,
  TestFixtureResult,
  TestResult,
} from "@allurereport/core-api";

import type { ExitCode, PluginGlobalError } from "./plugin.js";
import type { QualityGateValidationResult } from "./qualityGate.js";
import type { ResultFile } from "./resultFile.js";

export type TestResultFilter = (testResult: TestResult) => boolean;

export interface TestResultRelatedData {
  attachmentsByTrId: Map<string, AttachmentLink[]>;
  fixturesByTrId: Map<string, TestFixtureResult[]>;
  historyByTrId: Map<string, HistoryTestResult[] | undefined>;
  retriesByTrId: Map<string, TestResult[]>;
}

export interface AllureStore {
  // base state
  allTestCases: () => Promise<TestCase[]>;
  allTestResults: (options?: { includeRetries?: boolean; filter?: TestResultFilter }) => Promise<TestResult[]>;
  allAttachments: () => Promise<AttachmentLink[]>;
  allMetadata: () => Promise<Record<string, any>>;
  allFixtures: () => Promise<TestFixtureResult[]>;
  allHistoryDataPoints: () => Promise<HistoryDataPoint[]>;
  allHistoryDataPointsByEnvironment: (environment: string) => Promise<HistoryDataPoint[]>;
  allHistoryDataPointsByEnvironmentId: (environmentId: string) => Promise<HistoryDataPoint[]>;
  allKnownIssues: () => Promise<KnownTestFailure[]>;
  allQuarantineIssues: () => Promise<QuarantineTestFailure[]>;
  allNewTestResults: (filter?: TestResultFilter, history?: HistoryDataPoint[]) => Promise<TestResult[]>;
  // check data
  addCheckResult: (result: AllureCheckResult) => Promise<void>;
  allCheckResults: () => Promise<AllureCheckResult[]>;
  // quality gate data
  qualityGateResults: () => Promise<QualityGateValidationResult[]>;
  qualityGateResultsByEnv: () => Promise<Record<string, QualityGateValidationResult[]>>;
  qualityGateResultsByEnvironmentId: () => Promise<Record<string, QualityGateValidationResult[]>>;
  // global data
  globalExitCode: () => Promise<ExitCode | undefined>;
  allGlobalErrors: () => Promise<TestError[]>;
  allGlobalErrorsByEnv: () => Promise<Record<string, PluginGlobalError[]>>;
  allGlobalAttachments: () => Promise<GlobalAttachmentLink[]>;
  allGlobalAttachmentsByEnv: () => Promise<Record<string, GlobalAttachmentLink[]>>;
  // search api
  testCaseById: (tcId: string) => Promise<TestCase | undefined>;
  testResultById: (trId: string) => Promise<TestResult | undefined>;
  attachmentById: (attachmentId: string) => Promise<AttachmentLink | undefined>;
  attachmentContentById: (attachmentId: string) => Promise<ResultFile | undefined>;
  metadataByKey: <T>(key: string) => Promise<T | undefined>;
  testResultsByTcId: (tcId: string) => Promise<TestResult[]>;
  environmentIdByTrId: (trId: string) => Promise<string | undefined>;
  attachmentsByTrId: (trId: string) => Promise<AttachmentLink[]>;
  retriesByTr: (tr: TestResult) => Promise<TestResult[]>;
  retriesByTrId: (trId: string) => Promise<TestResult[]>;
  historyByTrId: (trId: string) => Promise<HistoryTestResult[] | undefined>;
  fixturesByTrId: (trId: string) => Promise<TestFixtureResult[]>;
  relatedByTestResultIds: (trIds: readonly string[]) => Promise<TestResultRelatedData>;
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
  allEnvironmentIdentities: () => Promise<EnvironmentIdentity[]>;
  testResultsByEnvironment: (env: string, options?: { includeRetries?: boolean }) => Promise<TestResult[]>;
  testResultsByEnvironmentId: (envId: string, options?: { includeRetries?: boolean }) => Promise<TestResult[]>;
  allTestEnvGroups: () => Promise<TestEnvGroup[]>;
  // variables
  allVariables: () => Promise<Record<string, any>>;
  envVariables: (env: string) => Promise<Record<string, any>>;
  envVariablesByEnvironmentId: (envId: string) => Promise<Record<string, any>>;
}

export interface AllureStoreDump {
  testResults: Record<string, TestResult>;
  attachments: Record<string, AttachmentLink>;
  globalAttachmentIds: string[];
  globalErrors: PluginGlobalError[];
  checkResults: Record<string, AllureCheckResult>;
  testCases: Record<string, TestCase>;
  fixtures: Record<string, TestFixtureResult>;
  environments: Array<string | EnvironmentIdentity>;
  reportVariables: ReportVariables;
  qualityGateResults: QualityGateValidationResult[];
  indexAttachmentByTestResult: Record<string, string[]>;
  indexTestResultByHistoryId: Record<string, string[]>;
  indexTestResultByTestCase: Record<string, string[]>;
  indexAttachmentByFixture: Record<string, string[]>;
  indexFixturesByTestResult: Record<string, string[]>;
  indexKnownByHistoryId: Record<string, KnownTestFailure[]>;
  indexQuarantineByHistoryId?: Record<string, QuarantineTestFailure[]>;
  /** Global ingest order of test result ids (append order in store). */
  testResultIdsIngestOrder: string[];
}

export enum AllureStoreDumpFiles {
  TestResults = "test-results.json",
  TestCases = "test-cases.json",
  Fixtures = "fixtures.json",
  GlobalErrors = "global-errors.json",
  GlobalAttachments = "global-attachments.json",
  Attachments = "attachments.json",
  CheckResults = "check-results.json",
  Environments = "environments.json",
  ReportVariables = "report-variables.json",
  IndexAttachmentsByTestResults = "index-attachments-by-test-results.json",
  IndexTestResultsByHistoryId = "index-test-results-by-history-id.json",
  IndexTestResultsByTestCase = "index-test-results-by-test-case.json",
  IndexAttachmentsByFixture = "index-attachments-by-fixture.json",
  IndexFixturesByTestResult = "index-fixtures-by-test-result.json",
  IndexKnownByHistoryId = "index-known-by-history-id.json",
  IndexQuarantineByHistoryId = "index-quarantine-by-history-id.json",
  QualityGateResults = "quality-gate-results.json",
  TestResultIngestOrder = "test-result-ingest-order.json",
}
