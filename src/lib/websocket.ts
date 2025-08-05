import { Server as HttpServer } from 'http';

import { Server as SocketIOServer } from 'socket.io';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

// WebSocket event types
export interface JobUpdateEvent {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'pending';
  progress: number;
  message?: string;
  result?: unknown;
}

export interface NotificationEvent {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export interface AccountUpdatedEvent {
  accountId: string;
  changes: unknown;
}

export interface InsightGeneratedEvent {
  insightId: string;
  accountId: string;
  type: string;
}

// Global WebSocket server instance
let io: SocketIOServer | null = null;

// Initialize WebSocket server
export function initializeWebSocket(httpServer: HttpServer) {
  if (io) {
    return io;
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/api/socket.io',
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify the token using NextAuth
      // Note: In a real implementation, you'd validate the JWT token
      // For now, we'll accept any token for development
      socket.data.userId = socket.handshake.auth.userId;
      next();
    } catch (error) {
      console.error('WebSocket auth error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    console.log(`User ${userId} connected to WebSocket`);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected from WebSocket`);
    });

    // Handle custom events
    socket.on('join-account', (accountId: string) => {
      socket.join(`account:${accountId}`);
    });

    socket.on('leave-account', (accountId: string) => {
      socket.leave(`account:${accountId}`);
    });
  });

  return io;
}

// WebSocket event emitters
export class WebSocketEmitter {
  static emitJobUpdate(userId: string, event: JobUpdateEvent) {
    if (!io) return;
    io.to(`user:${userId}`).emit('job-update', event);
  }

  static emitNotification(userId: string, event: NotificationEvent) {
    if (!io) return;
    io.to(`user:${userId}`).emit('notification', event);
  }

  static emitAccountUpdated(accountId: string, event: AccountUpdatedEvent) {
    if (!io) return;
    io.to(`account:${accountId}`).emit('account-updated', event);
  }

  static emitInsightGenerated(accountId: string, event: InsightGeneratedEvent) {
    if (!io) return;
    io.to(`account:${accountId}`).emit('insight-generated', event);
  }

  static emitToUser(userId: string, eventName: string, data: any) {
    if (!io) return;
    io.to(`user:${userId}`).emit(eventName, data);
  }

  static emitToAccount(accountId: string, eventName: string, data: any) {
    if (!io) return;
    io.to(`account:${accountId}`).emit(eventName, data);
  }

  static broadcast(eventName: string, data: any) {
    if (!io) return;
    io.emit(eventName, data);
  }
}

// Get WebSocket server instance
export function getWebSocketServer() {
  return io;
}

// WebSocket connection status
export function isWebSocketConnected() {
  return io !== null;
}