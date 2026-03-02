import { EventEmitter } from 'events';
import type { DomainEvent } from '../../../domain/events/DomainEvent.js';

export type EventHandler<T extends DomainEvent> = (event: T) => Promise<void> | void;

export class EventEmitterBus extends EventEmitter {
  async publish(event: DomainEvent): Promise<void> {
    const eventType = event.constructor.name;
    this.emit(eventType, event);
    
    // Also emit to wildcard listeners
    this.emit('*', event);
  }

  subscribe<T extends DomainEvent>(
    eventType: string | (new (...args: any[]) => T),
    handler: EventHandler<T>
  ): void {
    const type = typeof eventType === 'string' ? eventType : eventType.name;
    
    this.on(type, async (event: T) => {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Error handling event ${type}:`, error);
        // Emit error event
        this.emit('error', { eventType: type, event, error });
      }
    });
  }

  unsubscribe<T extends DomainEvent>(
    eventType: string | (new (...args: any[]) => T),
    handler: EventHandler<T>
  ): void {
    const type = typeof eventType === 'string' ? eventType : eventType.name;
    this.off(type, handler as any);
  }

  clear(): void {
    this.removeAllListeners();
  }

  // Helper method to subscribe to all events
  subscribeToAll(handler: EventHandler<DomainEvent>): void {
    this.on('*', async (event: DomainEvent) => {
      try {
        await handler(event);
      } catch (error) {
        console.error('Error handling wildcard event:', error);
      }
    });
  }
}
