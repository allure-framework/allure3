export abstract class DomainEvent {
  private readonly eventId: string;
  private readonly occurredOn: Date;
  private readonly aggregateId: string;

  constructor(aggregateId: string, eventId?: string) {
    this.aggregateId = aggregateId;
    this.eventId = eventId || this.generateEventId();
    this.occurredOn = new Date();
  }

  getEventId(): string {
    return this.eventId;
  }

  getOccurredOn(): Date {
    return this.occurredOn;
  }

  getAggregateId(): string {
    return this.aggregateId;
  }

  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
