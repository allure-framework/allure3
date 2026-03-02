import { TestResult } from '../../../domain/entities/TestResult.js';
import { WidgetService } from '../../services/WidgetService.js';
import { ChartsService } from '../../services/ChartsService.js';
import { LaunchResolutionService } from '../../services/LaunchResolutionService.js';
import { ITestResultRepository } from '../../../domain/repositories/ITestResultRepository.js';
import type { ILaunchGlobalsRepository } from '../../../domain/repositories/ILaunchGlobalsRepository.js';
import type { ILaunchVariablesRepository } from '../../../domain/repositories/ILaunchVariablesRepository.js';
import type { IAttachmentRepository } from '../../../domain/repositories/IAttachmentRepository.js';
import { WidgetResponse } from '../../dto/responses/WidgetResponse.js';

export class GetWidgetData {
  private readonly widgetService: WidgetService;

  constructor(
    private readonly testResultRepository: ITestResultRepository,
    private readonly launchResolutionService: LaunchResolutionService,
    private readonly launchGlobalsRepository?: ILaunchGlobalsRepository,
    private readonly launchVariablesRepository?: ILaunchVariablesRepository,
    private readonly attachmentRepository?: IAttachmentRepository,
    private readonly chartsService?: ChartsService
  ) {
    this.widgetService = new WidgetService(
      testResultRepository,
      launchGlobalsRepository,
      launchVariablesRepository,
      attachmentRepository
    );
  }

  async execute(widgetName: string, launchId?: string, environment?: string): Promise<WidgetResponse | null> {
    if (widgetName === 'globals') {
      const launchIds = launchId
        ? await this.launchResolutionService.resolveLaunchIdsForRead(launchId, environment)
        : [];
      const data = await this.widgetService.generateGlobalsWidget(launchIds);
      return {
        name: 'globals',
        type: 'globals',
        data
      };
    }

    if (widgetName === 'tree-filters') {
      const launchIds = launchId
        ? await this.launchResolutionService.resolveLaunchIdsForRead(launchId, environment)
        : [];
      const data = await this.widgetService.generateTreeFiltersWidget(launchIds);
      return {
        name: 'tree-filters',
        type: 'tree-filters',
        data
      };
    }

    if (widgetName === 'variables') {
      const launchIds = launchId
        ? await this.launchResolutionService.resolveLaunchIdsForRead(launchId, environment)
        : [];
      const data = await this.widgetService.generateVariablesWidget(launchId, launchIds, environment);
      return {
        name: 'variables',
        type: 'variables',
        data
      };
    }

    if (widgetName === 'allure_environment') {
      const launchIds = launchId
        ? await this.launchResolutionService.resolveLaunchIdsForRead(launchId, environment)
        : [];
      const data = await this.widgetService.generateAllureEnvironmentWidget(launchIds);
      return {
        name: 'allure_environment',
        type: 'allure_environment',
        data
      };
    }

    if (widgetName === 'timeline') {
      const launchIds = launchId
        ? await this.launchResolutionService.resolveLaunchIdsForRead(launchId, environment)
        : [];
      const data = await this.widgetService.generateTimelineWidget(launchIds);
      return {
        name: 'timeline',
        type: 'timeline',
        data
      };
    }

    if (widgetName === 'quality-gate') {
      return {
        name: 'quality-gate',
        type: 'quality-gate',
        data: []
      };
    }

    if (widgetName === 'charts') {
      if (!this.chartsService || !launchId) {
        return null;
      }
      const launchIds = await this.launchResolutionService.resolveLaunchIdsForRead(launchId, environment);
      const data = await this.chartsService.generateChartsWidget(launchIds, launchId, environment);
      return {
        name: 'charts',
        type: 'charts',
        data
      };
    }

    let results: TestResult[];

    if (launchId) {
      const launchIds = await this.launchResolutionService.resolveLaunchIdsForRead(launchId, environment);
      results = await this.testResultRepository.findByLaunchIds(launchIds);
    } else {
      results = [];
    }

    const widgets = this.widgetService.generateAllWidgets(results);
    const widgetData = widgets.get(widgetName);

    if (!widgetData) {
      return null;
    }

    return {
      name: widgetName,
      type: widgetName,
      data: widgetData
    };
  }
}
