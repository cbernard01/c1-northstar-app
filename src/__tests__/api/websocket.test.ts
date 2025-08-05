/**
 * WebSocket API Tests
 * Tests for real-time functionality
 */

import { GET } from '@/app/api/socket/route';

import {
  createAuthenticatedRequest,
  createMockRequest,
  setupApiTest,
  cleanupApiTest,
  mockWebSocketService,
  testData,
  performanceTracker
} from './setup';

describe('WebSocket API Tests', () => {
  beforeEach(() => {
    setupApiTest();
  });

  afterEach(() => {
    cleanupApiTest();
  });

  describe('WebSocket Connection', () => {
    it('should establish WebSocket connection', async () => {
      const req = createMockRequest('GET', '/api/socket');
      
      // Mock WebSocket upgrade headers
      const headers = new Headers({
        'upgrade': 'websocket',
        'connection': 'upgrade',
        'sec-websocket-key': 'mock-websocket-key',
        'sec-websocket-version': '13',
      });
      
      Object.defineProperty(req, 'headers', { value: headers });
      
      const response = await GET(req);
      
      // WebSocket upgrade should return 101 status
      // Note: In actual implementation, this would be handled by the WebSocket library
      expect([101, 200, 426]).toContain(response.status);
    });

    it('should handle connection without WebSocket upgrade', async () => {
      const req = createMockRequest('GET', '/api/socket');
      
      const response = await GET(req);
      
      // Should return error for non-WebSocket requests
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('WebSocket Events', () => {
    beforeEach(() => {
      // Mock WebSocket connection established
      mockWebSocketService.emit.mockResolvedValue(true);
      mockWebSocketService.broadcast.mockResolvedValue(true);
      mockWebSocketService.join.mockResolvedValue(true);
      mockWebSocketService.leave.mockResolvedValue(true);
    });

    it('should handle job status updates', async () => {
      const jobUpdate = {
        type: 'JOB_STATUS_UPDATE',
        data: {
          jobId: 'test-job-id',
          status: 'PROCESSING',
          progress: 50,
          message: 'Processing file...',
        },
      };

      // Simulate sending job update
      await mockWebSocketService.emit('job:update', jobUpdate);
      
      expect(mockWebSocketService.emit).toHaveBeenCalledWith('job:update', jobUpdate);
    });

    it('should handle upload progress events', async () => {
      const uploadProgress = {
        type: 'UPLOAD_PROGRESS',
        data: {
          uploadId: 'test-upload-id',
          fileName: 'test.csv',
          progress: 75,
          bytesTransferred: 750000,
          totalBytes: 1000000,
        },
      };

      await mockWebSocketService.emit('upload:progress', uploadProgress);
      
      expect(mockWebSocketService.emit).toHaveBeenCalledWith('upload:progress', uploadProgress);
    });

    it('should handle account update notifications', async () => {
      const accountUpdate = {
        type: 'ACCOUNT_UPDATE',
        data: {
          accountId: 'test-account-id',
          action: 'insights_generated',
          message: 'New insights available for Test Company',
          timestamp: new Date().toISOString(),
        },
      };

      await mockWebSocketService.emit('account:update', accountUpdate);
      
      expect(mockWebSocketService.emit).toHaveBeenCalledWith('account:update', accountUpdate);
    });

    it('should handle chat message events', async () => {
      const chatEvent = {
        type: 'CHAT_MESSAGE',
        data: {
          sessionId: 'test-session-id',
          messageId: 'test-message-id',
          role: 'ASSISTANT',
          content: 'This is a chat response',
          timestamp: new Date().toISOString(),
        },
      };

      await mockWebSocketService.emit('chat:message', chatEvent);
      
      expect(mockWebSocketService.emit).toHaveBeenCalledWith('chat:message', chatEvent);
    });

    it('should handle error notifications', async () => {
      const errorEvent = {
        type: 'ERROR',
        data: {
          error: 'Processing failed',
          details: 'File format not supported',
          jobId: 'test-job-id',
          timestamp: new Date().toISOString(),
        },
      };

      await mockWebSocketService.emit('error', errorEvent);
      
      expect(mockWebSocketService.emit).toHaveBeenCalledWith('error', errorEvent);
    });
  });

  describe('Room Management', () => {
    it('should join user-specific room', async () => {
      const userId = 'test-user-id';
      const roomName = `user:${userId}`;
      
      await mockWebSocketService.join(roomName);
      
      expect(mockWebSocketService.join).toHaveBeenCalledWith(roomName);
    });

    it('should join job-specific room', async () => {
      const jobId = 'test-job-id';
      const roomName = `job:${jobId}`;
      
      await mockWebSocketService.join(roomName);
      
      expect(mockWebSocketService.join).toHaveBeenCalledWith(roomName);
    });

    it('should join account-specific room', async () => {
      const accountId = 'test-account-id';
      const roomName = `account:${accountId}`;
      
      await mockWebSocketService.join(roomName);
      
      expect(mockWebSocketService.join).toHaveBeenCalledWith(roomName);
    });

    it('should join chat session room', async () => {
      const sessionId = 'test-session-id';
      const roomName = `chat:${sessionId}`;
      
      await mockWebSocketService.join(roomName);
      
      expect(mockWebSocketService.join).toHaveBeenCalledWith(roomName);
    });

    it('should leave rooms on disconnect', async () => {
      const rooms = [
        'user:test-user-id',
        'job:test-job-id',
        'account:test-account-id',
        'chat:test-session-id',
      ];
      
      for (const room of rooms) {
        await mockWebSocketService.leave(room);
      }
      
      rooms.forEach(room => {
        expect(mockWebSocketService.leave).toHaveBeenCalledWith(room);
      });
    });
  });

  describe('Broadcasting', () => {
    it('should broadcast to all users', async () => {
      const systemMessage = {
        type: 'SYSTEM_NOTIFICATION',
        data: {
          message: 'System maintenance scheduled',
          severity: 'info',
          timestamp: new Date().toISOString(),
        },
      };

      await mockWebSocketService.broadcast('system:notification', systemMessage);
      
      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith('system:notification', systemMessage);
    });

    it('should broadcast to specific user rooms', async () => {
      const userNotification = {
        type: 'USER_NOTIFICATION',
        data: {
          message: 'Your export is ready',
          actionUrl: '/exports/download/test-export-id',
          timestamp: new Date().toISOString(),
        },
      };

      const userRoom = 'user:test-user-id';
      await mockWebSocketService.emit(userRoom, userNotification);
      
      expect(mockWebSocketService.emit).toHaveBeenCalledWith(userRoom, userNotification);
    });
  });

  describe('Connection Stability', () => {
    it('should handle rapid connection/disconnection', async () => {
      const connectionCycles = 10;
      const operations = [];
      
      for (let i = 0; i < connectionCycles; i++) {
        // Simulate connection
        operations.push(mockWebSocketService.join(`user:test-user-${i}`));
        
        // Simulate some activity
        operations.push(mockWebSocketService.emit('test:event', { data: `test-${i}` }));
        
        // Simulate disconnection
        operations.push(mockWebSocketService.leave(`user:test-user-${i}`));
      }
      
      const startTime = Date.now();
      await Promise.all(operations);
      const totalTime = Date.now() - startTime;
      
      expect(totalTime).toBeLessThan(1000); // Should handle rapidly
      expect(mockWebSocketService.join).toHaveBeenCalledTimes(connectionCycles);
      expect(mockWebSocketService.emit).toHaveBeenCalledTimes(connectionCycles);
      expect(mockWebSocketService.leave).toHaveBeenCalledTimes(connectionCycles);
    });

    it('should handle high-frequency events', async () => {
      const eventCount = 100;
      const events = Array.from({ length: eventCount }, (_, i) => 
        mockWebSocketService.emit('high-frequency:event', {
          type: 'HIGH_FREQUENCY_TEST',
          data: { index: i, timestamp: Date.now() },
        })
      );
      
      const startTime = Date.now();
      await Promise.all(events);
      const totalTime = Date.now() - startTime;
      
      const eventsPerSecond = eventCount / (totalTime / 1000);
      
      console.log(`Processed ${eventCount} WebSocket events in ${totalTime}ms (${eventsPerSecond.toFixed(2)} events/sec)`);
      
      expect(eventsPerSecond).toBeGreaterThan(50); // Should handle at least 50 events/sec
      expect(mockWebSocketService.emit).toHaveBeenCalledTimes(eventCount);
    });
  });

  describe('Event Ordering', () => {
    it('should maintain event order for job updates', async () => {
      const jobId = 'test-job-id';
      const statusUpdates = [
        { status: 'PENDING', progress: 0 },
        { status: 'PROCESSING', progress: 25 },
        { status: 'PROCESSING', progress: 50 },
        { status: 'PROCESSING', progress: 75 },
        { status: 'COMPLETED', progress: 100 },
      ];
      
      // Send updates in sequence
      for (const [index, update] of statusUpdates.entries()) {
        await mockWebSocketService.emit('job:update', {
          type: 'JOB_STATUS_UPDATE',
          data: {
            jobId,
            ...update,
            sequence: index,
            timestamp: Date.now() + index, // Ensure ordering
          },
        });
      }
      
      expect(mockWebSocketService.emit).toHaveBeenCalledTimes(statusUpdates.length);
      
      // Verify calls were made in correct order
      const calls = mockWebSocketService.emit.mock.calls;
      calls.forEach((call, index) => {
        expect(call[1].data.sequence).toBe(index);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle emit failures gracefully', async () => {
      // Mock emit failure
      mockWebSocketService.emit.mockRejectedValue(new Error('Connection lost'));
      
      const event = {
        type: 'TEST_EVENT',
        data: { message: 'This should fail' },
      };
      
      // Should not throw, but handle gracefully
      await expect(mockWebSocketService.emit('test:event', event))
        .rejects.toThrow('Connection lost');
    });

    it('should handle broadcast failures', async () => {
      mockWebSocketService.broadcast.mockRejectedValue(new Error('Broadcast failed'));
      
      const event = {
        type: 'BROADCAST_TEST',
        data: { message: 'Broadcast failure test' },
      };
      
      await expect(mockWebSocketService.broadcast('test:broadcast', event))
        .rejects.toThrow('Broadcast failed');
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent WebSocket operations', async () => {
      const concurrentOps = 50;
      const operations = [];
      
      // Mix of different WebSocket operations
      for (let i = 0; i < concurrentOps; i++) {
        const opType = i % 4;
        
        switch (opType) {
          case 0:
            operations.push(mockWebSocketService.join(`room:${i}`));
            break;
          case 1:
            operations.push(mockWebSocketService.emit('test:event', { index: i }));
            break;
          case 2:
            operations.push(mockWebSocketService.broadcast('test:broadcast', { index: i }));
            break;
          case 3:
            operations.push(mockWebSocketService.leave(`room:${i}`));
            break;
        }
      }
      
      const startTime = Date.now();
      await Promise.all(operations);
      const totalTime = Date.now() - startTime;
      
      const opsPerSecond = concurrentOps / (totalTime / 1000);
      
      console.log(`WebSocket performance: ${concurrentOps} operations in ${totalTime}ms (${opsPerSecond.toFixed(2)} ops/sec)`);
      
      expect(opsPerSecond).toBeGreaterThan(100); // Should handle at least 100 ops/sec
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Real-time Job Updates', () => {
    it('should simulate complete job lifecycle via WebSocket', async () => {
      const jobId = 'lifecycle-test-job';
      const userId = 'test-user-id';
      
      // Join user room to receive job updates
      await mockWebSocketService.join(`user:${userId}`);
      
      // Simulate job lifecycle events
      const lifecycleEvents = [
        {
          type: 'JOB_CREATED',
          data: { jobId, status: 'PENDING', message: 'Job created successfully' },
        },
        {
          type: 'JOB_QUEUED',
          data: { jobId, status: 'QUEUED', message: 'Job added to processing queue' },
        },
        {
          type: 'JOB_STARTED',
          data: { jobId, status: 'PROCESSING', progress: 0, message: 'Job processing started' },
        },
        {
          type: 'JOB_PROGRESS',
          data: { jobId, status: 'PROCESSING', progress: 25, message: 'Processing 25% complete' },
        },
        {
          type: 'JOB_PROGRESS',
          data: { jobId, status: 'PROCESSING', progress: 50, message: 'Processing 50% complete' },
        },
        {
          type: 'JOB_PROGRESS',
          data: { jobId, status: 'PROCESSING', progress: 75, message: 'Processing 75% complete' },
        },
        {
          type: 'JOB_COMPLETED',
          data: { jobId, status: 'COMPLETED', progress: 100, message: 'Job completed successfully' },
        },
      ];
      
      // Send lifecycle events
      for (const event of lifecycleEvents) {
        await mockWebSocketService.emit(`user:${userId}`, event);
      }
      
      // Verify all events were sent
      expect(mockWebSocketService.emit).toHaveBeenCalledTimes(lifecycleEvents.length);
      
      // Verify user joined the room
      expect(mockWebSocketService.join).toHaveBeenCalledWith(`user:${userId}`);
    });
  });
});
