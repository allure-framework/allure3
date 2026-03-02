import { DataSource, Repository } from 'typeorm';
import type { ILaunchVariablesRepository, ReportVariables } from '../../../../domain/repositories/ILaunchVariablesRepository.js';
import { LaunchVariablesEntity } from '../entities/LaunchVariablesEntity.js';

export class LaunchVariablesRepository implements ILaunchVariablesRepository {
  private repository: Repository<LaunchVariablesEntity>;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(LaunchVariablesEntity);
  }

  async save(launchId: string, variables: ReportVariables): Promise<void> {
    await this.repository.upsert(
      {
        launchId,
        variables
      },
      { conflictPaths: ['launchId'] }
    );
  }

  async findByLaunchId(launchId: string): Promise<ReportVariables | null> {
    const entity = await this.repository.findOne({
      where: { launchId }
    });

    if (!entity) {
      return null;
    }

    return entity.variables ?? {};
  }
}
