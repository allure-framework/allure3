import { Socket } from 'socket.io';
import { Server as SocketServer } from 'socket.io';
import { AllWebSocketEvents } from './events.js';

export class SocketHandlers {
  constructor(private io: SocketServer) {}

  handleConnection(socket: Socket): void {
    console.log(`Client connected: ${socket.id}`);

    // Handle joining launch room
    socket.on('join:launch', (launchId: string) => {
      const room = `launch:${launchId}`;
      socket.join(room);
      console.log(`Client ${socket.id} joined room ${room}`);
    });

    // Handle leaving launch room
    socket.on('leave:launch', (launchId: string) => {
      const room = `launch:${launchId}`;
      socket.leave(room);
      console.log(`Client ${socket.id} left room ${room}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  }

  handleDisconnection(socket: Socket): void {
    console.log(`Client disconnected: ${socket.id}`);
  }

  joinRoom(socket: Socket, launchId: string): void {
    const room = `launch:${launchId}`;
    socket.join(room);
  }

  leaveRoom(socket: Socket, launchId: string): void {
    const room = `launch:${launchId}`;
    socket.leave(room);
  }

  broadcastToRoom(room: string, event: string, data: any): void {
    this.io.to(room).emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  emitToSocket(socket: Socket, event: AllWebSocketEvents): void {
    socket.emit(event.type, {
      ...event.data,
      timestamp: event.timestamp
    });
  }
}
