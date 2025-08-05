/**
 * API Test Setup
 * Configures the test environment for API testing
 */

import { jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { createMocks } from 'node-mocks-http';

// Mock Prisma client
export const mockPrisma = {
  user: {
    findUnique: jest.fn() as jest.MockedFunction<any>,
    findFirst: jest.fn() as jest.MockedFunction<any>,
    findMany: jest.fn() as jest.MockedFunction<any>,
    create: jest.fn() as jest.MockedFunction<any>,
    update: jest.fn() as jest.MockedFunction<any>,
    delete: jest.fn() as jest.MockedFunction<any>,
    count: jest.fn() as jest.MockedFunction<any>,
  },
  job: {
    findUnique: jest.fn() as jest.MockedFunction<any>,
    findFirst: jest.fn() as jest.MockedFunction<any>,
    findMany: jest.fn() as jest.MockedFunction<any>,
    create: jest.fn() as jest.MockedFunction<any>,
    update: jest.fn() as jest.MockedFunction<any>,
    delete: jest.fn() as jest.MockedFunction<any>,
    count: jest.fn() as jest.MockedFunction<any>,
    groupBy: jest.fn() as jest.MockedFunction<any>,
  },
  upload: {
    findUnique: jest.fn() as jest.MockedFunction<any>,
    findFirst: jest.fn() as jest.MockedFunction<any>,
    findMany: jest.fn() as jest.MockedFunction<any>,
    create: jest.fn() as jest.MockedFunction<any>,
    update: jest.fn() as jest.MockedFunction<any>,
    delete: jest.fn() as jest.MockedFunction<any>,
    count: jest.fn() as jest.MockedFunction<any>,
  },
  companyAccount: {
    findUnique: jest.fn() as jest.MockedFunction<any>,
    findFirst: jest.fn() as jest.MockedFunction<any>,
    findMany: jest.fn() as jest.MockedFunction<any>,
    create: jest.fn() as jest.MockedFunction<any>,
    update: jest.fn() as jest.MockedFunction<any>,
    delete: jest.fn() as jest.MockedFunction<any>,
    count: jest.fn() as jest.MockedFunction<any>,
    groupBy: jest.fn() as jest.MockedFunction<any>,
  },
  chatSession: {
    findUnique: jest.fn() as jest.MockedFunction<any>,
    findFirst: jest.fn() as jest.MockedFunction<any>,
    findMany: jest.fn() as jest.MockedFunction<any>,
    create: jest.fn() as jest.MockedFunction<any>,
    update: jest.fn() as jest.MockedFunction<any>,
    delete: jest.fn() as jest.MockedFunction<any>,
    count: jest.fn() as jest.MockedFunction<any>,
  },
  chatMessage: {
    findUnique: jest.fn() as jest.MockedFunction<any>,
    findFirst: jest.fn() as jest.MockedFunction<any>,
    findMany: jest.fn() as jest.MockedFunction<any>,
    create: jest.fn() as jest.MockedFunction<any>,
    update: jest.fn() as jest.MockedFunction<any>,
    delete: jest.fn() as jest.MockedFunction<any>,
    count: jest.fn() as jest.MockedFunction<any>,
  },
  technology: {
    findUnique: jest.fn() as jest.MockedFunction<any>,
    findFirst: jest.fn() as jest.MockedFunction<any>,
    findMany: jest.fn() as jest.MockedFunction<any>,
    create: jest.fn() as jest.MockedFunction<any>,
    update: jest.fn() as jest.MockedFunction<any>,
    delete: jest.fn() as jest.MockedFunction<any>,
    count: jest.fn() as jest.MockedFunction<any>,
    groupBy: jest.fn() as jest.MockedFunction<any>,
  },
  insight: {
    findUnique: jest.fn() as jest.MockedFunction<any>,
    findFirst: jest.fn() as jest.MockedFunction<any>,
    findMany: jest.fn() as jest.MockedFunction<any>,
    create: jest.fn() as jest.MockedFunction<any>,
    update: jest.fn() as jest.MockedFunction<any>,
    delete: jest.fn() as jest.MockedFunction<any>,
    count: jest.fn() as jest.MockedFunction<any>,
  },
} as const;

// Mock NextAuth session
export const mockSession = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
  },
};

