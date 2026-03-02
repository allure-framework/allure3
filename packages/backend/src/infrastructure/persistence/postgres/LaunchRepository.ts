import { DataSource, IsNull, Repository } from 'typeorm';
import { ILaunchRepository } from '../../../../domain/repositories/ILaunchRepository.js';
import { Launch } from '../../../../domain/entities/Launch.js';
import { LaunchId } from '../../../../domain/value-objects/LaunchId.js';
import { LaunchEntity } from '../entities/LaunchEntity.js';
import { LaunchMapper } from './mappers/LaunchMapper.js';

export class LaunchRepository implements ILaunchRepository {
  private repository: Repository<LaunchEntity>;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository('LaunchEntity') as Repository<LaunchEntity>;
  }

  async save(launch: Launch): Promise<void> {
    const entity = LaunchMapper.toEntity(launch);
    await this.repository.save(entity);
  }

  async findById(id: LaunchId): Promise<Launch | null> {
    const entity = await this.repository.findOne({
      where: { id: id.getValue() },
      relations: ['testResults', 'testResults.labels', 'testResults.parameters', 'testResults.links']
    });

    if (!entity) {
      return null;
    }

    return LaunchMapper.toDomain(entity);
  }

  async findAll(): Promise<Launch[]> {
    const entities = await this.repository.find({
      relations: ['testResults', 'testResults.labels', 'testResults.parameters', 'testResults.links'],
      order: { startTime: 'DESC' }
    });

    return entities.map((entity) => LaunchMapper.toDomain(entity));
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Launch[]> {
    const entities = await this.repository
      .createQueryBuilder('launch')
      .leftJoinAndSelect('launch.testResults', 'testResults')
      .leftJoinAndSelect('testResults.labels', 'labels')
      .leftJoinAndSelect('testResults.parameters', 'parameters')
      .leftJoinAndSelect('testResults.links', 'links')
      .where('launch.startTime >= :startDate', { startDate })
      .andWhere('launch.startTime <= :endDate', { endDate })
      .orderBy('launch.startTime', 'DESC')
      .getMany();

    return entities.map((entity) => LaunchMapper.toDomain(entity));
  }

  async findByRunKey(runKey: string): Promise<Launch | null> {
    const entity = await this.repository.findOne({
      where: { runKey, parentLaunchId: IsNull() }
    });
    if (!entity) return null;
    return LaunchMapper.toDomain(entity);
  }

  async findChildLaunchIds(parentLaunchId: LaunchId): Promise<LaunchId[]> {
    const entities = await this.repository.find({
      where: { parentLaunchId: parentLaunchId.getValue() },
      select: ['id']
    });
    return entities.map((e) => new LaunchId(e.id));
  }

  async findChildLaunches(parentLaunchId: LaunchId): Promise<Array<{ id: string; name: string }>> {
    const entities = await this.repository.find({
      where: { parentLaunchId: parentLaunchId.getValue() },
      select: ['id', 'name']
    });
    return entities.map((e) => ({ id: e.id, name: e.name }));
  }

  async delete(id: LaunchId): Promise<void> {
    await this.repository.delete(id.getValue());
  }

  async exists(id: LaunchId): Promise<boolean> {
    const count = await this.repository.count({
      where: { id: id.getValue() }
    });
    return count > 0;
  }
}
