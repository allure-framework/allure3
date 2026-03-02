import type { AllureStore } from '@allurereport/plugin-api';
import type {
  TestResult as TestResultDTO,
  TestCase,
  TestFixtureResult,
  AttachmentLink,
  Statistic,
  HistoryDataPoint,
  HistoryTestResult,
  TestEnvGroup,
  TestError as TestErrorDTO,
  ResultFile
} from '@allurereport/core-api';
import { LaunchId } from '../../domain/value-objects/LaunchId.js';
import { ITestResultRepository } from '../../domain/repositories/ITestResultRepository.js';
import { ILaunchRepository } from '../../domain/repositories/ILaunchRepository.js';
import { TestResultAdapter } from '../../application/adapters/TestResultAdapter.js';
import { TestResultId } from '../../domain/value-objects/TestResultId.js';
import { TestResult } from '../../domain/entities/TestResult.js';

/**
 * AllureStore implementation scoped to a launch context.
 * Used by ChartsService to generate charts from test results.
 * Implements only the methods required by generateCharts from web-commons.
 */
export class LaunchScopedAllureStore implements AllureStore {
  constructor(
    private readonly launchIds: string[],
    private readonly testResultRepository: ITestResultRepository,
    private readonly launchRepository: ILaunchRepository
  ) {}

  async allTestCases(): Promise<TestCase[]> {
    return [];
  }

  async allTestResults(options?: {
    includeHidden?: boolean;
    filter?: (testResult: TestResultDTO) => boolean;
  }): Promise<TestResultDTO[]> {
    if (this.launchIds.length === 0) return [];
    const results = await this.testResultRepository.findByLaunchIds(this.launchIds);
    let dtos = results.map((r) => TestResultAdapter.toDTO(r));
    if (options?.filter) {
      dtos = dtos.filter(options.filter);
    }
    return dtos;
  }

  async allAttachments(): Promise<AttachmentLink[]> {
    return [];
  }

  async allMetadata(): Promise<Record<string, unknown>> {
    return {};
  }

  async allFixtures(): Promise<TestFixtureResult[]> {
    return [];
  }

  async allHistoryDataPoints(): Promise<HistoryDataPoint[]> {
    const points: HistoryDataPoint[] = [];
    for (const launchId of this.launchIds) {
      const launch = await this.launchRepository.findById(new LaunchId(launchId));
      if (!launch) continue;
      const results = launch.getTestResults();
      const testResults: Record<string, HistoryTestResult> = {};
      for (const tr of results) {
        const key = tr.getHistoryId()?.getValue() ?? tr.getId().getValue();
        const timeRange = tr.getTimeRange();
        const error = tr.getError();
        testResults[key] = {
          id: tr.getId().getValue(),
          name: tr.getName().getValue(),
          fullName: tr.getFullName() ?? undefined,
          environment: tr.getEnvironment() ?? undefined,
          status: tr.getStatus().getValue(),
          error: error
            ? {
                message: error.getMessage() ?? undefined,
                trace: error.getTrace() ?? undefined,
                actual: error.getActual() ?? undefined,
                expected: error.getExpected() ?? undefined
              }
            : undefined,
          start: timeRange.getStart() ?? undefined,
          stop: timeRange.getStop() ?? undefined,
          duration: timeRange.getDuration() ?? undefined,
          labels: tr.getLabels().map((l) => ({ name: l.getName(), value: l.getValue() ?? undefined })),
          url: '',
          historyId: tr.getHistoryId()?.getValue()
        };
      }
      points.push({
        uuid: launchId,
        name: launch.getName(),
        timestamp: launch.getStartTime().getTime(),
        knownTestCaseIds: [],
        testResults,
        metrics: {},
        url: ''
      });
    }
    return points.sort((a, b) => a.timestamp - b.timestamp);
  }

  async allHistoryDataPointsByEnvironment(environment: string): Promise<HistoryDataPoint[]> {
    const all = await this.allHistoryDataPoints();
    if (this.launchIds.includes(environment)) {
      return all.filter((p) => p.uuid === environment);
    }
    return all;
  }