// Mock authenticated user
export const mockAuthenticatedUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
};

// Mock queue manager
export const mockQueueManager = {
  addFileProcessingJob: jest.fn() as jest.MockedFunction<any>,
  addAccountAnalysisJob: jest.fn() as jest.MockedFunction<any>,
  addDataExportJob: jest.fn() as jest.MockedFunction<any>,
  addInsightGenerationJob: jest.fn() as jest.MockedFunction<any>,
  getJobStatus: jest.fn() as jest.MockedFunction<any>,
  cancelJob: jest.fn() as jest.MockedFunction<any>,
  retryJob: jest.fn() as jest.MockedFunction<any>,
};

// Mock AI service
export const mockAiService = {
  sendChatMessage: jest.fn() as jest.MockedFunction<any>,
  streamChatMessage: jest.fn() as jest.MockedFunction<any>,
  generateInsights: jest.fn() as jest.MockedFunction<any>,
  normalizeData: jest.fn() as jest.MockedFunction<any>,
  generateEmbeddings: jest.fn() as jest.MockedFunction<any>,
};

// Mock WebSocket service
export const mockWebSocketService = {
  emit: jest.fn() as jest.MockedFunction<any>,
  broadcast: jest.fn() as jest.MockedFunction<any>,
  join: jest.fn() as jest.MockedFunction<any>,
  leave: jest.fn() as jest.MockedFunction<any>,
};

// Mock file system operations
export const mockFs = {
  writeFile: jest.fn() as jest.MockedFunction<any>,
  readFile: jest.fn() as jest.MockedFunction<any>,
  mkdir: jest.fn() as jest.MockedFunction<any>,
  unlink: jest.fn() as jest.MockedFunction<any>,
  stat: jest.fn() as jest.MockedFunction<any>,
};

