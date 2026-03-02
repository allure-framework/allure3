import { describe, it, expect } from 'vitest';
import { DomainEvent } from '../../../../src/domain/events/DomainEvent.js';

// Create a concrete implementation for testing
class TestDomainEvent extends DomainEvent {
  constructor(aggregateId: string, eventId?: string) {
    super(aggregateId, eventId);
  }
}

describe('DomainEvent', () => {
  it('should create domain event with aggregate ID', () => {
    const event = new TestDomainEvent('aggregate-id');
    expect(event.getAggregateId()).toBe('aggregate-id');
    expect(event.getEventId()).toBeDefined();
    expect(event.getOccurredOn()).toBeInstanceOf(Date);
  });

  it('should create domain event with custom event ID', () => {
    const event = new TestDomainEvent('aggregate-id', 'custom-event-id');
    expect(event.getEventId()).toBe('custom-event-id');
  });

  it('should set occurredOn to current time', () => {
    const before = new Date();
    const event = new TestDomainEvent('aggregate-id');
    const after = new Date();
    const occurredOn = event.getOccurredOn();
    expect(occurredOn.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(occurredOn.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
