import type { AllureStore } from '@allurereport/plugin-api';
import { TestResult } from '../../domain/entities/TestResult.js';
import { TestResultAdapter } from '../adapters/TestResultAdapter.js';
import { PluginService } from './PluginService.js';

export class ReportGenerationService {
  constructor(private readonly pluginService: PluginService) {}

  async generateHtmlReport(store: AllureStore, outputPath: string): Promise<void> {
    // Generate HTML report using Allure 3 core
    // This will be implemented with actual Allure 3 integration
    // await allureReport.generate({ store, outputPath, format: 'html' });
  }

  async generateJsonReport(store: AllureStore, outputPath: string): Promise<string> {
    // Generate JSON report
    // This will be implemented with actual Allure 3 integration
    return outputPath;
  }

  async prepareAllureStore(results: ReadonlyArray<TestResult>): Promise<AllureStore> {
    // Convert domain entities to DTOs
    const dtos = results.map((result) => TestResultAdapter.toDTO(result));

    // Create AllureStore implementation
    // This will be implemented in Infrastructure layer
    const store: AllureStore = {
      allTestCases: async () => [],
      allTestResults: async () => dtos,
      allAttachments: async () => [],
      allMetadata: async () => ({}),
      allFixtures: async () => [],
      allHistoryDataPoints: async () => [],
      allHistoryDataPointsByEnvironment: async () => [],
      allKnownIssues: async () => [],
      allNewTestResults: async () => [],
      qualityGateResults: async () => [],
      globalExitCode: async () => undefined,
      allGlobalErrors: async () => [],
      allGlobalAttachments: async () => [],
      testCaseById: async () => undefined,
      testResultById: async (id) => dtos.find((dto) => dto.id === id),
      attachmentById: async () => undefined,
      attachmentContentById: async () => undefined,
      metadataByKey: async () => undefined,
      testResultsByTcId: async () => [],
      attachmentsByTrId: async () => [],
      retriesByTr: async () => [],
      retriesByTrId: async () => [],
      historyByTrId: async () => undefined,
      fixturesByTrId: async () => [],
      failedTestResults: async () => dtos.filter((dto) => dto.status === 'failed' || dto.status === 'broken'),
      unknownFailedTestResults: async () => [],
      testResultsByLabel: async () => ({ _: [] }),
      testsStatistic: async () => ({ total: dtos.length }),
      allEnvironments: async () => [],
      testResultsByEnvironment: async () => [],
      allTestEnvGroups: async () => [],
      allVariables: async () => ({}),
      envVariables: async () => ({})
    };

    return store;
  }
}