  async allKnownIssues(): Promise<unknown[]> {
    return [];
  }

  async allNewTestResults(): Promise<TestResultDTO[]> {
    return [];
  }

  async qualityGateResults(): Promise<unknown[]> {
    return [];
  }

  async globalExitCode(): Promise<unknown> {
    return undefined;
  }

  async allGlobalErrors(): Promise<TestErrorDTO[]> {
    return [];
  }

  async allGlobalAttachments(): Promise<AttachmentLink[]> {
    return [];
  }

  async testCaseById(): Promise<TestCase | undefined> {
    return undefined;
  }

  async testResultById(id: string): Promise<TestResultDTO | undefined> {
    const tr = await this.testResultRepository.findById(new TestResultId(id));
    return tr ? TestResultAdapter.toDTO(tr) : undefined;
  }

  async attachmentById(): Promise<AttachmentLink | undefined> {
    return undefined;
  }

  async attachmentContentById(): Promise<ResultFile | undefined> {
    return undefined;
  }

  async metadataByKey(): Promise<unknown> {
    return undefined;
  }

  async testResultsByTcId(): Promise<TestResultDTO[]> {
    return [];
  }

  async attachmentsByTrId(): Promise<AttachmentLink[]> {
    return [];
  }

  async retriesByTr(tr: TestResultDTO): Promise<TestResultDTO[]> {
    const domain = await this.testResultRepository.findById(new TestResultId(tr.id));
    return domain ? domain.getRetries().map((r) => TestResultAdapter.toDTO(r)) : [];
  }

  async retriesByTrId(trId: string): Promise<TestResultDTO[]> {
    const domain = await this.testResultRepository.findById(new TestResultId(trId));
    return domain ? domain.getRetries().map((r) => TestResultAdapter.toDTO(r)) : [];
  }

  async historyByTrId(): Promise<HistoryTestResult[] | undefined> {
    return undefined;
  }

  async fixturesByTrId(): Promise<TestFixtureResult[]> {
    return [];
  }

  async failedTestResults(): Promise<TestResultDTO[]> {
    const all = await this.allTestResults();
    return all.filter((tr) => tr.status === 'failed' || tr.status === 'broken');
  }

  async unknownFailedTestResults(): Promise<TestResultDTO[]> {
    return [];
  }

  async testResultsByLabel(): Promise<Record<string, TestResultDTO[]>> {
    return { _: [] };
  }

  async testsStatistic(filter?: (testResult: TestResultDTO) => boolean): Promise<Statistic> {
    const results = await this.allTestResults({ filter });
    const statistic: Statistic = {
      total: results.length,
      passed: 0,
      failed: 0,
      broken: 0,
      skipped: 0,
      unknown: 0
    };
    for (const tr of results) {
      switch (tr.status) {
        case 'passed':
          statistic.passed = (statistic.passed ?? 0) + 1;
          break;
        case 'failed':
          statistic.failed = (statistic.failed ?? 0) + 1;
          break;
        case 'broken':
          statistic.broken = (statistic.broken ?? 0) + 1;
          break;
        case 'skipped':
          statistic.skipped = (statistic.skipped ?? 0) + 1;
          break;
        case 'unknown':
          statistic.unknown = (statistic.unknown ?? 0) + 1;
          break;
      }
    }
    return statistic;
  }

  async allEnvironments(): Promise<string[]> {
    if (this.launchIds.length <= 1) {
      return ['default'];
    }
    return this.launchIds;
  }

  async testResultsByEnvironment(env: string): Promise<TestResultDTO[]> {
    const all = await this.allTestResults();
    if (this.launchIds.includes(env)) {
      const results = await this.testResultRepository.findByLaunchId(new LaunchId(env));
      return results.map((r) => TestResultAdapter.toDTO(r));
    }
    return all.filter((tr) => tr.environment === env);
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
