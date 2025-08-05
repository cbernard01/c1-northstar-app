/**
 * LLM Service - Unified interface for various LLM providers
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

import { logger } from "../logger";
import { AI_CONFIG, COST_CONFIG, MODEL_CONFIG } from "./config";
import {
  AIResponse,
  AIServiceMetrics,
  AIServiceProvider,
  ChatMessage,
  ServiceHealth,
  StreamingOptions,
} from "./types";

export class LLMService {
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private metrics: Map<AIServiceProvider, AIServiceMetrics> = new Map();

  constructor() {
    this.initializeClients();
  }

  /**
   * Initialize AI clients based on available configurations
   */
  private initializeClients() {
    if (AI_CONFIG.openai.apiKey) {
      this.openai = new OpenAI({
        apiKey: AI_CONFIG.openai.apiKey,
        baseURL: AI_CONFIG.openai.baseUrl,
        timeout: AI_CONFIG.openai.timeout,
      });
    }

    if (AI_CONFIG.anthropic.apiKey) {
      this.anthropic = new Anthropic({
        apiKey: AI_CONFIG.anthropic.apiKey,
        baseURL: AI_CONFIG.anthropic.baseUrl,
        timeout: AI_CONFIG.anthropic.timeout,
      });
    }
  }

  /**
   * Generate completion using specified provider
   */
  async generateCompletion(
    messages: ChatMessage[],
    provider: AIServiceProvider = "openai",
    options?: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      stream?: boolean;
    },
  ): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      let response: AIResponse;

      switch (provider) {
        case "openai":
          response = await this.generateOpenAICompletion(messages, options);
          break;
        case "anthropic":
          response = await this.generateAnthropicCompletion(messages, options);
          break;
        case "azure":
          response = await this.generateAzureCompletion(messages, options);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      this.updateMetrics(provider, startTime, true, response.usage?.totalTokens || 0);
      return response;
    } catch (error) {
      this.updateMetrics(provider, startTime, false, 0);
      logger.error("LLM completion error", {
        provider,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Stream completion using specified provider
   */
  async streamCompletion(
    messages: ChatMessage[],
    streamingOptions: StreamingOptions,
    provider: AIServiceProvider = "openai",
    options?: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
    },
  ): Promise<void> {
    const startTime = Date.now();

    try {
      switch (provider) {
        case "openai":
          await this.streamOpenAICompletion(messages, streamingOptions, options);
          break;
        case "anthropic":
          await this.streamAnthropicCompletion(messages, streamingOptions, options);
          break;
        case "azure":
          await this.streamAzureCompletion(messages, streamingOptions, options);
          break;
        default:
          throw new Error(`Unsupported provider for streaming: ${provider}`);
      }

      this.updateMetrics(provider, startTime, true, 0); // Token count updated during streaming
    } catch (error) {
      this.updateMetrics(provider, startTime, false, 0);
      logger.error("LLM streaming error", {
        provider,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      streamingOptions.onError?.(
        error instanceof Error ? error : new Error("Unknown streaming error"),
      );
    }
  }

  /**
   * OpenAI completion
   */
  private async generateOpenAICompletion(
    messages: ChatMessage[],
    options?: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
    },
  ): Promise<AIResponse> {
    if (!this.openai) {
      throw new Error("OpenAI client not initialized");
    }

    const model = options?.model || MODEL_CONFIG.chat.openai;
    const maxTokens = options?.maxTokens || AI_CONFIG.openai.maxTokens;
    const temperature = options?.temperature || AI_CONFIG.openai.temperature;

    const response = await this.openai.chat.completions.create({
      model,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      max_tokens: maxTokens,
      temperature,
      stream: false,
    });

    const choice = response.choices[0];
    if (!choice?.message?.content) {
      throw new Error("No content in OpenAI response");
    }

    return {
      content: choice.message.content,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      model: response.model,
      finishReason: choice.finish_reason || undefined,
    };
  }

  /**
   * OpenAI streaming completion
   */
  private async streamOpenAICompletion(
    messages: ChatMessage[],
    streamingOptions: StreamingOptions,
    options?: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
    },
  ): Promise<void> {
    if (!this.openai) {
      throw new Error("OpenAI client not initialized");
    }

    const model = options?.model || MODEL_CONFIG.chat.openai;
    const maxTokens = options?.maxTokens || AI_CONFIG.openai.maxTokens;
    const temperature = options?.temperature || AI_CONFIG.openai.temperature;

    const stream = await this.openai.chat.completions.create({
      model,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      max_tokens: maxTokens,
      temperature,
      stream: true,
    });

    let fullResponse = "";

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullResponse += content;
        streamingOptions.onToken?.(content);
      }

      if (chunk.choices[0]?.finish_reason) {
        streamingOptions.onComplete?.(fullResponse);
        break;
      }
    }
  }

  /**
   * Anthropic completion
   */
  private async generateAnthropicCompletion(
    messages: ChatMessage[],
    options?: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
    },
  ): Promise<AIResponse> {
    if (!this.anthropic) {
      throw new Error("Anthropic client not initialized");
    }

    const model = options?.model || MODEL_CONFIG.chat.anthropic;
    const maxTokens = options?.maxTokens || AI_CONFIG.anthropic.maxTokens;
    const temperature = options?.temperature || AI_CONFIG.anthropic.temperature;

    // Extract system message if present
    const systemMessage = messages.find((msg) => msg.role === "system")?.content;
    const conversationMessages = messages.filter((msg) => msg.role !== "system");

    const response = await this.anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemMessage,
      messages: conversationMessages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected content type from Anthropic");
    }

    return {
      content: content.text,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      model: response.model,
      finishReason: response.stop_reason || undefined,
    };
  }

  /**
   * Anthropic streaming completion
   */
  private async streamAnthropicCompletion(
    messages: ChatMessage[],
    streamingOptions: StreamingOptions,
    options?: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
    },
  ): Promise<void> {
    if (!this.anthropic) {
      throw new Error("Anthropic client not initialized");
    }

    const model = options?.model || MODEL_CONFIG.chat.anthropic;
    const maxTokens = options?.maxTokens || AI_CONFIG.anthropic.maxTokens;
    const temperature = options?.temperature || AI_CONFIG.anthropic.temperature;

    const systemMessage = messages.find((msg) => msg.role === "system")?.content;
    const conversationMessages = messages.filter((msg) => msg.role !== "system");

    const stream = await this.anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemMessage,
      messages: conversationMessages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      stream: true,
    });

    let fullResponse = "";

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        const content = event.delta.text;
        fullResponse += content;
        streamingOptions.onToken?.(content);
      } else if (event.type === "message_stop") {
        streamingOptions.onComplete?.(fullResponse);
        break;
      }
    }
  }

  /**
   * Azure OpenAI completion (similar to OpenAI but with different configuration)
   */
  private async generateAzureCompletion(
    messages: ChatMessage[],
    options?: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
    },
  ): Promise<AIResponse> {
    // Azure OpenAI uses the same client as OpenAI but with different base URL
    const azureClient = new OpenAI({
      apiKey: AI_CONFIG.azure.apiKey,
      baseURL: `${AI_CONFIG.azure.baseUrl}/openai/deployments/${options?.model || MODEL_CONFIG.chat.azure}`,
      defaultQuery: { "api-version": "2024-02-15-preview" },
      defaultHeaders: {
        "api-key": AI_CONFIG.azure.apiKey,
      },
    });

    const response = await azureClient.chat.completions.create({
      model: options?.model || MODEL_CONFIG.chat.azure,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      max_tokens: options?.maxTokens || AI_CONFIG.azure.maxTokens,
      temperature: options?.temperature || AI_CONFIG.azure.temperature,
    });

    const choice = response.choices[0];
    if (!choice?.message?.content) {
      throw new Error("No content in Azure OpenAI response");
    }

    return {
      content: choice.message.content,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      model: response.model,
      finishReason: choice.finish_reason || undefined,
    };
  }

  /**
   * Azure OpenAI streaming completion
   */
  private async streamAzureCompletion(
    messages: ChatMessage[],
    streamingOptions: StreamingOptions,
    options?: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
    },
  ): Promise<void> {
    const azureClient = new OpenAI({
      apiKey: AI_CONFIG.azure.apiKey,
      baseURL: `${AI_CONFIG.azure.baseUrl}/openai/deployments/${options?.model || MODEL_CONFIG.chat.azure}`,
      defaultQuery: { "api-version": "2024-02-15-preview" },
      defaultHeaders: {
        "api-key": AI_CONFIG.azure.apiKey,
      },
    });

    const stream = await azureClient.chat.completions.create({
      model: options?.model || MODEL_CONFIG.chat.azure,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      max_tokens: options?.maxTokens || AI_CONFIG.azure.maxTokens,
      temperature: options?.temperature || AI_CONFIG.azure.temperature,
      stream: true,
    });

    let fullResponse = "";

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullResponse += content;
        streamingOptions.onToken?.(content);
      }

      if (chunk.choices[0]?.finish_reason) {
        streamingOptions.onComplete?.(fullResponse);
        break;
      }
    }
  }

  /**
   * Update service metrics
   */
  private updateMetrics(
    provider: AIServiceProvider,
    startTime: number,
    success: boolean,
    tokens: number,
  ) {
    const latency = Date.now() - startTime;
    const existing = this.metrics.get(provider) || {
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      totalTokensUsed: 0,
      averageLatency: 0,
      costEstimate: 0,
    };

    const newMetrics: AIServiceMetrics = {
      requestCount: existing.requestCount + 1,
      successCount: existing.successCount + (success ? 1 : 0),
      errorCount: existing.errorCount + (success ? 0 : 1),
      totalTokensUsed: existing.totalTokensUsed + tokens,
      averageLatency:
        (existing.averageLatency * existing.requestCount + latency) / (existing.requestCount + 1),
      costEstimate: existing.costEstimate + this.calculateCost(provider, tokens),
      lastRequestAt: new Date(),
    };

    this.metrics.set(provider, newMetrics);
  }

  /**
   * Calculate cost estimate for tokens used
   */
  private calculateCost(provider: AIServiceProvider, tokens: number): number {
    const costs = COST_CONFIG[provider as keyof typeof COST_CONFIG];
    if (!costs) return 0;

    // Simplified cost calculation (assumes average input/output split)
    const avgCost = Object.values(costs)[0];
    if (avgCost && typeof avgCost === "object" && "input" in avgCost && "output" in avgCost) {
      return ((tokens / 1000) * (avgCost.input + avgCost.output)) / 2;
    }

    return 0;
  }

  /**
   * Get service metrics
   */
  getMetrics(
    provider?: AIServiceProvider,
  ): AIServiceMetrics | Map<AIServiceProvider, AIServiceMetrics> {
    if (provider) {
      return (
        this.metrics.get(provider) || {
          requestCount: 0,
          successCount: 0,
          errorCount: 0,
          totalTokensUsed: 0,
          averageLatency: 0,
          costEstimate: 0,
        }
      );
    }
    return this.metrics;
  }

  /**
   * Health check for LLM services
   */
  async healthCheck(provider: AIServiceProvider): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      const testMessage: ChatMessage[] = [
        { role: "user", content: "Hello, this is a health check." },
      ];

      await this.generateCompletion(testMessage, provider, { maxTokens: 10 });

      const latency = Date.now() - startTime;
      const metrics = this.getMetrics(provider) as AIServiceMetrics;

      return {
        status: "healthy",
        latency,
        errorRate: metrics.requestCount > 0 ? metrics.errorCount / metrics.requestCount : 0,
        lastCheck: new Date(),
        details: {
          provider,
          totalRequests: metrics.requestCount,
          totalTokens: metrics.totalTokensUsed,
          averageLatency: metrics.averageLatency,
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        latency: Date.now() - startTime,
        errorRate: 1,
        lastCheck: new Date(),
        details: {
          provider,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  /**
   * Reset metrics
   */
  resetMetrics(provider?: AIServiceProvider) {
    if (provider) {
      this.metrics.delete(provider);
    } else {
      this.metrics.clear();
    }
  }
}
