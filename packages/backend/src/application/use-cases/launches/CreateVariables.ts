import type { ILaunchRepository } from '../../../domain/repositories/ILaunchRepository.js';
import type { ILaunchVariablesRepository } from '../../../domain/repositories/ILaunchVariablesRepository.js';
import { LaunchId } from '../../../domain/value-objects/LaunchId.js';
import type { CreateVariablesRequest } from '../../dto/requests/CreateVariablesRequest.js';
import { NotFoundError } from '../../../presentation/api/middleware/errorHandler.js';

export class CreateVariables {
  constructor(
    private readonly launchRepository: ILaunchRepository,
    private readonly launchVariablesRepository: ILaunchVariablesRepository
  ) {}

  async execute(launchId: string, request: CreateVariablesRequest): Promise<void> {
    const id = new LaunchId(launchId);
    const exists = await this.launchRepository.exists(id);
    if (!exists) {
      throw new NotFoundError('Launch', launchId);
    }

    const current = (await this.launchVariablesRepository.findByLaunchId(launchId)) ?? {};
    const merged = { ...current, ...request };

    await this.launchVariablesRepository.save(launchId, merged);
  }
}
