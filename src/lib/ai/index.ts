/**
 * AI Services - Main exports
 */

// Main service
export { default as aiService, AIService } from "./ai-service";

// Individual services
export { EmbeddingService } from "./embedding-service";
export { FlowiseClient } from "./flowise-client";
export { InsightGenerator } from "./insight-generator";
export { LLMService } from "./llm-service";
export { NormalizationService } from "./normalization-service";

// Configuration
export * from "./config";
export * from "./types";

// Utility exports for common use cases
export const {
  sendChatMessage,
  streamChatMessage,
  generateEmbedding,
  generateBatchEmbeddings,
  generateInsights,
  normalizeCompanyData,
  getHealthStatus,
  getServiceMetrics,
} = require("./ai-service").aiService;
