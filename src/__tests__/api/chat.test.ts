/**
 * Chat API Tests
 * Tests for chat functionality
 */

import { POST } from '@/app/api/chat/route';

import {
  createAuthenticatedRequest,
  createMockRequest,
  setupApiTest,
  cleanupApiTest,
  mockPrisma,
  mockAiService,
  testData,
  performanceTracker
} from './setup';

describe('/api/chat', () => {
  beforeEach(() => {
    setupApiTest();
    
    // Reset AI service mocks
    mockAiService.sendChatMessage.mockResolvedValue({
      content: 'This is a test response from AI',
      model: 'test-model',
      usage: { tokens: 50 },
      finishReason: 'stop',
      metadata: {},
    });
    
    mockAiService.streamChatMessage.mockImplementation(async (message, context, callbacks) => {
      const response = 'This is a streamed response';
      callbacks.onToken('This ');
      callbacks.onToken('is ');
      callbacks.onToken('a ');
      callbacks.onToken('streamed ');
      callbacks.onToken('response');
      callbacks.onComplete(response);
    });
  });

  afterEach(() => {
    cleanupApiTest();
  });

  describe('POST /api/chat', () => {
    it('should require authentication', async () => {
      const req = createMockRequest('POST', '/api/chat', {
        message: 'Hello',
      });
      
      jest.doMock('@/app/(auth)/auth', () => ({
        auth: jest.fn().mockResolvedValue(null),
      }));

      const response = await POST(req);
      expect(response.status).toBe(401);
    });

    it('should handle non-streaming chat message', async () => {
      const messageData = {
        message: 'Hello, how are you?',
        streaming: false,
      };

      const req = createAuthenticatedRequest('POST', '/api/chat', messageData);
      
      // Mock session creation
      const mockSession = { ...testData.chatSession, messages: [] };
      mockPrisma.chatSession.create.mockResolvedValue(mockSession);
      
      // Mock message creation
      const mockUserMessage = { ...testData.chatMessage, content: messageData.message };
      const mockAssistantMessage = { 
        ...testData.chatMessage, 
        id: 'assistant-message-id',
        role: 'ASSISTANT',
        content: 'This is a test response from AI'
      };
      
      mockPrisma.chatMessage.create
        .mockResolvedValueOnce(mockUserMessage)
        .mockResolvedValueOnce(mockAssistantMessage);
      
      mockPrisma.chatSession.update.mockResolvedValue(mockSession);

      const startTime = Date.now();
      const response = await POST(req);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toMatchObject({
        success: true,
        data: {
          sessionId: mockSession.id,
          messageId: mockUserMessage.id,
          response: {
            id: mockAssistantMessage.id,
            content: 'This is a test response from AI',
            metadata: {},
            usage: { tokens: 50 },
          },
          suggestions: expect.any(Array),
        },
      });

      // Verify session creation
      expect(mockPrisma.chatSession.create).toHaveBeenCalledWith({
        data: {
          title: expect.stringContaining('Chat Session'),
          context: {},
          userId: 'test-user-id',
        },
        include: {
          messages: true,
        },
      });

      // Verify user message creation
      expect(mockPrisma.chatMessage.create).toHaveBeenCalledWith({
        data: {
          sessionId: mockSession.id,
          role: 'USER',
          content: messageData.message,
          metadata: {},
        },
      });

      // Verify AI service call
      expect(mockAiService.sendChatMessage).toHaveBeenCalledWith(
        messageData.message,
        {
          userId: 'test-user-id',
          sessionId: mockSession.id,
          accountId: undefined,
          accountName: undefined,
          previousMessages: [],
        },
        { sessionId: mockSession.id, provider: undefined }
      );

      performanceTracker.track({
        endpoint: '/api/chat',
        method: 'POST',
        responseTime,
        statusCode: response.status,
        errorRate: 0,
      });
    });

    it('should handle streaming chat message', async () => {
      const messageData = {
        message: 'Tell me about streaming',
        streaming: true,
      };

      const req = createAuthenticatedRequest('POST', '/api/chat', messageData);
      
      const mockSession = { ...testData.chatSession, messages: [] };
      mockPrisma.chatSession.create.mockResolvedValue(mockSession);
      
      const mockUserMessage = { ...testData.chatMessage, content: messageData.message };
      mockPrisma.chatMessage.create.mockResolvedValue(mockUserMessage);

      const response = await POST(req);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/event-stream');
      expect(response.headers.get('cache-control')).toBe('no-cache');
      expect(response.headers.get('connection')).toBe('keep-alive');

      // Verify streaming service was called
      expect(mockAiService.streamChatMessage).toHaveBeenCalled();
    });

    it('should handle existing session', async () => {
      const messageData = {
        message: 'Follow up message',
        sessionId: 'existing-session-id',
      };

      const req = createAuthenticatedRequest('POST', '/api/chat', messageData);
      
      const existingSession = {
        ...testData.chatSession,
        id: 'existing-session-id',
        messages: [
          { ...testData.chatMessage, content: 'Previous message' },
        ],
      };
      
      mockPrisma.chatSession.findFirst.mockResolvedValue(existingSession);
      mockPrisma.chatMessage.create.mockResolvedValue({
        ...testData.chatMessage,
        content: messageData.message
      });
      mockPrisma.chatSession.update.mockResolvedValue(existingSession);

      const response = await POST(req);
      expect(response.status).toBe(200);

      // Should not create new session
      expect(mockPrisma.chatSession.create).not.toHaveBeenCalled();
      
      // Should find existing session
      expect(mockPrisma.chatSession.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'existing-session-id',
          userId: 'test-user-id',
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 20,
          },
        },
      });
    });

    it('should handle account context', async () => {
      const messageData = {
        message: 'Tell me about this company',
        context: {
          accountId: 'test-account-id',
          accountName: 'Test Company',
        },
      };

      const req = createAuthenticatedRequest('POST', '/api/chat', messageData);
      
      const mockSession = { ...testData.chatSession, messages: [] };
      mockPrisma.chatSession.create.mockResolvedValue(mockSession);
      mockPrisma.chatMessage.create.mockResolvedValueOnce({
        ...testData.chatMessage,
        content: messageData.message,
        metadata: messageData.context
      }).mockResolvedValueOnce({
        ...testData.chatMessage,
        role: 'ASSISTANT',
        content: 'AI response about the company'
      });
      mockPrisma.chatSession.update.mockResolvedValue(mockSession);

      const response = await POST(req);
      expect(response.status).toBe(200);

      // Verify session created with account context
      expect(mockPrisma.chatSession.create).toHaveBeenCalledWith({
        data: {
          title: 'Chat about Test Company',
          context: messageData.context,
          userId: 'test-user-id',
        },
        include: {
          messages: true,
        },
      });

      // Verify AI service received context
      expect(mockAiService.sendChatMessage).toHaveBeenCalledWith(
        messageData.message,
        expect.objectContaining({
          accountId: 'test-account-id',
          accountName: 'Test Company',
        }),
        expect.any(Object)
      );
    });

    it('should validate message length', async () => {
      const messageData = {
        message: 'x'.repeat(5000), // Exceeds 4000 character limit
      };

      const req = createAuthenticatedRequest('POST', '/api/chat', messageData);
      
      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('should require message content', async () => {
      const req = createAuthenticatedRequest('POST', '/api/chat', {
        // Missing message field
        streaming: false,
      });

      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('should handle invalid session ID', async () => {
      const messageData = {
        message: 'Hello',
        sessionId: 'non-existent-session',
      };

      const req = createAuthenticatedRequest('POST', '/api/chat', messageData);
      
      mockPrisma.chatSession.findFirst.mockResolvedValue(null);

      const response = await POST(req);
      expect(response.status).toBe(500);
      
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should handle AI service errors', async () => {
      const messageData = {
        message: 'This will cause an error',
        streaming: false,
      };

      const req = createAuthenticatedRequest('POST', '/api/chat', messageData);
      
      const mockSession = { ...testData.chatSession, messages: [] };
      mockPrisma.chatSession.create.mockResolvedValue(mockSession);
      mockPrisma.chatMessage.create.mockResolvedValue({
        ...testData.chatMessage,
        content: messageData.message
      });
      
      // Mock AI service error
      mockAiService.sendChatMessage.mockRejectedValue(new Error('AI service error'));

      const response = await POST(req);
      expect(response.status).toBe(500);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Failed to process chat message');
    });

    it('should handle rate limit errors', async () => {
      const messageData = {
        message: 'Rate limited message',
        streaming: false,
      };

      const req = createAuthenticatedRequest('POST', '/api/chat', messageData);
      
      const mockSession = { ...testData.chatSession, messages: [] };
      mockPrisma.chatSession.create.mockResolvedValue(mockSession);
      mockPrisma.chatMessage.create.mockResolvedValue({
        ...testData.chatMessage,
        content: messageData.message
      });
      
      mockAiService.sendChatMessage.mockRejectedValue(new Error('Rate limit exceeded'));

      const response = await POST(req);
      expect(response.status).toBe(429);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Rate limit exceeded');
    });

    it('should handle provider selection', async () => {
      const messageData = {
        message: 'Test with specific provider',
        provider: 'direct',
      };

      const req = createAuthenticatedRequest('POST', '/api/chat', messageData);
      
      const mockSession = { ...testData.chatSession, messages: [] };
      mockPrisma.chatSession.create.mockResolvedValue(mockSession);
      mockPrisma.chatMessage.create.mockResolvedValueOnce({
        ...testData.chatMessage,
        content: messageData.message
      }).mockResolvedValueOnce({
        ...testData.chatMessage,
        role: 'ASSISTANT',
        content: 'Direct provider response'
      });
      mockPrisma.chatSession.update.mockResolvedValue(mockSession);

      const response = await POST(req);
      expect(response.status).toBe(200);

      expect(mockAiService.sendChatMessage).toHaveBeenCalledWith(
        messageData.message,
        expect.any(Object),
        { sessionId: mockSession.id, provider: 'direct' }
      );
    });
  });

  describe('Suggestion Generation', () => {
    it('should generate account-specific suggestions', async () => {
      const messageData = {
        message: 'Tell me about technology stack',
        context: {
          accountId: 'test-account-id',
          accountName: 'Test Company',
        },
      };

      const req = createAuthenticatedRequest('POST', '/api/chat', messageData);
      
      const mockSession = { ...testData.chatSession, messages: [] };
      mockPrisma.chatSession.create.mockResolvedValue(mockSession);
      mockPrisma.chatMessage.create.mockResolvedValueOnce({
        ...testData.chatMessage,
        content: messageData.message
      }).mockResolvedValueOnce({
        ...testData.chatMessage,
        role: 'ASSISTANT',
        content: 'Response about technology'
      });
      mockPrisma.chatSession.update.mockResolvedValue(mockSession);

      const response = await POST(req);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.data.suggestions).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Test Company'),
        ])
      );
    });

    it('should generate general suggestions without context', async () => {
      const messageData = {
        message: 'Tell me about accounts',
      };

      const req = createAuthenticatedRequest('POST', '/api/chat', messageData);
      
      const mockSession = { ...testData.chatSession, messages: [] };
      mockPrisma.chatSession.create.mockResolvedValue(mockSession);
      mockPrisma.chatMessage.create.mockResolvedValueOnce({
        ...testData.chatMessage,
        content: messageData.message
      }).mockResolvedValueOnce({
        ...testData.chatMessage,
        role: 'ASSISTANT',
        content: 'Response about accounts'
      });
      mockPrisma.chatSession.update.mockResolvedValue(mockSession);

      const response = await POST(req);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.data.suggestions).toEqual(
        expect.arrayContaining([
          expect.stringContaining('accounts'),
        ])
      );
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent chat requests', async () => {
      const concurrentChats = 3;
      const requests = Array.from({ length: concurrentChats }, (_, i) => {
        const messageData = {
          message: `Concurrent message ${i + 1}`,
          streaming: false,
        };
        return POST(createAuthenticatedRequest('POST', '/api/chat', messageData));
      });

      // Mock responses for each request
      mockPrisma.chatSession.create.mockImplementation(() => 
        Promise.resolve({ ...testData.chatSession, messages: [] })
      );
      mockPrisma.chatMessage.create.mockImplementation((data) =>
        Promise.resolve({ ...testData.chatMessage, ...data.data })
      );
      mockPrisma.chatSession.update.mockResolvedValue(testData.chatSession);

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      const avgTime = totalTime / concurrentChats;
      console.log(`Handled ${concurrentChats} concurrent chats in ${totalTime}ms (avg: ${avgTime.toFixed(2)}ms)`);
    });

    it('should have reasonable response time for chat', async () => {
      const messageData = {
        message: 'Quick response test',
        streaming: false,
      };

      const req = createAuthenticatedRequest('POST', '/api/chat', messageData);
      
      const mockSession = { ...testData.chatSession, messages: [] };
      mockPrisma.chatSession.create.mockResolvedValue(mockSession);
      mockPrisma.chatMessage.create.mockResolvedValueOnce({
        ...testData.chatMessage,
        content: messageData.message
      }).mockResolvedValueOnce({
        ...testData.chatMessage,
        role: 'ASSISTANT',
        content: 'Quick response'
      });
      mockPrisma.chatSession.update.mockResolvedValue(mockSession);

      const startTime = Date.now();
      const response = await POST(req);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds

      console.log(`Chat response time: ${responseTime}ms`);
    });
  });

  describe('Message History', () => {
    it('should include previous messages in context', async () => {
      const messageData = {
        message: 'Follow up question',
        sessionId: 'existing-session-id',
      };

      const req = createAuthenticatedRequest('POST', '/api/chat', messageData);
      
      const existingSession = {
        ...testData.chatSession,
        id: 'existing-session-id',
        messages: [
          { ...testData.chatMessage, role: 'USER', content: 'Previous user message' },
          { ...testData.chatMessage, role: 'ASSISTANT', content: 'Previous AI response' },
        ],
      };
      
      mockPrisma.chatSession.findFirst.mockResolvedValue(existingSession);
      mockPrisma.chatMessage.create.mockResolvedValueOnce({
        ...testData.chatMessage,
        content: messageData.message
      }).mockResolvedValueOnce({
        ...testData.chatMessage,
        role: 'ASSISTANT',
        content: 'Response with context'
      });
      mockPrisma.chatSession.update.mockResolvedValue(existingSession);

      const response = await POST(req);
      expect(response.status).toBe(200);

      expect(mockAiService.sendChatMessage).toHaveBeenCalledWith(
        messageData.message,
        expect.objectContaining({
          previousMessages: [
            { role: 'user', content: 'Previous user message', metadata: {} },
            { role: 'assistant', content: 'Previous AI response', metadata: {} },
          ],
        }),
        expect.any(Object)
      );
    });

    it('should limit message history to 20 messages', async () => {
      const messageData = {
        message: 'Message with long history',
        sessionId: 'session-with-long-history',
      };

      const req = createAuthenticatedRequest('POST', '/api/chat', messageData);
      
      // Create session with 25 messages (should only get last 20)
      const messages = Array.from({ length: 25 }, (_, i) => ({
        ...testData.chatMessage,
        id: `message-${i}`,
        content: `Message ${i}`,
        role: i % 2 === 0 ? 'USER' : 'ASSISTANT',
      }));
      
      const existingSession = {
        ...testData.chatSession,
        id: 'session-with-long-history',
        messages,
      };
      
      mockPrisma.chatSession.findFirst.mockResolvedValue(existingSession);
      mockPrisma.chatMessage.create.mockResolvedValueOnce({
        ...testData.chatMessage,
        content: messageData.message
      }).mockResolvedValueOnce({
        ...testData.chatMessage,
        role: 'ASSISTANT',
        content: 'Response'
      });
      mockPrisma.chatSession.update.mockResolvedValue(existingSession);

      const response = await POST(req);
      expect(response.status).toBe(200);

      // Verify that the query was made with take: 20
      expect(mockPrisma.chatSession.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              take: 20,
            },
          },
        })
      );
    });
  });
});
