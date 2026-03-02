import { DataSource, Repository } from 'typeorm';
import { IHistoryRepository } from '../../../../domain/repositories/IHistoryRepository.js';
import { HistoryEntry } from '../../../../domain/entities/HistoryEntry.js';
import { HistoryId } from '../../../../domain/value-objects/HistoryId.js';
import { TestResultId } from '../../../../domain/value-objects/TestResultId.js';
import { HistoryEntity } from '../entities/HistoryEntity.js';
import { HistoryMapper } from './mappers/HistoryMapper.js';

export class HistoryRepository implements IHistoryRepository {
  private repository: Repository<HistoryEntity>;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository('HistoryEntity') as Repository<HistoryEntity>;
  }

  async save(entry: HistoryEntry): Promise<void> {
    const entity = HistoryMapper.toEntity(entry);
    await this.repository.save(entity);
  }

  async findByHistoryId(historyId: HistoryId): Promise<HistoryEntry[]> {
    const entities = await this.repository.find({
      where: { historyId: historyId.getValue() },
      order: { startTime: 'DESC' }
    });

    return entities.map((entity) => HistoryMapper.toDomain(entity));
  }

  async findByTestResultId(testResultId: TestResultId): Promise<HistoryEntry[]> {
    const entities = await this.repository.find({
      where: { testResultId: testResultId.getValue() },
      order: { startTime: 'DESC' }
    });

    return entities.map((entity) => HistoryMapper.toDomain(entity));
  }

  async findLatestByHistoryId(historyId: HistoryId): Promise<HistoryEntry | null> {
    const entity = await this.repository.findOne({
      where: { historyId: historyId.getValue() },
      order: { startTime: 'DESC' }
    });

    if (!entity) {
      return null;
    }

    return HistoryMapper.toDomain(entity);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
