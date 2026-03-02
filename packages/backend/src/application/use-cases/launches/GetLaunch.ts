import { ILaunchRepository } from '../../../domain/repositories/ILaunchRepository.js';
import { LaunchId } from '../../../domain/value-objects/LaunchId.js';
import { LaunchAdapter } from '../../adapters/LaunchAdapter.js';
import { LaunchResponse } from '../../dto/responses/LaunchResponse.js';

export class GetLaunch {
  constructor(private readonly launchRepository: ILaunchRepository) {}

  async execute(launchId: string): Promise<LaunchResponse | null> {
    const id = new LaunchId(launchId);
    const launch = await this.launchRepository.findById(id);
    
    if (!launch) {
      return null;
    }

    return LaunchAdapter.toDTO(launch);
  }
}
