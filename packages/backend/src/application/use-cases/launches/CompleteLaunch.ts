import { ILaunchRepository } from '../../../domain/repositories/ILaunchRepository.js';
import { LaunchId } from '../../../domain/value-objects/LaunchId.js';
import { LaunchAdapter } from '../../adapters/LaunchAdapter.js';
import { LaunchResponse } from '../../dto/responses/LaunchResponse.js';
import { LaunchCompleted } from '../../../domain/events/LaunchCompleted.js';

export interface EventBus {
  publish(event: any): Promise<void>;
}

export class CompleteLaunch {
  constructor(
    private readonly launchRepository: ILaunchRepository,
    private readonly eventBus?: EventBus
  ) {}

  async execute(launchId: string): Promise<LaunchResponse> {
    const id = new LaunchId(launchId);
    const launch = await this.launchRepository.findById(id);

    if (!launch) {
      throw new Error('Launch not found');
    }

    if (launch.isCompleted()) {
      throw new Error('Launch is already completed');
    }

    launch.complete();
    const statistic = launch.getStatistic();
    const totalTests = launch.getTestResults().length;

    await this.launchRepository.save(launch);

    // Publish domain event
    if (this.eventBus) {
      const event = new LaunchCompleted(launchId, id, totalTests, statistic);
      await this.eventBus.publish(event);
    }

    return LaunchAdapter.toDTO(launch);
  }
}
