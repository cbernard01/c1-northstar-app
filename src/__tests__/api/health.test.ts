/**
 * Health API Tests
 * Tests for health check endpoints
 */

import { GET, HEAD } from '@/app/api/health/route';

import { createMockRequest, setupApiTest, cleanupApiTest, performanceTracker } from './setup';

describe('/api/health', () => {
  beforeEach(() => {
    setupApiTest();
  });

  afterEach(() => {
    cleanupApiTest();
  });

  describe('GET /api/health', () => {
    it('should return healthy status', async () => {
      const startTime = Date.now();
      const req = createMockRequest('GET', '/api/health');
      
      const response = await GET(req);
      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        environment: expect.any(String),
        version: expect.any(String),
        responseTime: expect.any(Number),
        checks: {
          server: 'healthy',
          memory: {
            used: expect.any(Number),
            total: expect.any(Number),
            external: expect.any(Number),
          },
        },
      });

      // Track performance
      performanceTracker.track({
        endpoint: '/api/health',
        method: 'GET',
        responseTime,
        statusCode: response.status,
        errorRate: 0,
      });

      // Verify response headers
      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
      expect(response.headers.get('Pragma')).toBe('no-cache');
      expect(response.headers.get('Expires')).toBe('0');
    });

    it('should have fast response time', async () => {
      const startTime = Date.now();
      const req = createMockRequest('GET', '/api/health');
      
      await GET(req);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(100); // Should respond within 100ms
    });

    it('should handle errors gracefully', async () => {
      // Mock process.memoryUsage to throw an error
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockImplementation(() => {
        throw new Error('Memory usage error');
      });

      const req = createMockRequest('GET', '/api/health');
      const response = await GET(req);
      
      expect(response.status).toBe(503);
      
      const data = await response.json();
      expect(data).toMatchObject({
        status: 'unhealthy',
        timestamp: expect.any(String),
        error: expect.any(String),
        responseTime: expect.any(Number),
      });

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('HEAD /api/health', () => {
    it('should return 200 status with no body', async () => {
      const response = await HEAD();
      
      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests', async () => {
      const concurrentRequests = 10;
      const requests = Array.from({ length: concurrentRequests }, () =>
        GET(createMockRequest('GET', '/api/health'))
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Average response time should be reasonable
      const avgTime = totalTime / concurrentRequests;
      expect(avgTime).toBeLessThan(50);

      console.log(`Health endpoint handled ${concurrentRequests} concurrent requests in ${totalTime}ms (avg: ${avgTime.toFixed(2)}ms)`);
    });
  });
});
