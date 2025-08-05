/**
 * AI Service - Main abstraction layer for all AI services
 */

import { logger } from "../logger";
import { redis } from "../redis";
import { RATE_LIMITS, SERVICE_REGISTRY } from "./config";
import { EmbeddingService } from "./embedding-service";
import { FlowiseClient } from "./flowise-client";
import { InsightGenerator } from "./insight-generator";
import { LLMService } from "./llm-service";
import { NormalizationService } from "./normalization-service";
import {
  AIResponse,
  AIServiceMetrics,
  AIServiceProvider,
  ChatContext,
  ChatMessage,
  EmbeddingResponse,
  GeneratedInsight,
  InsightGenerationRequest,
  NormalizationRequest,
  NormalizedData,
  RateLimitConfig,
  ServiceHealth,
  StreamingOptions,
} from "./types";

export class AIService {
  private flowiseClient: FlowiseClient;
  private llmService: LLMService;
  private embeddingService: EmbeddingService;
  private insightGenerator: InsightGenerator;
  private normalizationService: NormalizationService;
  private rateLimiters: Map<string, RateLimiter> = new Map();

  constructor() {
    this.flowiseClient = new FlowiseClient();
    this.llmService = new LLMService();
    this.embeddingService = new EmbeddingService();
    this.insightGenerator = new InsightGenerator();
    this.normalizationService = new NormalizationService();

    this.initializeRateLimiters();
  }

  // ===================
  // CHAT SERVICES
  // ===================

