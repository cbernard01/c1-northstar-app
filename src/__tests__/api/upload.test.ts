/**
 * Upload API Tests
 * Tests for file upload functionality
 */

import { POST } from '@/app/api/upload/route';

import {
  createAuthenticatedRequest,
  createMockRequest,
  createMockFormData,
  createMockFile,
  setupApiTest,
  cleanupApiTest,
  mockPrisma,
  mockQueueManager,
  mockFs,
  testData,
  performanceTracker
} from './setup';

describe('/api/upload', () => {
  beforeEach(() => {
    setupApiTest();
    
    // Mock file system operations
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanupApiTest();
  });

  describe('POST /api/upload', () => {
    it('should require authentication', async () => {
      const req = createMockRequest('POST', '/api/upload');
      
      // Mock auth to return null
      jest.doMock('@/app/(auth)/auth', () => ({
        auth: jest.fn().mockResolvedValue(null),
      }));

      const response = await POST(req);
      expect(response.status).toBe(401);
    });

    it('should upload a CSV file successfully', async () => {
      const file = createMockFile('test.csv', 'name,email\nJohn,john@example.com', 'text/csv');
      const formData = createMockFormData({
        file,
        metadata: JSON.stringify({ source: 'manual' }),
      });

      const req = createAuthenticatedRequest('POST', '/api/upload');
      req.formData = jest.fn().mockResolvedValue(formData);

      const mockUpload = { ...testData.upload };
      const mockJob = { ...testData.job, type: 'FILE_PROCESSING' };

      mockPrisma.upload.create.mockResolvedValue(mockUpload);
      mockPrisma.job.create.mockResolvedValue(mockJob);
      mockPrisma.upload.update.mockResolvedValue({ ...mockUpload, jobId: mockJob.id });
      mockQueueManager.addFileProcessingJob.mockResolvedValue('queue-job-id');

      const startTime = Date.now();
      const response = await POST(req);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(201);
      
      const data = await response.json();
      expect(data).toMatchObject({
        fileId: mockUpload.id,
        name: 'test.csv',
        size: expect.any(Number),
        type: 'text/csv',
        uploadedAt: expect.any(String),
        processingJobId: mockJob.id,
      });

      // Verify upload record creation
      expect(mockPrisma.upload.create).toHaveBeenCalledWith({
        data: {
          fileName: expect.stringContaining('test.csv'),
          originalName: 'test.csv',
          fileSize: expect.any(Number),
          fileType: 'text/csv',
          userId: 'test-user-id',
          metadata: expect.objectContaining({
            source: 'manual',
            filePath: expect.any(String),
            uploadTimestamp: expect.any(Number),
          }),
        },
      });

      // Verify job creation
      expect(mockPrisma.job.create).toHaveBeenCalledWith({
        data: {
          type: 'FILE_PROCESSING',
          title: 'Process test.csv',
          description: 'Processing uploaded file: test.csv',
          userId: 'test-user-id',
          metadata: {
            uploadId: mockUpload.id,
            fileName: 'test.csv',
            fileType: 'text/csv',
            filePath: expect.any(String),
          },
        },
      });

      // Verify queue job creation
      expect(mockQueueManager.addFileProcessingJob).toHaveBeenCalledWith(
        {
          uploadId: mockUpload.id,
          userId: 'test-user-id',
          fileName: 'test.csv',
          fileType: 'text/csv',
          filePath: expect.any(String),
        },
        mockJob.id
      );

      // Verify file system operations
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('test-user-id'),
        { recursive: true }
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Buffer)
      );

      performanceTracker.track({
        endpoint: '/api/upload',
        method: 'POST',
        responseTime,
        statusCode: response.status,
        payloadSize: file.size,
        errorRate: 0,
      });
    });

    it('should reject files that are too large', async () => {
      // Create a file larger than 50MB
      const largeContent = 'x'.repeat(51 * 1024 * 1024); // 51MB
      const file = createMockFile('large.csv', largeContent, 'text/csv');
      const formData = createMockFormData({ file });

      const req = createAuthenticatedRequest('POST', '/api/upload');
      req.formData = jest.fn().mockResolvedValue(formData);

      const response = await POST(req);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain('File size exceeds maximum limit');
    });

    it('should reject unsupported file types', async () => {
      const file = createMockFile('test.txt', 'Hello world', 'text/plain');
      const formData = createMockFormData({ file });

      const req = createAuthenticatedRequest('POST', '/api/upload');
      req.formData = jest.fn().mockResolvedValue(formData);

      const response = await POST(req);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain('Unsupported file type');
    });

    it('should require a file', async () => {
      const formData = createMockFormData({ metadata: '{}' });

      const req = createAuthenticatedRequest('POST', '/api/upload');
      req.formData = jest.fn().mockResolvedValue(formData);

      const response = await POST(req);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBe('No file provided');
    });

    it('should handle invalid metadata', async () => {
      const file = createMockFile('test.csv', 'data', 'text/csv');
      const formData = createMockFormData({
        file,
        metadata: 'invalid json',
      });

      const req = createAuthenticatedRequest('POST', '/api/upload');
      req.formData = jest.fn().mockResolvedValue(formData);

      const response = await POST(req);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBe('Invalid metadata format');
    });

    it('should support Excel files', async () => {
      const file = createMockFile(
        'test.xlsx',
        'mock excel content',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      const formData = createMockFormData({ file });

      const req = createAuthenticatedRequest('POST', '/api/upload');
      req.formData = jest.fn().mockResolvedValue(formData);

      mockPrisma.upload.create.mockResolvedValue(testData.upload);
      mockPrisma.job.create.mockResolvedValue(testData.job);
      mockPrisma.upload.update.mockResolvedValue(testData.upload);
      mockQueueManager.addFileProcessingJob.mockResolvedValue('queue-job-id');

      const response = await POST(req);
      expect(response.status).toBe(201);
    });

    it('should support PDF files', async () => {
      const file = createMockFile('test.pdf', 'mock pdf content', 'application/pdf');
      const formData = createMockFormData({ file });

      const req = createAuthenticatedRequest('POST', '/api/upload');
      req.formData = jest.fn().mockResolvedValue(formData);

      mockPrisma.upload.create.mockResolvedValue(testData.upload);
      mockPrisma.job.create.mockResolvedValue(testData.job);
      mockPrisma.upload.update.mockResolvedValue(testData.upload);
      mockQueueManager.addFileProcessingJob.mockResolvedValue('queue-job-id');

      const response = await POST(req);
      expect(response.status).toBe(201);
    });

    it('should support Word documents', async () => {
      const file = createMockFile(
        'test.docx',
        'mock word content',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      const formData = createMockFormData({ file });

      const req = createAuthenticatedRequest('POST', '/api/upload');
      req.formData = jest.fn().mockResolvedValue(formData);

      mockPrisma.upload.create.mockResolvedValue(testData.upload);
      mockPrisma.job.create.mockResolvedValue(testData.job);
      mockPrisma.upload.update.mockResolvedValue(testData.upload);
      mockQueueManager.addFileProcessingJob.mockResolvedValue('queue-job-id');

      const response = await POST(req);
      expect(response.status).toBe(201);
    });

    it('should support PowerPoint presentations', async () => {
      const file = createMockFile(
        'test.pptx',
        'mock powerpoint content',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      );
      const formData = createMockFormData({ file });

      const req = createAuthenticatedRequest('POST', '/api/upload');
      req.formData = jest.fn().mockResolvedValue(formData);

      mockPrisma.upload.create.mockResolvedValue(testData.upload);
      mockPrisma.job.create.mockResolvedValue(testData.job);
      mockPrisma.upload.update.mockResolvedValue(testData.upload);
      mockQueueManager.addFileProcessingJob.mockResolvedValue('queue-job-id');

      const response = await POST(req);
      expect(response.status).toBe(201);
    });

    it('should handle queue errors gracefully', async () => {
      const file = createMockFile('test.csv', 'data', 'text/csv');
      const formData = createMockFormData({ file });

      const req = createAuthenticatedRequest('POST', '/api/upload');
      req.formData = jest.fn().mockResolvedValue(formData);

      const mockUpload = { ...testData.upload };
      const mockJob = { ...testData.job };

      mockPrisma.upload.create.mockResolvedValue(mockUpload);
      mockPrisma.job.create.mockResolvedValue(mockJob);
      mockPrisma.upload.update.mockResolvedValue(mockUpload);
      mockPrisma.job.update.mockResolvedValue({ ...mockJob, status: 'FAILED' });
      mockQueueManager.addFileProcessingJob.mockRejectedValue(new Error('Queue error'));

      const response = await POST(req);
      expect(response.status).toBe(201);

      // Should update job status to FAILED
      expect(mockPrisma.job.update).toHaveBeenCalledWith({
        where: { id: mockJob.id },
        data: {
          status: 'FAILED',
          errorMessage: 'Failed to queue file for processing',
        },
      });
    });

    it('should handle file system errors', async () => {
      const file = createMockFile('test.csv', 'data', 'text/csv');
      const formData = createMockFormData({ file });

      const req = createAuthenticatedRequest('POST', '/api/upload');
      req.formData = jest.fn().mockResolvedValue(formData);

      // Mock file system error
      mockFs.writeFile.mockRejectedValue(new Error('Disk full'));

      const response = await POST(req);
      expect(response.status).toBe(500);
    });

    it('should handle database errors', async () => {
      const file = createMockFile('test.csv', 'data', 'text/csv');
      const formData = createMockFormData({ file });

      const req = createAuthenticatedRequest('POST', '/api/upload');
      req.formData = jest.fn().mockResolvedValue(formData);

      // Mock database error
      mockPrisma.upload.create.mockRejectedValue(new Error('Database error'));

      const response = await POST(req);
      expect(response.status).toBe(500);
    });
  });

  describe('File Processing Performance', () => {
    it('should handle large files within reasonable time', async () => {
      // Create a 10MB file
      const largeContent = 'x'.repeat(10 * 1024 * 1024);
      const file = createMockFile('large.csv', largeContent, 'text/csv');
      const formData = createMockFormData({ file });

      const req = createAuthenticatedRequest('POST', '/api/upload');
      req.formData = jest.fn().mockResolvedValue(formData);

      mockPrisma.upload.create.mockResolvedValue(testData.upload);
      mockPrisma.job.create.mockResolvedValue(testData.job);
      mockPrisma.upload.update.mockResolvedValue(testData.upload);
      mockQueueManager.addFileProcessingJob.mockResolvedValue('queue-job-id');

      const startTime = Date.now();
      const response = await POST(req);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(201);
      expect(responseTime).toBeLessThan(5000); // Should process within 5 seconds

      console.log(`Processed 10MB file in ${responseTime}ms`);
    });

    it('should handle concurrent uploads', async () => {
      const concurrentUploads = 3;
      const requests = Array.from({ length: concurrentUploads }, (_, i) => {
        const file = createMockFile(`test-${i}.csv`, `data-${i}`, 'text/csv');
        const formData = createMockFormData({ file });
        const req = createAuthenticatedRequest('POST', '/api/upload');
        req.formData = jest.fn().mockResolvedValue(formData);
        return req;
      });

      mockPrisma.upload.create.mockImplementation(() => Promise.resolve(testData.upload));
      mockPrisma.job.create.mockImplementation(() => Promise.resolve(testData.job));
      mockPrisma.upload.update.mockImplementation(() => Promise.resolve(testData.upload));
      mockQueueManager.addFileProcessingJob.mockResolvedValue('queue-job-id');

      const startTime = Date.now();
      const responses = await Promise.all(requests.map(req => POST(req)));
      const totalTime = Date.now() - startTime;

      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      const avgTime = totalTime / concurrentUploads;
      console.log(`Handled ${concurrentUploads} concurrent uploads in ${totalTime}ms (avg: ${avgTime.toFixed(2)}ms)`);
    });
  });

  describe('Security Tests', () => {
    it('should sanitize filenames', async () => {
      const file = createMockFile('../../../malicious.csv', 'data', 'text/csv');
      const formData = createMockFormData({ file });

      const req = createAuthenticatedRequest('POST', '/api/upload');
      req.formData = jest.fn().mockResolvedValue(formData);

      mockPrisma.upload.create.mockResolvedValue(testData.upload);
      mockPrisma.job.create.mockResolvedValue(testData.job);
      mockPrisma.upload.update.mockResolvedValue(testData.upload);
      mockQueueManager.addFileProcessingJob.mockResolvedValue('queue-job-id');

      const response = await POST(req);
      expect(response.status).toBe(201);

      // Verify filename was sanitized
      expect(mockPrisma.upload.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fileName: expect.not.stringContaining('../'),
          }),
        })
      );
    });

    it('should prevent path traversal in uploads', async () => {
      const file = createMockFile('..\\..\\..\\malicious.csv', 'data', 'text/csv');
      const formData = createMockFormData({ file });

      const req = createAuthenticatedRequest('POST', '/api/upload');
      req.formData = jest.fn().mockResolvedValue(formData);

      mockPrisma.upload.create.mockResolvedValue(testData.upload);
      mockPrisma.job.create.mockResolvedValue(testData.job);
      mockPrisma.upload.update.mockResolvedValue(testData.upload);
      mockQueueManager.addFileProcessingJob.mockResolvedValue('queue-job-id');

      const response = await POST(req);
      expect(response.status).toBe(201);

      // Verify path was sanitized
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/\/uploads\/test-user-id\/[^/]+$/),
        expect.any(Buffer)
      );
    });
  });
});
