import { DomainEvent } from './DomainEvent.js';
import { TestResultId } from '../value-objects/TestResultId.js';
import { LaunchId } from '../value-objects/LaunchId.js';

export class TestResultUploaded extends DomainEvent {
  constructor(
    aggregateId: string,
    private readonly testResultId: TestResultId,
    private readonly launchId: LaunchId,
    eventId?: string
  ) {
    super(aggregateId, eventId);
  }

  getTestResultId(): TestResultId {
    return this.testResultId;
  }

  getLaunchId(): LaunchId {
    return this.launchId;
  }
}
