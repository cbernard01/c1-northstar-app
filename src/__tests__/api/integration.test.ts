/**
 * Integration Tests
 * Tests for full workflow scenarios and load testing
 */

import { GET as accountsGet, POST as accountsPost } from '@/app/api/accounts/route';
import { POST as chatPost } from '@/app/api/chat/route';
import { GET as healthGet } from '@/app/api/health/route';
import { GET as jobsGet, POST as jobsPost } from '@/app/api/jobs/route';
import { POST as uploadPost } from '@/app/api/upload/route';

import {
  createAuthenticatedRequest,
  createMockRequest,
  createMockFormData,
  createMockFile,
  setupApiTest,
  cleanupApiTest,
  mockPrisma,
  mockQueueManager,
  mockAiService,
  mockFs,
  testData,
  performanceTracker,
  PerformanceTracker
} from './setup';

describe('API Integration Tests', () => {
  let integrationTracker: PerformanceTracker;

  beforeEach(() => {
    setupApiTest();
    integrationTracker = new PerformanceTracker();
    
    // Setup default mocks for integration tests
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    
    mockAiService.sendChatMessage.mockResolvedValue({
      content: 'AI response for integration test',
      model: 'test-model',
      usage: { tokens: 50 },
      finishReason: 'stop',
      metadata: {},
    });
  });

  afterEach(() => {
    cleanupApiTest();
  });

  describe('End-to-End Workflows', () => {
    it('should complete file upload to insights workflow', async () => {
      const workflowStart = Date.now();
      
      // Step 1: Upload a file
      const file = createMockFile('accounts.csv', 'company,industry\nTest Corp,Technology', 'text/csv');
      const formData = createMockFormData({ file });
      const uploadReq = createAuthenticatedRequest('POST', '/api/upload');
      uploadReq.formData = jest.fn().mockResolvedValue(formData);
      
      const mockUpload = { ...testData.upload, fileName: 'accounts.csv' };
      const mockFileJob = { ...testData.job, type: 'FILE_PROCESSING', id: 'file-job-id' };
      
      mockPrisma.upload.create.mockResolvedValue(mockUpload);
      mockPrisma.job.create.mockResolvedValue(mockFileJob);
      mockPrisma.upload.update.mockResolvedValue({ ...mockUpload, jobId: mockFileJob.id });
      mockQueueManager.addFileProcessingJob.mockResolvedValue('queue-job-id');
      
      const uploadResponse = await uploadPost(uploadReq);
      expect(uploadResponse.status).toBe(201);
      
      // Step 2: Create an account from processed data
      const accountData = {
        name: 'Test Corp',
        industry: 'Technology',
        domain: 'testcorp.com',
      };
      
      const accountReq = createAuthenticatedRequest('POST', '/api/accounts', accountData);
      const mockAccount = { ...testData.account, ...accountData };
      
      mockPrisma.companyAccount.findUnique.mockResolvedValue(null);
      mockPrisma.companyAccount.create.mockResolvedValue(mockAccount);
      
      const accountResponse = await accountsPost(accountReq);
      expect(accountResponse.status).toBe(201);
      
      // Step 3: Generate insights for the account
      const insightJobData = {
        type: 'INSIGHT_GENERATION',
        title: 'Generate insights for Test Corp',
        description: 'Generating insights for uploaded account',
        metadata: {
          accountId: mockAccount.id,
        },
      };
      
      const insightJobReq = createAuthenticatedRequest('POST', '/api/jobs', insightJobData);
      const mockInsightJob = { ...testData.job, ...insightJobData };
      
      mockPrisma.job.create.mockResolvedValue(mockInsightJob);
      mockQueueManager.addInsightGenerationJob.mockResolvedValue('insight-queue-job-id');
      
      const insightJobResponse = await jobsPost(insightJobReq);
      expect(insightJobResponse.status).toBe(201);
      
      // Step 4: Chat about the account
      const chatData = {
        message: 'Tell me about Test Corp',
        context: {
          accountId: mockAccount.id,
          accountName: mockAccount.name,
        },
      };
      
      const chatReq = createAuthenticatedRequest('POST', '/api/chat', chatData);
      const mockChatSession = { ...testData.chatSession, context: chatData.context };
      
      mockPrisma.chatSession.create.mockResolvedValue(mockChatSession);
      mockPrisma.chatMessage.create.mockResolvedValueOnce({
        ...testData.chatMessage,
        content: chatData.message
      }).mockResolvedValueOnce({
        ...testData.chatMessage,
        role: 'ASSISTANT',
        content: 'Test Corp is a technology company...'
      });
      mockPrisma.chatSession.update.mockResolvedValue(mockChatSession);
      
      const chatResponse = await chatPost(chatReq);
      expect(chatResponse.status).toBe(200);
      
      const workflowTime = Date.now() - workflowStart;
      console.log(`Complete workflow took ${workflowTime}ms`);
      
      // Verify entire workflow completed successfully
      expect(uploadResponse.status).toBe(201);
      expect(accountResponse.status).toBe(201);
      expect(insightJobResponse.status).toBe(201);
      expect(chatResponse.status).toBe(200);
      
      // Should complete within reasonable time
      expect(workflowTime).toBeLessThan(5000);
    });

    it('should handle job processing pipeline', async () => {
      // Create multiple jobs of different types
      const jobTypes = ['FILE_PROCESSING', 'ACCOUNT_ANALYSIS', 'DATA_EXPORT', 'INSIGHT_GENERATION'];
      const jobPromises = jobTypes.map((type, index) => {
        const jobData = {
          type,
          title: `${type} Job ${index + 1}`,
          description: `Processing ${type.toLowerCase()} job`,
          metadata: type === 'ACCOUNT_ANALYSIS' ? { accountId: 'test-account-id' } : {},
        };
        
        const req = createAuthenticatedRequest('POST', '/api/jobs', jobData);
        return jobsPost(req);
      });
      
      // Mock job creation for each type
      mockPrisma.job.create.mockImplementation((data) => 
        Promise.resolve({ ...testData.job, ...data.data })
      );
      
      // Mock queue operations
      mockQueueManager.addFileProcessingJob.mockResolvedValue('queue-1');
      mockQueueManager.addAccountAnalysisJob.mockResolvedValue('queue-2');
      mockQueueManager.addDataExportJob.mockResolvedValue('queue-3');
      mockQueueManager.addInsightGenerationJob.mockResolvedValue('queue-4');
      
      const startTime = Date.now();
      const responses = await Promise.all(jobPromises);
      const totalTime = Date.now() - startTime;
      
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });
      
      console.log(`Created ${jobTypes.length} different job types in ${totalTime}ms`);
      
      // Verify all queue managers were called
      expect(mockQueueManager.addFileProcessingJob).toHaveBeenCalled();
      expect(mockQueueManager.addAccountAnalysisJob).toHaveBeenCalled();
      expect(mockQueueManager.addDataExportJob).toHaveBeenCalled();
      expect(mockQueueManager.addInsightGenerationJob).toHaveBeenCalled();
    });
  });

  describe('Load Testing', () => {
    it('should handle 10 concurrent file uploads', async () => {
      console.log('\n=== Load Test: 10 Concurrent File Uploads ===');
      
      const concurrentUploads = 10;
      const uploadPromises = Array.from({ length: concurrentUploads }, (_, i) => {
        const file = createMockFile(
          `load-test-${i}.csv`,
          `data,value\ntest-${i},${i * 100}`,
          'text/csv'
        );
        const formData = createMockFormData({ 
          file,
          metadata: JSON.stringify({ test: `load-test-${i}` })
        });
        
        const req = createAuthenticatedRequest('POST', '/api/upload');
        req.formData = jest.fn().mockResolvedValue(formData);
        
        return uploadPost(req);
      });
      
      // Mock successful responses for all uploads
      mockPrisma.upload.create.mockImplementation((data) => 
        Promise.resolve({ ...testData.upload, ...data.data })
      );
      mockPrisma.job.create.mockImplementation((data) =>
        Promise.resolve({ ...testData.job, ...data.data })
      );
      mockPrisma.upload.update.mockResolvedValue(testData.upload);
      mockQueueManager.addFileProcessingJob.mockResolvedValue('queue-job-id');
      
      const startTime = Date.now();
      const responses = await Promise.all(uploadPromises);
      const totalTime = Date.now() - startTime;
      
      // All uploads should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        integrationTracker.track({
          endpoint: '/api/upload',
          method: 'POST',
          responseTime: totalTime / concurrentUploads, // Approximation
          statusCode: response.status,
          errorRate: 0,
          throughput: concurrentUploads / (totalTime / 1000),
        });
      });
      
      const avgTime = totalTime / concurrentUploads;
      const throughput = concurrentUploads / (totalTime / 1000);
      
      console.log(`Results:`);
      console.log(`- Total time: ${totalTime}ms`);
      console.log(`- Average time per upload: ${avgTime.toFixed(2)}ms`);
      console.log(`- Throughput: ${throughput.toFixed(2)} uploads/second`);
      console.log(`- Success rate: 100%`);
      
      // Performance assertions
      expect(avgTime).toBeLessThan(1000); // Average should be under 1 second
      expect(throughput).toBeGreaterThan(5); // Should handle at least 5 uploads per second
      
      // Verify all database operations were called correctly
      expect(mockPrisma.upload.create).toHaveBeenCalledTimes(concurrentUploads);
      expect(mockPrisma.job.create).toHaveBeenCalledTimes(concurrentUploads);
      expect(mockQueueManager.addFileProcessingJob).toHaveBeenCalledTimes(concurrentUploads);
    });

    it('should handle concurrent job creation and retrieval', async () => {
      console.log('\n=== Load Test: Concurrent Job Operations ===');
      
      const concurrentOps = 20;
      const operations = [];
      
      // Mix of job creation and retrieval operations
      for (let i = 0; i < concurrentOps; i++) {
        if (i % 2 === 0) {
          // Create job
          const jobData = {
            type: 'FILE_PROCESSING',
            title: `Load Test Job ${i}`,
            description: `Load testing job creation ${i}`,
          };
          const req = createAuthenticatedRequest('POST', '/api/jobs', jobData);
          operations.push(jobsPost(req));
        } else {
          // Get jobs
          const req = createAuthenticatedRequest('GET', `/api/jobs?page=${Math.ceil(i/4)}&pageSize=5`);
          operations.push(jobsGet(req));
        }
      }
      
      // Mock responses
      mockPrisma.job.create.mockImplementation((data) =>
        Promise.resolve({ ...testData.job, ...data.data })
      );
      mockPrisma.job.findMany.mockResolvedValue([testData.job]);
      mockPrisma.job.count.mockResolvedValue(1);
      
      const startTime = Date.now();
      const responses = await Promise.all(operations);
      const totalTime = Date.now() - startTime;
      
      // All operations should succeed
      const successCount = responses.filter(r => r.status < 400).length;
      const successRate = (successCount / responses.length) * 100;
      
      console.log(`Results:`);
      console.log(`- Total operations: ${concurrentOps}`);
      console.log(`- Total time: ${totalTime}ms`);
      console.log(`- Average time per operation: ${(totalTime / concurrentOps).toFixed(2)}ms`);
      console.log(`- Success rate: ${successRate.toFixed(1)}%`);
      
      expect(successRate).toBeGreaterThan(95); // At least 95% success rate
      expect(totalTime / concurrentOps).toBeLessThan(500); // Average under 500ms
    });

    it('should handle account search load', async () => {
      console.log('\n=== Load Test: Account Search Load ===');
      
      const searchTerms = ['technology', 'healthcare', 'finance', 'retail', 'manufacturing'];
      const concurrentSearches = 15;
      
      const searchPromises = Array.from({ length: concurrentSearches }, (_, i) => {
        const searchTerm = searchTerms[i % searchTerms.length];
        const req = createAuthenticatedRequest(
          'GET',
          `/api/accounts?search=${searchTerm}&page=${Math.floor(i/5) + 1}&pageSize=10`
        );
        return accountsGet(req);
      });
      
      // Mock search results
      mockPrisma.companyAccount.findMany.mockImplementation(() =>
        Promise.resolve(Array.from({ length: 10 }, (_, i) => ({
          ...testData.account,
          id: `search-account-${i}`,
          name: `Search Result ${i}`,
        })))
      );
      mockPrisma.companyAccount.count.mockResolvedValue(100);
      
      const startTime = Date.now();
      const responses = await Promise.all(searchPromises);
      const totalTime = Date.now() - startTime;
      
      const successCount = responses.filter(r => r.status === 200).length;
      const successRate = (successCount / responses.length) * 100;
      
      console.log(`Results:`);
      console.log(`- Total searches: ${concurrentSearches}`);
      console.log(`- Total time: ${totalTime}ms`);
      console.log(`- Average time per search: ${(totalTime / concurrentSearches).toFixed(2)}ms`);
      console.log(`- Success rate: ${successRate.toFixed(1)}%`);
      
      expect(successRate).toBe(100);
      expect(totalTime / concurrentSearches).toBeLessThan(300);
    });

    it('should handle mixed workload stress test', async () => {
      console.log('\n=== Stress Test: Mixed Workload ===');
      
      const operations = [];
      const operationTypes = [];
      
      // Create a mix of different operations
      for (let i = 0; i < 25; i++) {
        const opType = i % 5;
        
        switch (opType) {
          case 0: // Health check
            operations.push(healthGet(createMockRequest('GET', '/api/health')));
            operationTypes.push('health');
            break;
            
          case 1: // Job creation
            const jobReq = createAuthenticatedRequest('POST', '/api/jobs', {
              type: 'FILE_PROCESSING',
              title: `Stress Test Job ${i}`,
              description: 'Stress testing job creation',
            });
            operations.push(jobsPost(jobReq));
            operationTypes.push('job-create');
            break;
            
          case 2: // Job retrieval
            const getJobsReq = createAuthenticatedRequest('GET', '/api/jobs');
            operations.push(jobsGet(getJobsReq));
            operationTypes.push('job-get');
            break;
            
          case 3: // Account search
            const searchReq = createAuthenticatedRequest('GET', '/api/accounts?search=test');
            operations.push(accountsGet(searchReq));
            operationTypes.push('account-search');
            break;
            
          case 4: // Chat
            const chatReq = createAuthenticatedRequest('POST', '/api/chat', {
              message: `Stress test message ${i}`,
              streaming: false,
            });
            operations.push(chatPost(chatReq));
            operationTypes.push('chat');
            break;
        }
      }
      
      // Mock all operations
      mockPrisma.job.create.mockImplementation((data) =>
        Promise.resolve({ ...testData.job, ...data.data })
      );
      mockPrisma.job.findMany.mockResolvedValue([testData.job]);
      mockPrisma.job.count.mockResolvedValue(1);
      mockPrisma.companyAccount.findMany.mockResolvedValue([testData.account]);
      mockPrisma.companyAccount.count.mockResolvedValue(1);
      mockPrisma.chatSession.create.mockResolvedValue(testData.chatSession);
      mockPrisma.chatMessage.create.mockResolvedValue(testData.chatMessage);
      mockPrisma.chatSession.update.mockResolvedValue(testData.chatSession);
      
      const startTime = Date.now();
      const responses = await Promise.all(operations);
      const totalTime = Date.now() - startTime;
      
      // Analyze results by operation type
      const results = {};
      responses.forEach((response, index) => {
        const opType = operationTypes[index];
        if (!results[opType]) {
          results[opType] = { count: 0, successes: 0, totalTime: 0 };
        }
        results[opType].count++;
        if (response.status < 400) results[opType].successes++;
      });
      
      console.log(`Results:`);
      console.log(`- Total operations: ${operations.length}`);
      console.log(`- Total time: ${totalTime}ms`);
      console.log(`- Overall throughput: ${(operations.length / (totalTime / 1000)).toFixed(2)} ops/sec`);
      
      Object.entries(results).forEach(([opType, stats]: [string, any]) => {
        const successRate = (stats.successes / stats.count) * 100;
        console.log(`- ${opType}: ${stats.successes}/${stats.count} (${successRate.toFixed(1)}% success)`);
      });
      
      // Overall success rate should be high
      const totalSuccesses = responses.filter(r => r.status < 400).length;
      const overallSuccessRate = (totalSuccesses / responses.length) * 100;
      expect(overallSuccessRate).toBeGreaterThan(90);
    });
  });

  describe('Error Recovery', () => {
    it('should handle partial failures gracefully', async () => {
      const operations = 10;
      const requests = Array.from({ length: operations }, (_, i) => {
        const req = createAuthenticatedRequest('POST', '/api/jobs', {
          type: 'FILE_PROCESSING',
          title: `Recovery Test Job ${i}`,
          description: 'Testing error recovery',
        });
        return jobsPost(req);
      });
      
      // Mock some failures
      let callCount = 0;
      mockPrisma.job.create.mockImplementation(() => {
        callCount++;
        if (callCount % 3 === 0) {
          return Promise.reject(new Error('Simulated database error'));
        }
        return Promise.resolve(testData.job);
      });
      
      const responses = await Promise.allSettled(requests);
      
      const successes = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status < 400
      ).length;
      const failures = responses.length - successes;
      
      console.log(`Error recovery test: ${successes} successes, ${failures} failures`);
      
      // Should have some successes and some failures
      expect(successes).toBeGreaterThan(0);
      expect(failures).toBeGreaterThan(0);
      expect(successes).toBe(Math.floor(operations * 2/3)); // Expect ~67% success rate
    });

    it('should handle queue failures', async () => {
      const req = createAuthenticatedRequest('POST', '/api/jobs', {
        type: 'ACCOUNT_ANALYSIS',
        title: 'Queue Failure Test',
        description: 'Testing queue failure handling',
        metadata: { accountId: 'test-account-id' },
      });
      
      // Mock successful job creation but queue failure
      mockPrisma.job.create.mockResolvedValue(testData.job);
      mockPrisma.job.update.mockResolvedValue({ ...testData.job, status: 'FAILED' });
      mockQueueManager.addAccountAnalysisJob.mockRejectedValue(new Error('Queue service unavailable'));
      
      const response = await jobsPost(req);
      
      // Should still return 201 (job created) but job should be marked as failed
      expect(response.status).toBe(201);
      expect(mockPrisma.job.update).toHaveBeenCalledWith({
        where: { id: testData.job.id },
        data: {
          status: 'FAILED',
          errorMessage: 'Failed to queue job for processing',
        },
      });
    });
  });

  afterAll(() => {
    // Generate comprehensive performance report
    const report = integrationTracker.generateReport();
    console.log(report);
    
    // Add overall system performance metrics
    console.log('\n=== Overall System Performance ===');
    console.log(`Average Response Time: ${integrationTracker.getAverageResponseTime().toFixed(2)}ms`);
    console.log(`P95 Response Time: ${integrationTracker.getP95ResponseTime().toFixed(2)}ms`);
    console.log(`Error Rate: ${integrationTracker.getErrorRate().toFixed(2)}%`);
  });
});
