import { DomainEvent } from './DomainEvent.js';
import { TestResultId } from '../value-objects/TestResultId.js';
import { Status } from '../value-objects/Status.js';
import { StatusTransition } from '../value-objects/StatusTransition.js';

export class TestResultStatusChanged extends DomainEvent {
  constructor(
    aggregateId: string,
    private readonly testResultId: TestResultId,
    private readonly previousStatus: Status | null,
    private readonly currentStatus: Status,
    private readonly transition: StatusTransition | null,
    eventId?: string
  ) {
    super(aggregateId, eventId);
  }

  getTestResultId(): TestResultId {
    return this.testResultId;
  }

  getPreviousStatus(): Status | null {
    return this.previousStatus;
  }

  getCurrentStatus(): Status {
    return this.currentStatus;
  }

  getTransition(): StatusTransition | null {
    return this.transition;
  }
}
