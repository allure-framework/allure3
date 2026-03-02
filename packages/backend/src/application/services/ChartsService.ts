import { defaultChartsConfig } from '@allurereport/charts-api';
import { generateCharts } from '@allurereport/web-commons';
import { LaunchScopedAllureStore } from '../../infrastructure/adapters/LaunchScopedAllureStore.js';
import { ITestResultRepository } from '../../domain/repositories/ITestResultRepository.js';
import { ILaunchRepository } from '../../domain/repositories/ILaunchRepository.js';
import { randomUUID } from 'node:crypto';

/**
 * Generates charts widget data for a launch.
 * Uses web-commons generateCharts with LaunchScopedAllureStore.
 */
export class ChartsService {
  constructor(
    private readonly testResultRepository: ITestResultRepository,
    private readonly launchRepository: ILaunchRepository
  ) {}

  async generateChartsWidget(
    launchIds: string[],
    _launchId?: string,
    _environment?: string
  ): Promise<{ general: Record<string, unknown>; byEnv: Record<string, Record<string, unknown>> }> {
    if (launchIds.length === 0) {
      return { general: {}, byEnv: {} };
    }

    const store = new LaunchScopedAllureStore(
      launchIds,
      this.testResultRepository,
      this.launchRepository
    );

    const generateUuid = () => randomUUID();
    const reportName = 'Allure Report';

    const chartsData = await generateCharts(
      defaultChartsConfig,
      store,
      reportName,
      generateUuid
    );

    return chartsData;
  }
}
