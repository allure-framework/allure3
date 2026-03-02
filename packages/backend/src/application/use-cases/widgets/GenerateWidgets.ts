import { ILaunchRepository } from '../../../domain/repositories/ILaunchRepository.js';
import { ITestResultRepository } from '../../../domain/repositories/ITestResultRepository.js';
import { LaunchId } from '../../../domain/value-objects/LaunchId.js';
import { WidgetService } from '../../services/WidgetService.js';
import { PluginService } from '../../services/PluginService.js';

export class GenerateWidgets {
  private readonly widgetService: WidgetService;

  constructor(
    private readonly launchRepository: ILaunchRepository,
    private readonly testResultRepository: ITestResultRepository,
    private readonly pluginService: PluginService
  ) {
    this.widgetService = new WidgetService();
  }

  async execute(launchId: string): Promise<void> {
    const id = new LaunchId(launchId);
    const launch = await this.launchRepository.findById(id);

    if (!launch) {
      throw new Error('Launch not found');
    }

    // Get all test results for launch
    const testResults = await this.testResultRepository.findByLaunchId(id);

    // Generate widgets
    const widgets = this.widgetService.generateAllWidgets(testResults);

    // Apply plugin transformations
    for (const [name, data] of widgets.entries()) {
      const transformedData = await this.pluginService.applyPlugins(data, 'aggregator');
      widgets.set(name, transformedData);
    }

    // Store generated widgets (cache or database)
    // This will be implemented in Infrastructure layer
  }
}
