import type { AllureStore } from '@allurereport/plugin-api';
import type {
  TestResult as TestResultDTO,
  TestCase,
  TestFixtureResult,
  AttachmentLink,
  Statistic,
  HistoryDataPoint,
  TestEnvGroup,
  HistoryTestResult,
  ExitCode,
  ResultFile,
  KnownTestFailure,
  QualityGateValidationResult,
  TestError as TestErrorDTO
} from '@allurereport/core-api';
import { ITestResultRepository } from '../../domain/repositories/ITestResultRepository.js';
import { IAttachmentRepository } from '../../domain/repositories/IAttachmentRepository.js';
import { IHistoryRepository } from '../../domain/repositories/IHistoryRepository.js';
import { TestResultAdapter } from '../../application/adapters/TestResultAdapter.js';
import { AttachmentAdapter } from '../../application/adapters/AttachmentAdapter.js';
import { TestResultId } from '../../domain/value-objects/TestResultId.js';
import { AttachmentId } from '../../domain/value-objects/AttachmentId.js';

export class DatabaseAllureStore implements AllureStore {
  constructor(
    private readonly testResultRepository: ITestResultRepository,
    private readonly attachmentRepository: IAttachmentRepository,
    private readonly historyRepository: IHistoryRepository,
    private readonly baseUrl: string = ''
  ) {}

  async allTestCases(): Promise<TestCase[]> {
    // Get all test results and extract test cases
    // Note: This requires a launch context - for now return empty
    // In production, this should be scoped to a launch
    return [];
  }

  async allTestResults(options?: { includeHidden?: boolean; filter?: (testResult: TestResultDTO) => boolean }): Promise<TestResultDTO[]> {
    // This should be scoped to a launch
    // For now, return empty array - will be implemented with launch context
    return [];
  }

  async allAttachments(): Promise<AttachmentLink[]> {
    // This should be scoped to a launch
    // For now, return empty array
    return [];
  }

  async allMetadata(): Promise<Record<string, any>> {
    // Collect metadata from all test results
    const metadata: Record<string, any> = {};
    // Implementation would collect metadata from sourceMetadata fields
    return metadata;
  }

  async allFixtures(): Promise<TestFixtureResult[]> {
    // Fixtures are not stored separately in our schema
    // They would be extracted from test results if needed
    return [];
  }

  async allHistoryDataPoints(): Promise<HistoryDataPoint[]> {
    // Convert history entries to HistoryDataPoint format
    // This is a simplified implementation
    return [];
  }

  async allHistoryDataPointsByEnvironment(environment: string): Promise<HistoryDataPoint[]> {
    return [];
  }

  async allKnownIssues(): Promise<KnownTestFailure[]> {
    // Extract known issues from test results with known=true
    return [];
  }

  async allNewTestResults(filter?: (testResult: TestResultDTO) => boolean): Promise<TestResultDTO[]> {
    // Get test results with transition='new'
    return [];
  }

  async qualityGateResults(): Promise<QualityGateValidationResult[]> {
    return [];
  }

  async globalExitCode(): Promise<ExitCode | undefined> {
    return undefined;
  }

  async allGlobalErrors(): Promise<TestErrorDTO[]> {
    return [];
  }

  async allGlobalAttachments(): Promise<AttachmentLink[]> {
    return [];
  }

  async testCaseById(id: string): Promise<TestCase | undefined> {
    const testResult = await this.testResultRepository.findById(new TestResultId(id));
    if (!testResult) {
      return undefined;
    }
    return testResult.getTestCase() || undefined;
  }

  async testResultById(id: string): Promise<TestResultDTO | undefined> {
    const testResult = await this.testResultRepository.findById(new TestResultId(id));
    if (!testResult) {
      return undefined;
    }
    return TestResultAdapter.toDTO(testResult);
  }

  async attachmentById(id: string): Promise<AttachmentLink | undefined> {
    const attachment = await this.attachmentRepository.findById(new AttachmentId(id));
    if (!attachment) {
      return undefined;
    }
    // Convert to AttachmentLink format expected by Allure
    return {
      uid: attachment.getUid(),
      name: attachment.getName() || undefined,
      source: attachment.getUid(),
      type: attachment.getContentType() || undefined,
      size: attachment.getContentLength() || undefined
    } as AttachmentLink;
  }

  async attachmentContentById(id: string): Promise<ResultFile | undefined> {
    // This would require storage service integration
    return undefined;
  }

  async metadataByKey(key: string): Promise<any> {
    const metadata = await this.allMetadata();
    return metadata[key];
  }

  async testResultsByTcId(tcId: string): Promise<TestResultDTO[]> {
    // Find test results by test case ID
    // This would require a query by testCaseId
    return [];
  }

  async attachmentsByTrId(trId: string): Promise<AttachmentLink[]> {
    // Find attachments by test result ID
    // This would require extending AttachmentRepository
    return [];
  }

  async retriesByTr(tr: TestResultDTO): Promise<TestResultDTO[]> {
    const testResult = await this.testResultRepository.findById(new TestResultId(tr.id));
    if (!testResult) {
      return [];
    }
    return testResult.getRetries().map((retry) => TestResultAdapter.toDTO(retry));
  }

  async retriesByTrId(trId: string): Promise<TestResultDTO[]> {
    const testResult = await this.testResultRepository.findById(new TestResultId(trId));
    if (!testResult) {
      return [];
    }
    return testResult.getRetries().map((retry) => TestResultAdapter.toDTO(retry));
  }

  async historyByTrId(trId: string): Promise<HistoryTestResult[] | undefined> {
    const testResult = await this.testResultRepository.findById(new TestResultId(trId));
    if (!testResult || !testResult.getHistoryId()) {
      return undefined;
    }
    const historyEntries = await this.historyRepository.findByHistoryId(testResult.getHistoryId()!);
    // Convert to HistoryTestResult format
    // This would require HistoryAdapter
    return undefined; // Simplified - should return HistoryTestResult[]
  }

  async fixturesByTrId(trId: string): Promise<TestFixtureResult[]> {
    return [];
  }

  async failedTestResults(): Promise<TestResultDTO[]> {
    // This would require Status filtering
    return [];
  }

  async unknownFailedTestResults(): Promise<TestResultDTO[]> {
    return [];
  }

  async testResultsByLabel(labelName: string): Promise<Record<string, TestResultDTO[]>> {
    const results = await this.testResultRepository.findByLabel(labelName);
    const grouped: Record<string, TestResultDTO[]> = {
      _: results.map((r) => TestResultAdapter.toDTO(r))
    };
    return grouped;
  }

  async testsStatistic(filter?: (testResult: TestResultDTO) => boolean): Promise<Statistic> {
    // Calculate statistics from all test results
    // This would require aggregation
    return {
      total: 0,
      failed: 0,
      broken: 0,
      passed: 0,
      skipped: 0,
      unknown: 0
    };
  }

  async allEnvironments(): Promise<string[]> {
    // Extract unique environments from test results
    return [];
  }

  async testResultsByEnvironment(env: string): Promise<TestResultDTO[]> {
    // Filter test results by environment
    return [];
  }

  async allTestEnvGroups(): Promise<TestEnvGroup[]> {
    return [];
  }

  async allVariables(): Promise<Record<string, string>> {
    return {};
  }

  async envVariables(): Promise<Record<string, string>> {
    return {};
  }
}
