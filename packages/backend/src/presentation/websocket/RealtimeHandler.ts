import { Server as SocketServer } from 'socket.io';
import { EventEmitterBus } from '../../infrastructure/messaging/EventEmitterBus.js';
import { TestResultUploaded } from '../../domain/events/TestResultUploaded.js';
import { LaunchCompleted } from '../../domain/events/LaunchCompleted.js';
import { SocketHandlers } from './socketHandlers.js';
import {
  TestResultUploadedEvent,
  LaunchCompletedEvent,
  LaunchCreatedEvent
} from './events.js';

export class RealtimeHandler {
  private socketHandlers: SocketHandlers;

  constructor(
    private io: SocketServer,
    private eventBus: EventEmitterBus
  ) {
    this.socketHandlers = new SocketHandlers(io);
    this.setupEventSubscriptions();
    this.setupSocketConnections();
  }

  private setupSocketConnections(): void {
    this.io.on('connection', (socket) => {
      this.socketHandlers.handleConnection(socket);
    });
  }

  private setupEventSubscriptions(): void {
    // Subscribe to TestResultUploaded domain event
    this.eventBus.subscribe(TestResultUploaded, async (event) => {
      const wsEvent: TestResultUploadedEvent = {
        type: 'test-result:uploaded',
        data: {
          testResultId: event.testResultId.getValue(),
          launchId: event.launchId.getValue()
        },
        timestamp: new Date().toISOString()
      };
      
      this.socketHandlers.broadcastToRoom(
        `launch:${event.launchId.getValue()}`,
        wsEvent.type,
        wsEvent.data
      );
    });

    // Subscribe to LaunchCompleted domain event
    this.eventBus.subscribe(LaunchCompleted, async (event) => {
      const wsEvent: LaunchCompletedEvent = {
        type: 'launch:completed',
        data: {
          launchId: event.launchId.getValue(),
          totalTests: event.totalTests
        },
        timestamp: new Date().toISOString()
      };
      
      this.socketHandlers.broadcastToRoom(
        `launch:${event.launchId.getValue()}`,
        wsEvent.type,
        wsEvent.data
      );
    });

    // TODO: Subscribe to other domain events as needed
    // - TestResultStatusChanged
    // - LaunchCreated
    // - WidgetUpdated
    // - ReportGenerated
  }

  // Helper method to emit custom events
  emitLaunchCreated(launchId: string, name: string): void {
    const wsEvent: LaunchCreatedEvent = {
      type: 'launch:created',
      data: {
        launchId,
        name
      },
      timestamp: new Date().toISOString()
    };
    
    this.socketHandlers.broadcastToRoom(
      `launch:${launchId}`,
      wsEvent.type,
      wsEvent.data
    );
  }
}
