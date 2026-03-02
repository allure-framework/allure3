import { EventEmitterBus, EventHandler } from './EventEmitterBus.js';
import type { DomainEvent } from '../../../domain/events/DomainEvent.js';

export class DomainEventSubscriber {
  private handlers: Map<string, EventHandler<DomainEvent>[]> = new Map();

  constructor(private eventBus: EventEmitterBus) {}

  subscribeToEvent<T extends DomainEvent>(
    eventType: string | (new (...args: any[]) => T),
    handler: EventHandler<T>
  ): void {
    const type = typeof eventType === 'string' ? eventType : eventType.name;
    
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }

    this.handlers.get(type)!.push(handler as EventHandler<DomainEvent>);
    this.eventBus.subscribe(eventType, handler);
  }

  async handleEvent(event: DomainEvent): Promise<void> {
    const eventType = event.constructor.name;
    const handlers = this.handlers.get(eventType) || [];

    // Execute all handlers in parallel
    await Promise.all(
      handlers.map(async (handler) => {
        try {
          await handler(event);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
          throw error;
        }
      })
    );
  }

  registerHandler(eventType: string, handler: EventHandler<DomainEvent>): void {
    this.subscribeToEvent(eventType, handler);
  }

  unregisterHandler(eventType: string, handler: EventHandler<DomainEvent>): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
        this.eventBus.unsubscribe(eventType, handler);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
    this.eventBus.clear();
  }
}
