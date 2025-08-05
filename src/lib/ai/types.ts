/**
 * Common types for AI services
 */

export interface AIServiceConfig {
  apiKey: string
  baseUrl?: string
  model?: string
  maxTokens?: number
  temperature?: number
  timeout?: number
}

export interface StreamingOptions {
  onToken?: (token: string) => void
  onComplete?: (fullResponse: string) => void
  onError?: (error: Error) => void
}

export interface AIResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  model?: string
  finishReason?: string
  metadata?: Record<string, any>
}

export interface EmbeddingResponse {
  embedding: number[]
  usage?: {
    promptTokens: number
    totalTokens: number
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  metadata?: Record<string, any>
}

export interface ChatContext {
  accountId?: string
  accountName?: string
  userId: string
  sessionId?: string
  previousMessages?: ChatMessage[]
}

export interface InsightGenerationRequest {
  accountData: {
    id: string
    name: string
    domain?: string
    industry?: string
    size?: string
    technologies?: Array<{
      name: string
      category: string
      confidence: number
    }>
    contacts?: Array<{
      name: string
      title?: string
      department?: string
    }>
  }
  context?: {
    focusAreas?: string[]
    analysisType?: 'technical' | 'business' | 'competitive' | 'all'
  }
}

export interface GeneratedInsight {
  type: string
  title: string
  description: string
  confidence: number
  category: 'technical' | 'business' | 'competitive'
  tags: string[]
  suggestedActions?: string[]
  metadata?: Record<string, any>
}

export interface NormalizationRequest {
  data: Record<string, any>
  schema?: Record<string, any>
  rules?: Array<{
    field: string
    rule: string
    options?: Record<string, any>
  }>
}

export interface NormalizedData {
  normalized: Record<string, any>
  confidence: number
  issues?: Array<{
    field: string
    issue: string
    severity: 'low' | 'medium' | 'high'
    suggestion?: string
  }>
  metadata?: Record<string, any>
}

export interface AIServiceMetrics {
  requestCount: number
  successCount: number
  errorCount: number
  totalTokensUsed: number
  averageLatency: number
  costEstimate: number
  lastRequestAt?: Date
}

export interface RateLimitConfig {
  requestsPerMinute: number
  requestsPerHour: number
  requestsPerDay: number
  tokensPerMinute?: number
  tokensPerHour?: number
  tokensPerDay?: number
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  latency: number
  errorRate: number
  lastCheck: Date
  details?: Record<string, any>
}

export type AIServiceProvider = 'openai' | 'anthropic' | 'azure' | 'flowise'

export interface AIServiceRegistry {
  chat: AIServiceProvider
  embeddings: AIServiceProvider
  normalization: AIServiceProvider
  insights: AIServiceProvider
}