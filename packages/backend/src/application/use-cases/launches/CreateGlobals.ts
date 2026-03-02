import { ILaunchRepository } from '../../../domain/repositories/ILaunchRepository.js';
import { ILaunchGlobalsRepository } from '../../../domain/repositories/ILaunchGlobalsRepository.js';
import { LaunchId } from '../../../domain/value-objects/LaunchId.js';
import type { CreateGlobalsRequest } from '../../dto/requests/CreateGlobalsRequest.js';
import { NotFoundError } from '../../../presentation/api/middleware/errorHandler.js';

export class CreateGlobals {
  constructor(
    private readonly launchRepository: ILaunchRepository,
    private readonly launchGlobalsRepository: ILaunchGlobalsRepository
  ) {}

  async execute(launchId: string, request: CreateGlobalsRequest): Promise<void> {
    const id = new LaunchId(launchId);
    const exists = await this.launchRepository.exists(id);
    if (!exists) {
      throw new NotFoundError('Launch', launchId);
    }

    const existing = await this.launchGlobalsRepository.findByLaunchId(launchId);
    const exitCodeOriginal = request.exitCode?.original ?? existing?.exitCodeOriginal ?? 0;
    const exitCodeActual = request.exitCode?.actual ?? existing?.exitCodeActual ?? null;
    const errors = request.errors ?? existing?.errors ?? [];
    const allureEnvironment = request.allureEnvironment ?? existing?.allureEnvironment ?? [];

    await this.launchGlobalsRepository.save({
      launchId,
      exitCodeOriginal,
      exitCodeActual,
      errors,
      allureEnvironment
    });
  }
}
