import { HistoryEntry } from '../../../../domain/entities/HistoryEntry.js';
import { HistoryId } from '../../../../domain/value-objects/HistoryId.js';
import { TestResultId } from '../../../../domain/value-objects/TestResultId.js';
import { LaunchId } from '../../../../domain/value-objects/LaunchId.js';
import { Status } from '../../../../domain/value-objects/Status.js';
import { HistoryEntity } from '../../entities/HistoryEntity.js';

export class HistoryMapper {
  static toEntity(domain: HistoryEntry): HistoryEntity {
    const entity = new HistoryEntity();
    entity.id = domain.getId();
    entity.historyId = domain.getHistoryId().getValue();
    entity.testResultId = domain.getTestResultId().getValue();
    entity.launchId = domain.getLaunchId().getValue();
    entity.status = domain.getStatus().getValue();
    entity.startTime = domain.getStartTime();
    entity.duration = domain.getDuration();

    return entity;
  }

  static toDomain(entity: HistoryEntity): HistoryEntry {
    const historyId = new HistoryId(entity.historyId);
    const testResultId = new TestResultId(entity.testResultId);
    const launchId = new LaunchId(entity.launchId);
    const status = new Status(entity.status as any);

    return new HistoryEntry(
      entity.id,
      historyId,
      testResultId,
      launchId,
      status,
      entity.startTime,
      entity.duration
    );
  }
}
