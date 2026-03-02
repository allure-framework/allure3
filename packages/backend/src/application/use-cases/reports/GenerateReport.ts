import { ILaunchRepository } from '../../../domain/repositories/ILaunchRepository.js';
import { ITestResultRepository } from '../../../domain/repositories/ITestResultRepository.js';
import { LaunchId } from '../../../domain/value-objects/LaunchId.js';
import { LaunchResolutionService } from '../../services/LaunchResolutionService.js';
import { ReportGenerationService } from '../../services/ReportGenerationService.js';
import { PluginService } from '../../services/PluginService.js';
import type { AllureStore } from '@allurereport/plugin-api';

export interface GenerateReportOptions {
  format?: 'html' | 'json';
  environment?: string;
}

export interface ReportResponse {
  launchId: string;
  reportUuid: string;
  format: string;
  url: string;
  generatedAt: string;
}

export class GenerateReport {
  private readonly reportService: ReportGenerationService;

  constructor(
    private readonly launchRepository: ILaunchRepository,
    private readonly testResultRepository: ITestResultRepository,
    private readonly launchResolutionService: LaunchResolutionService
  ) {
    this.reportService = new ReportGenerationService(new PluginService());
  }

  async execute(launchId: string, options: GenerateReportOptions = {}): Promise<ReportResponse> {
    const id = new LaunchId(launchId);
    const launch = await this.launchRepository.findById(id);

    if (!launch) {
      throw new Error('Launch not found');
    }

    const launchIds = await this.launchResolutionService.resolveLaunchIdsForRead(launchId, options.environment);
    const testResults = await this.testResultRepository.findByLaunchIds(launchIds);

    // Prepare AllureStore
    const store = await this.reportService.prepareAllureStore(testResults);

    // Generate report
    const format = options.format || 'html';
    const reportUuid = crypto.randomUUID();
    const outputPath = `/reports/${launchId}/${reportUuid}`;

    if (format === 'html') {
      await this.reportService.generateHtmlReport(store, outputPath);
    } else {
      await this.reportService.generateJsonReport(store, outputPath);
    }

    // Update launch with report UUID
    // This would require extending Launch entity or using a separate service

    return {
      launchId,
      reportUuid,
      format,
      url: `/api/v1/reports/${reportUuid}`,
      generatedAt: new Date().toISOString()
    };
  }
}