  /**
   * Send chat message using Flowise
   */
  async sendChatMessage(
    message: string,
    context: ChatContext,
    options?: {
      streaming?: boolean;
      sessionId?: string;
      provider?: "flowise" | "direct";
    },
  ): Promise<AIResponse> {
    await this.checkRateLimit("chat", context.userId);

    try {
      if (options?.provider === "direct" || !this.isFlowiseAvailable()) {
        // Use direct LLM service
        const messages = this.buildChatMessages(message, context);
        return await this.llmService.generateCompletion(
          messages,
          SERVICE_REGISTRY.chat === "flowise" ? "openai" : SERVICE_REGISTRY.chat,
        );
      }

      // Use Flowise
      return await this.flowiseClient.sendMessage(message, context, options);
    } catch (error) {
      logger.error("Chat message error", {
        userId: context.userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Stream chat message
   */
  async streamChatMessage(
    message: string,
    context: ChatContext,
    streamingOptions: StreamingOptions,
    options?: {
      sessionId?: string;
      provider?: "flowise" | "direct";
    },
  ): Promise<void> {
    await this.checkRateLimit("chat", context.userId);

    try {
      if (options?.provider === "direct" || !this.isFlowiseAvailable()) {
        // Use direct LLM service
        const messages = this.buildChatMessages(message, context);
        await this.llmService.streamCompletion(
          messages,
          streamingOptions,
          SERVICE_REGISTRY.chat === "flowise" ? "openai" : SERVICE_REGISTRY.chat,
        );
      } else {
        // Use Flowise
        await this.flowiseClient.streamMessage(message, context, streamingOptions, options);
      }
    } catch (error) {
      logger.error("Chat streaming error", {
        userId: context.userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      streamingOptions.onError?.(
        error instanceof Error ? error : new Error("Unknown streaming error"),
      );
    }
  }

  // ===================
  // EMBEDDING SERVICES
  // ===================

  /**
   * Generate embeddings for text
   */
  async generateEmbedding(
    text: string,
    options?: {
      provider?: AIServiceProvider;
      useCache?: boolean;
      dimensions?: number;
    },
  ): Promise<EmbeddingResponse> {
    const provider = options?.provider || SERVICE_REGISTRY.embeddings;

    return await this.embeddingService.generateEmbedding(text, provider, options);
  }

  /**
   * Generate batch embeddings
   */
  async generateBatchEmbeddings(
    texts: string[],
    options?: {
      provider?: AIServiceProvider;
      useCache?: boolean;
      batchSize?: number;
    },
  ): Promise<EmbeddingResponse[]> {
    const provider = options?.provider || SERVICE_REGISTRY.embeddings;

    return await this.embeddingService.generateBatchEmbeddings(texts, provider, options);
  }

  /**
   * Embed document with chunking
   */
  async embedDocument(
    text: string,
    options?: {
      provider?: AIServiceProvider;
      chunkSize?: number;
      chunkOverlap?: number;
      useCache?: boolean;
      metadata?: Record<string, any>;
    },
  ): Promise<
    Array<{
      chunk: string;
      embedding: number[];
      chunkIndex: number;
      metadata?: Record<string, any>;
    }>
  > {
    const provider = options?.provider || SERVICE_REGISTRY.embeddings;

    return await this.embeddingService.embedDocument(text, provider, options);
  }

  /**
   * Calculate similarity between embeddings
   */
  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    return this.embeddingService.calculateSimilarity(embedding1, embedding2);
  }

  /**
   * Find most similar embeddings
   */
  findMostSimilar(
    queryEmbedding: number[],
    embeddings: Array<{ id: string; embedding: number[]; metadata?: any }>,
    topK: number = 5,
  ): Array<{ id: string; similarity: number; metadata?: any }> {
    return this.embeddingService.findMostSimilar(queryEmbedding, embeddings, topK);
  }

  // ===================
  // INSIGHT GENERATION
  // ===================

  /**
   * Generate insights for account
   */
  async generateInsights(
    request: InsightGenerationRequest,
    options?: {
      provider?: AIServiceProvider;
      useCache?: boolean;
      maxInsights?: number;
      userId?: string;
    },
  ): Promise<GeneratedInsight[]> {
    if (options?.userId) {
      await this.checkRateLimit("insights", options.userId);
    }

    const provider = options?.provider || SERVICE_REGISTRY.insights;

    return await this.insightGenerator.generateInsights(request, {
      provider,
      useCache: options?.useCache,
      maxInsights: options?.maxInsights,
    });
  }

  /**
   * Generate specific type of insights
   */
  async generateSpecificInsights(
    request: InsightGenerationRequest,
    insightType: "technical" | "business" | "competitive",
    options?: {
      provider?: AIServiceProvider;
      maxInsights?: number;
      userId?: string;
    },
  ): Promise<GeneratedInsight[]> {
    if (options?.userId) {
      await this.checkRateLimit("insights", options.userId);
    }

    const provider = options?.provider || SERVICE_REGISTRY.insights;

    return await this.insightGenerator.generateSpecificInsights(request, insightType, {
      provider,
      maxInsights: options?.maxInsights,
    });
  }

  /**
   * Generate real-time insights
   */
  async generateRealtimeInsights(
    accountId: string,
    recentChanges: Array<{
      type: "technology" | "contact" | "funding" | "news";
      description: string;
      timestamp: Date;
      source: string;
    }>,
    options?: {
      provider?: AIServiceProvider;
      userId?: string;
    },
  ): Promise<GeneratedInsight[]> {
    if (options?.userId) {
      await this.checkRateLimit("insights", options.userId);
    }

    const provider = options?.provider || SERVICE_REGISTRY.insights;

    return await this.insightGenerator.generateRealtimeInsights(accountId, recentChanges, {
      provider,
    });
  }

  // ===================
  // DATA NORMALIZATION
  // ===================

  /**
   * Normalize company data
   */
  async normalizeCompanyData(
    rawData: Record<string, any>,
    options?: {
      provider?: AIServiceProvider;
      useCache?: boolean;
      strictMode?: boolean;
      userId?: string;
    },
  ): Promise<NormalizedData> {
    if (options?.userId) {
      await this.checkRateLimit("normalization", options.userId);
    }

    const provider = options?.provider || SERVICE_REGISTRY.normalization;

    return await this.normalizationService.normalizeCompanyData(rawData, {
      provider,
      useCache: options?.useCache,
      strictMode: options?.strictMode,
    });
  }

  /**
   * Normalize contact data
   */
  async normalizeContactData(
    contacts: Array<Record<string, any>>,
    options?: {
      provider?: AIServiceProvider;
      useCache?: boolean;
      deduplication?: boolean;
      userId?: string;
    },
  ): Promise<{
    normalized: Array<Record<string, any>>;
    duplicates: Array<{ indices: number[]; confidence: number }>;
    issues: Array<{
      index: number;
      field: string;
      issue: string;
      severity: "low" | "medium" | "high";
    }>;
  }> {
    if (options?.userId) {
      await this.checkRateLimit("normalization", options.userId);
    }

    const provider = options?.provider || SERVICE_REGISTRY.normalization;

    return await this.normalizationService.normalizeContactData(contacts, {
      provider,
      useCache: options?.useCache,
      deduplication: options?.deduplication,
    });
  }

  /**
   * Normalize technology data
   */
  async normalizeTechnologyData(
    technologies: Array<{ name: string; category?: string; confidence?: number }>,
    options?: {
      provider?: AIServiceProvider;
      standardizeNames?: boolean;
      categorize?: boolean;
      userId?: string;
    },
  ): Promise<{
    normalized: Array<{
      name: string;
      standardName: string;
      category: string;
      confidence: number;
      metadata?: Record<string, any>;
    }>;
    suggestions: Array<{
      original: string;
      suggested: string;
      reason: string;
    }>;
  }> {
    if (options?.userId) {
      await this.checkRateLimit("normalization", options.userId);
    }

    const provider = options?.provider || SERVICE_REGISTRY.normalization;

    return await this.normalizationService.normalizeTechnologyData(technologies, {
      provider,
      standardizeNames: options?.standardizeNames,
      categorize: options?.categorize,
    });
  }

  /**
   * Normalize with custom schema
   */
  async normalizeWithSchema(
    request: NormalizationRequest,
    options?: {
      provider?: AIServiceProvider;
      useCache?: boolean;
      userId?: string;
    },
  ): Promise<NormalizedData> {
    if (options?.userId) {
      await this.checkRateLimit("normalization", options.userId);
    }

    const provider = options?.provider || SERVICE_REGISTRY.normalization;

    return await this.normalizationService.normalizeWithSchema(request, {
      provider,
      useCache: options?.useCache,
    });
  }

  // ===================
  // SERVICE MANAGEMENT
  // ===================

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<Record<string, ServiceHealth>> {
    const services = ["flowise", "openai", "anthropic", "azure"] as const;
    const healthPromises = services.map(async (service) => {
      try {
        let health: ServiceHealth;

        switch (service) {
          case "flowise":
            const flowiseHealth = await this.flowiseClient.healthCheck();
            health = {
              status: flowiseHealth.status === "healthy" ? "healthy" : "unhealthy",
              latency: flowiseHealth.details?.latency || 0,
              errorRate: 0,
              lastCheck: new Date(),
              details: flowiseHealth.details,
            };
            break;
          default:
            health = await this.llmService.healthCheck(service);
        }

        return [service, health] as [string, ServiceHealth];
      } catch (error) {
        return [
          service,
          {
            status: "unhealthy" as const,
            latency: 0,
            errorRate: 1,
            lastCheck: new Date(),
            details: { error: error instanceof Error ? error.message : "Unknown error" },
          },
        ] as [string, ServiceHealth];
      }
    });

    const results = await Promise.all(healthPromises);
    return Object.fromEntries(results);
  }

  /**
   * Get service metrics
   */
  getServiceMetrics(): {
    llm: AIServiceMetrics | Map<AIServiceProvider, AIServiceMetrics>;
    embeddings: { keys: number; hits: number; misses: number; hitRate: number };
    insights: { keys: number; hits: number; misses: number; hitRate: number };
    normalization: { keys: number; hits: number; misses: number; hitRate: number };
  } {
    return {
      llm: this.llmService.getMetrics(),
      embeddings: this.embeddingService.getCacheStats(),
      insights: this.insightGenerator.getCacheStats(),
      normalization: this.normalizationService.getCacheStats(),
    };
  }

  /**
   * Clear service caches
   */
  clearCaches(service?: "embeddings" | "insights" | "normalization"): void {
    if (!service || service === "embeddings") {
      this.embeddingService.clearCache();
    }
    if (!service || service === "insights") {
      this.insightGenerator.clearCache();
    }
    if (!service || service === "normalization") {
      this.normalizationService.clearCache();
    }
  }

  /**
   * Reset service metrics
   */
  resetMetrics(provider?: AIServiceProvider): void {
    this.llmService.resetMetrics(provider);
  }

  // ===================
  // PRIVATE METHODS
  // ===================

  /**
   * Initialize rate limiters
   */
  private initializeRateLimiters(): void {
    for (const [service, config] of Object.entries(RATE_LIMITS)) {
      this.rateLimiters.set(service, new RateLimiter(config));
    }
  }

  /**
   * Check rate limit for service
   */
  private async checkRateLimit(service: string, userId: string): Promise<void> {
    const limiter = this.rateLimiters.get(service);
    if (!limiter) return;

    const allowed = await limiter.checkLimit(userId);
    if (!allowed) {
      throw new Error(`Rate limit exceeded for ${service}`);
    }
  }

  /**
   * Check if Flowise is available
   */
  private isFlowiseAvailable(): boolean {
    return !!(process.env.FLOWISE_BASE_URL && process.env.FLOWISE_CHATFLOW_ID);
  }

  /**
   * Build chat messages for direct LLM calls
   */
  private buildChatMessages(message: string, context: ChatContext): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // Add system message
    const systemPrompt = context.accountName
      ? `You are an AI sales intelligence assistant. You're currently helping analyze ${context.accountName}. Provide specific, actionable insights based on the available data.`
      : "You are an AI sales intelligence assistant. Help users analyze accounts, identify opportunities, and provide strategic insights.";

    messages.push({
      role: "system",
      content: systemPrompt,
    });

    // Add previous messages if available
    if (context.previousMessages) {
      messages.push(...context.previousMessages.slice(-10)); // Last 10 messages for context
    }

    // Add current message
    messages.push({
      role: "user",
      content: message,
    });

    return messages;
  }
}

/**
 * Rate Limiter Implementation
 */
class RateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  async checkLimit(userId: string): Promise<boolean> {
    const now = Date.now();
    const minuteKey = `rate_limit:${userId}:minute:${Math.floor(now / 60000)}`;
    const hourKey = `rate_limit:${userId}:hour:${Math.floor(now / 3600000)}`;
    const dayKey = `rate_limit:${userId}:day:${Math.floor(now / 86400000)}`;

    try {
      const [minuteCount, hourCount, dayCount] = await Promise.all([
        this.incrementCounter(minuteKey, 60),
        this.incrementCounter(hourKey, 3600),
        this.incrementCounter(dayKey, 86400),
      ]);

      return (
        minuteCount <= this.config.requestsPerMinute &&
        hourCount <= this.config.requestsPerHour &&
        dayCount <= this.config.requestsPerDay
      );
    } catch (error) {
      logger.warn("Rate limit check failed", { userId, error });
      return true; // Allow on error
    }
  }

  private async incrementCounter(key: string, ttl: number): Promise<number> {
    if (!redis) return 0;

    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, ttl);
    }
    return count;
  }
}

// Export singleton instance
export const aiService = new AIService();
export default aiService;
