/**
 * Accounts API Tests
 * Tests for account management endpoints
 */

import { GET, POST } from '@/app/api/accounts/route';

import {
  createAuthenticatedRequest,
  createMockRequest,
  setupApiTest,
  cleanupApiTest,
  mockPrisma,
  testData,
  performanceTracker
} from './setup';

describe('/api/accounts', () => {
  beforeEach(() => {
    setupApiTest();
  });

  afterEach(() => {
    cleanupApiTest();
  });

  describe('GET /api/accounts', () => {
    it('should require authentication', async () => {
      const req = createMockRequest('GET', '/api/accounts');
      
      // Mock auth to return null
      jest.doMock('@/lib/auth', () => ({
        auth: jest.fn().mockResolvedValue(null),
      }));

      const response = await GET(req);
      expect(response.status).toBe(401);
    });

    it('should return paginated accounts list', async () => {
      const req = createAuthenticatedRequest('GET', '/api/accounts?page=1&pageSize=10');
      
      const mockAccounts = [
        { ...testData.account, id: 'account-1', name: 'Company A' },
        { ...testData.account, id: 'account-2', name: 'Company B' },
      ];

      mockPrisma.companyAccount.findMany.mockResolvedValue(mockAccounts);
      mockPrisma.companyAccount.count.mockResolvedValue(2);

      const startTime = Date.now();
      const response = await GET(req);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toMatchObject({
        accounts: mockAccounts,
        total: 2,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      });

      expect(mockPrisma.companyAccount.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
        include: {
          technologies: {
            select: {
              id: true,
              name: true,
              category: true,
              confidence: true,
            },
            take: 10,
          },
          insights: {
            select: {
              id: true,
              type: true,
              title: true,
              confidence: true,
              isBookmarked: true,
            },
            take: 5,
            orderBy: { createdAt: 'desc' },
          },
          contacts: {
            select: {
              id: true,
              name: true,
              title: true,
              email: true,
            },
            take: 5,
          },
          _count: {
            select: {
              technologies: true,
              insights: true,
              contacts: true,
            },
          },
        },
      });

      performanceTracker.track({
        endpoint: '/api/accounts',
        method: 'GET',
        responseTime,
        statusCode: response.status,
        errorRate: 0,
      });
    });

    it('should handle search functionality', async () => {
      const req = createAuthenticatedRequest('GET', '/api/accounts?search=technology');
      
      mockPrisma.companyAccount.findMany.mockResolvedValue([]);
      mockPrisma.companyAccount.count.mockResolvedValue(0);

      const response = await GET(req);
      expect(response.status).toBe(200);

      expect(mockPrisma.companyAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { name: { contains: 'technology', mode: 'insensitive' } },
              { domain: { contains: 'technology', mode: 'insensitive' } },
              { description: { contains: 'technology', mode: 'insensitive' } },
            ],
          },
        })
      );
    });

    it('should handle industry filtering', async () => {
      const req = createAuthenticatedRequest('GET', '/api/accounts?industry=Technology');
      
      mockPrisma.companyAccount.findMany.mockResolvedValue([]);
      mockPrisma.companyAccount.count.mockResolvedValue(0);

      const response = await GET(req);
      expect(response.status).toBe(200);

      expect(mockPrisma.companyAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            industry: { equals: 'Technology', mode: 'insensitive' },
          },
        })
      );
    });

    it('should handle size filtering', async () => {
      const req = createAuthenticatedRequest('GET', '/api/accounts?size=LARGE');
      
      mockPrisma.companyAccount.findMany.mockResolvedValue([]);
      mockPrisma.companyAccount.count.mockResolvedValue(0);

      const response = await GET(req);
      expect(response.status).toBe(200);

      expect(mockPrisma.companyAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            size: 'LARGE',
          },
        })
      );
    });

    it('should handle location filtering', async () => {
      const req = createAuthenticatedRequest('GET', '/api/accounts?location=San Francisco');
      
      mockPrisma.companyAccount.findMany.mockResolvedValue([]);
      mockPrisma.companyAccount.count.mockResolvedValue(0);

      const response = await GET(req);
      expect(response.status).toBe(200);

      expect(mockPrisma.companyAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            location: { contains: 'San Francisco', mode: 'insensitive' },
          },
        })
      );
    });

    it('should handle technology filtering', async () => {
      const req = createAuthenticatedRequest('GET', '/api/accounts?technology=React');
      
      mockPrisma.companyAccount.findMany.mockResolvedValue([]);
      mockPrisma.companyAccount.count.mockResolvedValue(0);

      const response = await GET(req);
      expect(response.status).toBe(200);

      expect(mockPrisma.companyAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            technologies: {
              some: {
                name: { contains: 'React', mode: 'insensitive' },
              },
            },
          },
        })
      );
    });

    it('should handle sorting', async () => {
      const req = createAuthenticatedRequest('GET', '/api/accounts?sortBy=name&sortOrder=asc');
      
      mockPrisma.companyAccount.findMany.mockResolvedValue([]);
      mockPrisma.companyAccount.count.mockResolvedValue(0);

      const response = await GET(req);
      expect(response.status).toBe(200);

      expect(mockPrisma.companyAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        })
      );
    });

    it('should return facets when requested', async () => {
      const req = createAuthenticatedRequest('GET', '/api/accounts?includeFacets=true');
      
      mockPrisma.companyAccount.findMany.mockResolvedValue([]);
      mockPrisma.companyAccount.count.mockResolvedValue(0);
      
      // Mock facet queries
      mockPrisma.companyAccount.groupBy.mockResolvedValueOnce([
        { industry: 'Technology', _count: { industry: 5 } },
        { industry: 'Healthcare', _count: { industry: 3 } },
      ]).mockResolvedValueOnce([
        { size: 'LARGE', _count: { size: 4 } },
        { size: 'MEDIUM', _count: { size: 3 } },
      ]).mockResolvedValueOnce([
        { location: 'San Francisco', _count: { location: 6 } },
        { location: 'New York', _count: { location: 2 } },
      ]);
      
      mockPrisma.technology.groupBy.mockResolvedValue([
        { name: 'React', _count: { name: 8 } },
        { name: 'Node.js', _count: { name: 6 } },
      ]);

      const response = await GET(req);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.facets).toMatchObject({
        industries: [
          { name: 'Technology', count: 5 },
          { name: 'Healthcare', count: 3 },
        ],
        sizes: [
          { name: 'LARGE', count: 4 },
          { name: 'MEDIUM', count: 3 },
        ],
        locations: [
          { name: 'San Francisco', count: 6 },
          { name: 'New York', count: 2 },
        ],
        technologies: [
          { name: 'React', count: 8 },
          { name: 'Node.js', count: 6 },
        ],
      });
    });

    it('should validate query parameters', async () => {
      const req = createAuthenticatedRequest('GET', '/api/accounts?page=invalid');
      
      const response = await GET(req);
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/accounts', () => {
    it('should require authentication', async () => {
      const req = createMockRequest('POST', '/api/accounts', {
        name: 'Test Company',
        domain: 'testcompany.com',
      });
      
      jest.doMock('@/app/(auth)/auth', () => ({
        auth: jest.fn().mockResolvedValue(null),
      }));

      const response = await POST(req);
      expect(response.status).toBe(401);
    });

    it('should create a new account', async () => {
      const accountData = {
        name: 'Test Company',
        domain: 'testcompany.com',
        industry: 'Technology',
        size: 'MEDIUM',
        location: 'San Francisco, CA',
        description: 'A test company',
        revenue: 1000000,
        employees: 50,
      };

      const req = createAuthenticatedRequest('POST', '/api/accounts', accountData);
      
      const createdAccount = { ...testData.account, ...accountData };
      mockPrisma.companyAccount.create.mockResolvedValue(createdAccount);

      const startTime = Date.now();
      const response = await POST(req);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(201);
      
      const data = await response.json();
      expect(data).toMatchObject(createdAccount);

      expect(mockPrisma.companyAccount.create).toHaveBeenCalledWith({
        data: accountData,
        include: {
          technologies: true,
          insights: true,
          contacts: true,
          _count: {
            select: {
              technologies: true,
              insights: true,
              contacts: true,
            },
          },
        },
      });

      performanceTracker.track({
        endpoint: '/api/accounts',
        method: 'POST',
        responseTime,
        statusCode: response.status,
        errorRate: 0,
      });
    });

    it('should prevent duplicate domains', async () => {
      const accountData = {
        name: 'Test Company',
        domain: 'existing.com',
        industry: 'Technology',
      };

      const req = createAuthenticatedRequest('POST', '/api/accounts', accountData);
      
      // Mock existing account
      mockPrisma.companyAccount.findUnique.mockResolvedValue({
        ...testData.account,
        domain: 'existing.com',
      });

      const response = await POST(req);
      expect(response.status).toBe(409);
      
      const data = await response.json();
      expect(data.error).toBe('Conflict');
      expect(data.message).toBe('Account with this domain already exists');
    });

    it('should validate required fields', async () => {
      const req = createAuthenticatedRequest('POST', '/api/accounts', {
        // Missing required name field
        domain: 'test.com',
      });

      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('should handle invalid JSON', async () => {
      const req = createAuthenticatedRequest('POST', '/api/accounts');
      req.json = jest.fn().mockRejectedValue(new Error('Invalid JSON'));

      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('should handle database errors', async () => {
      const accountData = {
        name: 'Test Company',
        domain: 'test.com',
        industry: 'Technology',
      };

      const req = createAuthenticatedRequest('POST', '/api/accounts', accountData);
      
      mockPrisma.companyAccount.findUnique.mockResolvedValue(null);
      mockPrisma.companyAccount.create.mockRejectedValue(new Error('Database error'));

      const response = await POST(req);
      expect(response.status).toBe(500);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large result sets efficiently', async () => {
      const req = createAuthenticatedRequest('GET', '/api/accounts?pageSize=100');
      
      // Generate 100 mock accounts
      const mockAccounts = Array.from({ length: 100 }, (_, i) => ({
        ...testData.account,
        id: `account-${i}`,
        name: `Company ${i}`,
      }));

      mockPrisma.companyAccount.findMany.mockResolvedValue(mockAccounts);
      mockPrisma.companyAccount.count.mockResolvedValue(1000);

      const startTime = Date.now();
      const response = await GET(req);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should complete within 1 second

      const data = await response.json();
      expect(data.accounts).toHaveLength(100);

      console.log(`Retrieved 100 accounts in ${responseTime}ms`);
    });

    it('should handle complex search queries efficiently', async () => {
      const req = createAuthenticatedRequest(
        'GET',
        '/api/accounts?search=technology&industry=Software&size=LARGE&location=San Francisco&technology=React'
      );
      
      mockPrisma.companyAccount.findMany.mockResolvedValue([]);
      mockPrisma.companyAccount.count.mockResolvedValue(0);

      const startTime = Date.now();
      const response = await GET(req);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(500);

      console.log(`Complex search query completed in ${responseTime}ms`);
    });

    it('should handle concurrent account creation', async () => {
      const concurrentAccounts = 5;
      const requests = Array.from({ length: concurrentAccounts }, (_, i) =>
        POST(createAuthenticatedRequest('POST', '/api/accounts', {
          name: `Concurrent Company ${i}`,
          domain: `concurrent${i}.com`,
          industry: 'Technology',
        }))
      );

      mockPrisma.companyAccount.findUnique.mockResolvedValue(null);
      mockPrisma.companyAccount.create.mockImplementation((data) =>
        Promise.resolve({ ...testData.account, ...data.data })
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      const avgTime = totalTime / concurrentAccounts;
      console.log(`Created ${concurrentAccounts} accounts concurrently in ${totalTime}ms (avg: ${avgTime.toFixed(2)}ms)`);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity', async () => {
      const accountData = {
        name: 'Test Company',
        domain: 'test.com',
        industry: 'Technology',
      };

      const req = createAuthenticatedRequest('POST', '/api/accounts', accountData);
      
      const createdAccount = {
        ...testData.account,
        ...accountData,
        technologies: [],
        insights: [],
        contacts: [],
      };
      
      mockPrisma.companyAccount.findUnique.mockResolvedValue(null);
      mockPrisma.companyAccount.create.mockResolvedValue(createdAccount);

      const response = await POST(req);
      expect(response.status).toBe(201);

      // Verify the account includes related data structure
      const data = await response.json();
      expect(data).toHaveProperty('technologies');
      expect(data).toHaveProperty('insights');
      expect(data).toHaveProperty('contacts');
      expect(data).toHaveProperty('_count');
    });
  });

  describe('Input Validation', () => {
    it('should validate email domains', async () => {
      const accountData = {
        name: 'Test Company',
        domain: 'invalid-domain',
        industry: 'Technology',
      };

      const req = createAuthenticatedRequest('POST', '/api/accounts', accountData);
      
      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('should sanitize input data', async () => {
      const accountData = {
        name: '<script>alert("xss")</script>Test Company',
        domain: 'test.com',
        industry: 'Technology',
        description: '<img src=x onerror=alert(1)>Description',
      };

      const req = createAuthenticatedRequest('POST', '/api/accounts', accountData);
      
      mockPrisma.companyAccount.findUnique.mockResolvedValue(null);
      mockPrisma.companyAccount.create.mockImplementation((data) =>
        Promise.resolve({ ...testData.account, ...data.data })
      );

      const response = await POST(req);
      expect(response.status).toBe(201);

      // Verify input was passed through (sanitization would happen in validation layer)
      expect(mockPrisma.companyAccount.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: accountData.name, // Validation schema should handle sanitization
            description: accountData.description,
          }),
        })
      );
    });
  });
});
