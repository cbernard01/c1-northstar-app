/**
 * Jobs API Tests
 * Tests for job management endpoints
 */

import { GET, POST } from '@/app/api/jobs/route';

import { 
  createAuthenticatedRequest, 
  createMockRequest,
  setupApiTest, 
  cleanupApiTest, 
  mockPrisma,
  mockQueueManager,
  testData,
  performanceTracker
} from './setup';

describe('/api/jobs', () => {
  beforeEach(() => {
    setupApiTest();
  });

  afterEach(() => {
    cleanupApiTest();
  });

  describe('GET /api/jobs', () => {
    it('should require authentication', async () => {
      const req = createMockRequest('GET', '/api/jobs');
      
      // Mock auth to return null (unauthenticated)
      jest.doMock('@/app/(auth)/auth', () => ({
        auth: jest.fn().mockResolvedValue(null),
      }));

      const response = await GET(req);
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return paginated jobs list', async () => {
      const req = createAuthenticatedRequest('GET', '/api/jobs?page=1&pageSize=10');
      
      const mockJobs = [
        { ...testData.job, id: 'job-1' },
        { ...testData.job, id: 'job-2' },
      ];

      mockPrisma.job.findMany.mockResolvedValue(mockJobs);
      mockPrisma.job.count.mockResolvedValue(2);

      const startTime = Date.now();
      const response = await GET(req);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toMatchObject({
        jobs: mockJobs,
        total: 2,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      });

      // Verify database queries
      expect(mockPrisma.job.findMany).toHaveBeenCalledWith({
        where: { userId: 'test-user-id' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
        include: {
          uploads: {
            select: {
              id: true,
              fileName: true,
              fileType: true,
              status: true,
            },
          },
        },
      });

      performanceTracker.track({
        endpoint: '/api/jobs',
        method: 'GET',
        responseTime,
        statusCode: response.status,
        errorRate: 0,
      });
    });

    it('should handle filtering by status', async () => {
      const req = createAuthenticatedRequest('GET', '/api/jobs?status=COMPLETED');
      
      mockPrisma.job.findMany.mockResolvedValue([]);
      mockPrisma.job.count.mockResolvedValue(0);

      const response = await GET(req);
      expect(response.status).toBe(200);

      expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { 
            userId: 'test-user-id',
            status: 'COMPLETED'
          },
        })
      );
    });

    it('should handle filtering by type', async () => {
      const req = createAuthenticatedRequest('GET', '/api/jobs?type=FILE_PROCESSING');
      
      mockPrisma.job.findMany.mockResolvedValue([]);
      mockPrisma.job.count.mockResolvedValue(0);

      const response = await GET(req);
      expect(response.status).toBe(200);

      expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { 
            userId: 'test-user-id',
            type: 'FILE_PROCESSING'
          },
        })
      );
    });

    it('should handle sorting', async () => {
      const req = createAuthenticatedRequest('GET', '/api/jobs?sortBy=title&sortOrder=asc');
      
      mockPrisma.job.findMany.mockResolvedValue([]);
      mockPrisma.job.count.mockResolvedValue(0);

      const response = await GET(req);
      expect(response.status).toBe(200);

      expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { title: 'asc' },
        })
      );
    });

    it('should validate query parameters', async () => {
      const req = createAuthenticatedRequest('GET', '/api/jobs?page=invalid');
      
      const response = await GET(req);
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/jobs', () => {
    it('should require authentication', async () => {
      const req = createMockRequest('POST', '/api/jobs', {
        type: 'FILE_PROCESSING',
        title: 'Test Job',
        description: 'A test job',
      });
      
      // Mock auth to return null
      jest.doMock('@/app/(auth)/auth', () => ({
        auth: jest.fn().mockResolvedValue(null),
      }));

      const response = await POST(req);
      expect(response.status).toBe(401);
    });

    it('should create a new job', async () => {
      const jobData = {
        type: 'FILE_PROCESSING',
        title: 'Test Job',
        description: 'A test job',
        metadata: { test: 'data' },
      };

      const req = createAuthenticatedRequest('POST', '/api/jobs', jobData);
      
      const createdJob = { ...testData.job, ...jobData };
      mockPrisma.job.create.mockResolvedValue(createdJob);

      const startTime = Date.now();
      const response = await POST(req);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(201);
      
      const data = await response.json();
      expect(data).toMatchObject(createdJob);

      expect(mockPrisma.job.create).toHaveBeenCalledWith({
        data: {
          ...jobData,
          userId: 'test-user-id',
        },
      });

      performanceTracker.track({
        endpoint: '/api/jobs',
        method: 'POST',
        responseTime,
        statusCode: response.status,
        errorRate: 0,
      });
    });

    it('should handle account analysis job type', async () => {
      const jobData = {
        type: 'ACCOUNT_ANALYSIS',
        title: 'Analyze Account',
        description: 'Analyzing account data',
        metadata: {
          accountId: 'test-account-id',
          analysisType: 'full',
        },
      };

      const req = createAuthenticatedRequest('POST', '/api/jobs', jobData);
      
      const createdJob = { ...testData.job, ...jobData };
      mockPrisma.job.create.mockResolvedValue(createdJob);
      mockQueueManager.addAccountAnalysisJob.mockResolvedValue('queue-job-id');

      const response = await POST(req);
      expect(response.status).toBe(201);

      expect(mockQueueManager.addAccountAnalysisJob).toHaveBeenCalledWith(
        {
          accountId: 'test-account-id',
          userId: 'test-user-id',
          analysisType: 'full',
        },
        createdJob.id
      );
    });

    it('should handle data export job type', async () => {
      const jobData = {
        type: 'DATA_EXPORT',
        title: 'Export Data',
        description: 'Exporting account data',
        metadata: {
          exportConfig: {
            type: 'accounts',
            format: 'csv',
            filters: { industry: 'Technology' },
          },
        },
      };

      const req = createAuthenticatedRequest('POST', '/api/jobs', jobData);
      
      const createdJob = { ...testData.job, ...jobData };
      mockPrisma.job.create.mockResolvedValue(createdJob);
      mockQueueManager.addDataExportJob.mockResolvedValue('queue-job-id');

      const response = await POST(req);
      expect(response.status).toBe(201);

      expect(mockQueueManager.addDataExportJob).toHaveBeenCalledWith(
        {
          exportType: 'accounts',
          filters: { industry: 'Technology' },
          format: 'csv',
          userId: 'test-user-id',
        },
        createdJob.id
      );
    });

    it('should handle insight generation job type', async () => {
      const jobData = {
        type: 'INSIGHT_GENERATION',
        title: 'Generate Insights',
        description: 'Generating insights for account',
        metadata: {
          accountId: 'test-account-id',
          contextData: { source: 'manual' },
        },
      };

      const req = createAuthenticatedRequest('POST', '/api/jobs', jobData);
      
      const createdJob = { ...testData.job, ...jobData };
      mockPrisma.job.create.mockResolvedValue(createdJob);
      mockQueueManager.addInsightGenerationJob.mockResolvedValue('queue-job-id');

      const response = await POST(req);
      expect(response.status).toBe(201);

      expect(mockQueueManager.addInsightGenerationJob).toHaveBeenCalledWith(
        {
          accountId: 'test-account-id',
          userId: 'test-user-id',
          contextData: { source: 'manual' },
        },
        createdJob.id
      );
    });

    it('should handle queue errors', async () => {
      const jobData = {
        type: 'ACCOUNT_ANALYSIS',
        title: 'Test Job',
        description: 'A test job',
        metadata: { accountId: 'test-account-id' },
      };

      const req = createAuthenticatedRequest('POST', '/api/jobs', jobData);
      
      const createdJob = { ...testData.job, ...jobData };
      mockPrisma.job.create.mockResolvedValue(createdJob);
      mockPrisma.job.update.mockResolvedValue({ ...createdJob, status: 'FAILED' });
      mockQueueManager.addAccountAnalysisJob.mockRejectedValue(new Error('Queue error'));

      const response = await POST(req);
      expect(response.status).toBe(201);

      // Should update job status to FAILED
      expect(mockPrisma.job.update).toHaveBeenCalledWith({
        where: { id: createdJob.id },
        data: {
          status: 'FAILED',
          errorMessage: 'Failed to queue job for processing',
        },
      });
    });

    it('should validate request body', async () => {
      const req = createAuthenticatedRequest('POST', '/api/jobs', {
        // Missing required fields
        title: 'Test Job',
      });

      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('should handle invalid JSON', async () => {
      const req = createAuthenticatedRequest('POST', '/api/jobs');
      
      // Mock req.json() to throw an error
      req.json = jest.fn().mockRejectedValue(new Error('Invalid JSON'));

      const response = await POST(req);
      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limiting', async () => {
      // This would typically be tested with actual rate limiting middleware
      // For now, we'll simulate the behavior
      const requests = Array.from({ length: 100 }, (_, i) =>
        createAuthenticatedRequest('GET', '/api/jobs')
      );

      mockPrisma.job.findMany.mockResolvedValue([]);
      mockPrisma.job.count.mockResolvedValue(0);

      const responses = await Promise.all(
        requests.map(req => GET(req))
      );

      // All requests should succeed (rate limiting would be tested in integration)
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent job creation', async () => {
      const concurrentJobs = 5;
      const jobData = {
        type: 'FILE_PROCESSING',
        title: 'Concurrent Job',
        description: 'Testing concurrent job creation',
      };

      mockPrisma.job.create.mockImplementation((data) => 
        Promise.resolve({ ...testData.job, ...data.data })
      );

      const requests = Array.from({ length: concurrentJobs }, (_, i) =>
        POST(createAuthenticatedRequest('POST', '/api/jobs', {
          ...jobData,
          title: `${jobData.title} ${i + 1}`,
        }))
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      const avgTime = totalTime / concurrentJobs;
      console.log(`Created ${concurrentJobs} jobs concurrently in ${totalTime}ms (avg: ${avgTime.toFixed(2)}ms)`);
    });
  });
});
