import { DomainEvent } from './DomainEvent.js';
import { LaunchId } from '../value-objects/LaunchId.js';
import type { Statistic } from '../types/Statistic.js';

export class LaunchCompleted extends DomainEvent {
  constructor(
    aggregateId: string,
    private readonly launchId: LaunchId,
    private readonly totalTests: number,
    private readonly statistic: Statistic,
    eventId?: string
  ) {
    super(aggregateId, eventId);
  }

  getLaunchId(): LaunchId {
    return this.launchId;
  }

  getTotalTests(): number {
    return this.totalTests;
  }

  getStatistic(): Statistic {
    return this.statistic;
  }
}