// Create mock Next.js request
export function createMockRequest(
  method: string,
  url: string,
  body?: any,
  headers?: Record<string, string>
): NextRequest {
  const { req } = createMocks({
    method,
    url,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  });

  // Convert to NextRequest
  const nextReq = new NextRequest(new Request(`http://localhost:3000${url}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  }));

  return nextReq;
}

// Create mock authenticated request
export function createAuthenticatedRequest(
  method: string,
  url: string,
  body?: any,
  user = mockAuthenticatedUser
) {
  const req = createMockRequest(method, url, body, {
    authorization: 'Bearer mock-token',
  });

  // Add user to request (simulating auth middleware)
  (req as any).user = user;
  (req as any).session = { user };

  return req;
}

// Create mock form data
export function createMockFormData(fields: Record<string, any>): FormData {
  const formData = new FormData();
  
  Object.entries(fields).forEach(([key, value]) => {
    if (value instanceof File) {
      formData.append(key, value);
    } else if (typeof value === 'object') {
      formData.append(key, JSON.stringify(value));
    } else {
      formData.append(key, String(value));
    }
  });

  return formData;
}

// Create mock file
export function createMockFile(
  name: string,
  content: string,
  type: string = 'text/csv'
): File {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

// Setup function to run before each test
export function setupApiTest() {
  // Reset all mocks
  jest.clearAllMocks();
  
  // Mock Prisma
  jest.doMock('@/lib/prisma', () => ({
    prisma: mockPrisma,
  }));

  // Mock NextAuth
  jest.doMock('@/lib/auth', () => ({
    auth: jest.fn().mockResolvedValue(mockSession),
  }));

  // Mock Queue Manager
  jest.doMock('@/lib/queue', () => ({
    QueueManager: mockQueueManager,
  }));

  // Mock AI Service
  jest.doMock('@/lib/ai/ai-service', () => ({
    aiService: mockAiService,
  }));

  // Mock WebSocket
  jest.doMock('@/lib/websocket', () => mockWebSocketService);

  // Mock file system
  jest.doMock('fs/promises', () => mockFs);

  // Mock logger
  jest.doMock('@/lib/logger', () => ({
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
  }));
}

// Cleanup function to run after each test
export function cleanupApiTest() {
  jest.resetAllMocks();
  jest.restoreAllMocks();
}

// Test data generators
export const testData = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  
  job: {
    id: 'test-job-id',
    type: 'FILE_PROCESSING',
    title: 'Process test file',
    description: 'Processing uploaded test file',
    status: 'PENDING',
    userId: 'test-user-id',
    progress: 0,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  
  upload: {
    id: 'test-upload-id',
    fileName: 'test-file.csv',
    originalName: 'test-file.csv',
    fileSize: 1024,
    fileType: 'text/csv',
    status: 'PENDING',
    userId: 'test-user-id',
    jobId: 'test-job-id',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  
  account: {
    id: 'test-account-id',
    name: 'Test Company',
    domain: 'testcompany.com',
    industry: 'Technology',
    size: 'MEDIUM',
    location: 'San Francisco, CA',
    description: 'A test company for API testing',
    revenue: 10000000,
    employees: 100,
    technologies: [],
    insights: [],
    contacts: [],
    _count: {
      technologies: 0,
      insights: 0,
      contacts: 0,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  
  chatSession: {
    id: 'test-session-id',
    title: 'Test Chat Session',
    userId: 'test-user-id',
    context: {},
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  
  chatMessage: {
    id: 'test-message-id',
    sessionId: 'test-session-id',
    role: 'USER',
    content: 'Hello, this is a test message',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

// Performance metrics tracking
export interface PerformanceMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  payloadSize?: number;
  errorRate: number;
  throughput?: number;
}

export class PerformanceTracker {
  private metrics: PerformanceMetrics[] = [];

  track(metric: PerformanceMetrics) {
    this.metrics.push(metric);
  }

  getMetrics(): PerformanceMetrics[] {
    return this.metrics;
  }

  getAverageResponseTime(endpoint?: string): number {
    const filtered = endpoint 
      ? this.metrics.filter(m => m.endpoint === endpoint)
      : this.metrics;
    
    if (filtered.length === 0) return 0;
    
    const total = filtered.reduce((sum, m) => sum + m.responseTime, 0);
    return total / filtered.length;
  }

  getErrorRate(endpoint?: string): number {
    const filtered = endpoint 
      ? this.metrics.filter(m => m.endpoint === endpoint)
      : this.metrics;
    
    if (filtered.length === 0) return 0;
    
    const errors = filtered.filter(m => m.statusCode >= 400).length;
    return (errors / filtered.length) * 100;
  }

  getP95ResponseTime(endpoint?: string): number {
    const filtered = endpoint 
      ? this.metrics.filter(m => m.endpoint === endpoint)
      : this.metrics;
    
    if (filtered.length === 0) return 0;
    
    const sorted = filtered.map(m => m.responseTime).sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[index] || 0;
  }

  reset() {
    this.metrics = [];
  }

  generateReport(): string {
    const endpoints = [...new Set(this.metrics.map(m => m.endpoint))];
    
    let report = '\n=== API Performance Report ===\n\n';
    
    endpoints.forEach(endpoint => {
      const avgTime = this.getAverageResponseTime(endpoint);
      const errorRate = this.getErrorRate(endpoint);
      const p95Time = this.getP95ResponseTime(endpoint);
      const count = this.metrics.filter(m => m.endpoint === endpoint).length;
      
      report += `${endpoint}:\n`;
      report += `  Requests: ${count}\n`;
      report += `  Avg Response Time: ${avgTime.toFixed(2)}ms\n`;
      report += `  P95 Response Time: ${p95Time.toFixed(2)}ms\n`;
      report += `  Error Rate: ${errorRate.toFixed(2)}%\n\n`;
    });
    
    return report;
  }
}

export const performanceTracker = new PerformanceTracker();
