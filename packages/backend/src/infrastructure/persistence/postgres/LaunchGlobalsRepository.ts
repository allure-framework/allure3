import { DataSource, Repository } from 'typeorm';
import type { ILaunchGlobalsRepository, LaunchGlobalsData } from '../../../../domain/repositories/ILaunchGlobalsRepository.js';
import { LaunchGlobalsEntity } from '../entities/LaunchGlobalsEntity.js';

export class LaunchGlobalsRepository implements ILaunchGlobalsRepository {
  private repository: Repository<LaunchGlobalsEntity>;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(LaunchGlobalsEntity);
  }

  async save(data: LaunchGlobalsData): Promise<void> {
    await this.repository.upsert(
      {
        launchId: data.launchId,
        exitCodeOriginal: data.exitCodeOriginal,
        exitCodeActual: data.exitCodeActual,
        errors: data.errors,
        allureEnvironment: data.allureEnvironment ?? []
      },
      { conflictPaths: ['launchId'] }
    );
  }

  async findByLaunchId(launchId: string): Promise<LaunchGlobalsData | null> {
    const entity = await this.repository.findOne({
      where: { launchId }
    });

    if (!entity) {
      return null;
    }

    return {
      launchId: entity.launchId,
      exitCodeOriginal: entity.exitCodeOriginal,
      exitCodeActual: entity.exitCodeActual,
      errors: entity.errors,
      allureEnvironment: entity.allureEnvironment ?? []
    };
  }
}
