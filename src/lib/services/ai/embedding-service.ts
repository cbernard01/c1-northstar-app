/**
 * Enhanced Embedding Service
 * Separate from Flowise with support for multiple providers
 */

import NodeCache from 'node-cache'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { encode } from 'gpt-tokenizer'

import { AI_CONFIG, MODEL_CONFIG, CACHE_CONFIG } from '../../ai/config'
import { EmbeddingResponse, AIServiceProvider } from '../../ai/types'
import { VECTOR_CONFIG, EmbeddingOptions, ChunkOptions } from '../../config/vector-config'
import { logger } from '../../logger'

export interface EnhancedEmbeddingResponse extends EmbeddingResponse {
  provider: AIServiceProvider
  model: string
  dimensions: number
  tokensUsed: number
}

export interface BatchEmbeddingResult {
  embeddings: EnhancedEmbeddingResponse[]
  totalTokens: number
  successful: number
  failed: number
  errors: Array<{ index: number; error: string }>
}

export class EnhancedEmbeddingService {
  private openai?: OpenAI
  private azureClient?: OpenAI
  private anthropic?: Anthropic
  private cache: NodeCache
  private localEmbeddingUrl?: string

  constructor() {
    this.initializeClients()
    this.cache = new NodeCache({
      stdTTL: CACHE_CONFIG.embeddings.ttl,
      maxKeys: CACHE_CONFIG.embeddings.maxSize,
      useClones: false,
    })
  }

  /**
   * Initialize embedding clients
   */
  private initializeClients() {
    // OpenAI client
    if (AI_CONFIG.openai.apiKey) {
      this.openai = new OpenAI({
        apiKey: AI_CONFIG.openai.apiKey,
        baseURL: AI_CONFIG.openai.baseUrl,
        timeout: AI_CONFIG.openai.timeout,
      })
    }

    // Azure OpenAI client
    if (AI_CONFIG.azure.apiKey) {
      this.azureClient = new OpenAI({
        apiKey: AI_CONFIG.azure.apiKey,
        baseURL: `${AI_CONFIG.azure.baseUrl}/openai/deployments/${MODEL_CONFIG.embeddings.azure}`,
        defaultQuery: { 'api-version': '2024-02-15-preview' },
        defaultHeaders: {
          'api-key': AI_CONFIG.azure.apiKey,
        },
      })
    }

    // Anthropic client (for future embedding support)
    if (AI_CONFIG.anthropic.apiKey) {
      this.anthropic = new Anthropic({
        apiKey: AI_CONFIG.anthropic.apiKey,
        baseURL: AI_CONFIG.anthropic.baseUrl,
        timeout: AI_CONFIG.anthropic.timeout,
      })
    }

    // Local embedding service URL
    this.localEmbeddingUrl = process.env.LOCAL_EMBEDDING_URL
  }

  /**
   * Generate embeddings with automatic provider selection
   */
  async generateEmbedding(
    text: string,
    options: EmbeddingOptions = {}
  ): Promise<EnhancedEmbeddingResponse> {
    const provider = options.provider || VECTOR_CONFIG.embeddings.defaultProvider
    const useCache = options.useCache !== false
    const model = options.model || MODEL_CONFIG.embeddings[provider as keyof typeof MODEL_CONFIG.embeddings]
    
    const cacheKey = this.getCacheKey(text, provider, model)

    // Check cache first
    if (useCache) {
      const cached = this.cache.get<EnhancedEmbeddingResponse>(cacheKey)
      if (cached) {
        logger.debug('Embedding cache hit', { 
          provider, 
          model,
          textLength: text.length 
        })
        return cached
      }
    }

    // Validate text length and token count
    const tokenCount = this.countTokens(text)
    if (tokenCount > VECTOR_CONFIG.embeddings.maxTokens) {
      throw new Error(
        `Text too long: ${tokenCount} tokens exceeds limit of ${VECTOR_CONFIG.embeddings.maxTokens}`
      )
    }

    try {
      let response: EnhancedEmbeddingResponse

      switch (provider) {
        case 'openai':
          response = await this.generateOpenAIEmbedding(text, options)
          break
        case 'azure':
          response = await this.generateAzureEmbedding(text, options)
          break
        case 'anthropic':
          response = await this.generateAnthropicEmbedding(text, options)
          break
        case 'local':
          response = await this.generateLocalEmbedding(text, options)
          break
        default:
          throw new Error(`Unsupported embedding provider: ${provider}`)
      }

      // Validate response dimensions
      const expectedDim = options.dimensions || VECTOR_CONFIG.collections.vectorSize
      if (response.embedding.length !== expectedDim) {
        logger.warn('Embedding dimension mismatch', {
          expected: expectedDim,
          actual: response.embedding.length,
          provider,
          model: response.model,
        })
      }

      // Cache the result
      if (useCache) {
        this.cache.set(cacheKey, response)
      }

      logger.info('Embedding generated', {
        provider: response.provider,
        model: response.model,
        textLength: text.length,
        dimensions: response.dimensions,
        tokensUsed: response.tokensUsed,
        cached: false,
      })

      return response

    } catch (error) {
      logger.error('Embedding generation error', {
        provider,
        model,
        error: error instanceof Error ? error.message : 'Unknown error',
        textLength: text.length,
        tokenCount,
      })
      throw error
    }
  }

  /**
   * Generate embeddings for multiple texts with batching
   */
  async generateBatchEmbeddings(
    texts: string[],
    options: EmbeddingOptions = {}
  ): Promise<BatchEmbeddingResult> {
    if (texts.length === 0) {
      return {
        embeddings: [],
        totalTokens: 0,
        successful: 0,
        failed: 0,
        errors: [],
      }
    }

    const batchSize = options.batchSize || VECTOR_CONFIG.embeddings.batchSize
    const provider = options.provider || VECTOR_CONFIG.embeddings.defaultProvider
    
    const embeddings: EnhancedEmbeddingResponse[] = []
    const errors: Array<{ index: number; error: string }> = []
    let totalTokens = 0
    let successful = 0
    let failed = 0

    // Process in batches to avoid rate limits and memory issues
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      
      logger.info('Processing embedding batch', {
        batch: Math.floor(i / batchSize) + 1,
        totalBatches: Math.ceil(texts.length / batchSize),
        batchSize: batch.length,
        provider,
      })

      // Process batch items in parallel with some concurrency control
      const concurrencyLimit = Math.min(10, batchSize)
      const batchResults: (EnhancedEmbeddingResponse | null)[] = []

      for (let j = 0; j < batch.length; j += concurrencyLimit) {
        const concurrentBatch = batch.slice(j, j + concurrencyLimit)
        
        const promises = concurrentBatch.map(async (text, idx) => {
          try {
            const globalIndex = i + j + idx
            return await this.generateEmbedding(text, options)
          } catch (error) {
            const globalIndex = i + j + idx
            errors.push({
              index: globalIndex,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
            failed++
            return null
          }
        })

        const concurrentResults = await Promise.all(promises)
        batchResults.push(...concurrentResults)
      }

      // Collect successful results
      for (const result of batchResults) {
        if (result) {
          embeddings.push(result)
          totalTokens += result.tokensUsed
          successful++
        }
      }

      // Add delay between batches to respect rate limits
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    logger.info('Batch embedding completed', {
      total: texts.length,
      successful,
      failed,
      totalTokens,
      provider,
    })

    return {
      embeddings,
      totalTokens,
      successful,
      failed,
      errors,
    }
  }

  /**
   * Generate OpenAI embeddings
   */
  private async generateOpenAIEmbedding(
    text: string,
    options: EmbeddingOptions = {}
  ): Promise<EnhancedEmbeddingResponse> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized')
    }

    const model = options.model || MODEL_CONFIG.embeddings.openai
    
    const requestParams: any = {
      model,
      input: text,
      encoding_format: 'float',
    }

    // Add dimensions if specified and supported by model
    if (options.dimensions && model.includes('text-embedding-3')) {
      requestParams.dimensions = options.dimensions
    }

    const response = await this.openai.embeddings.create(requestParams)

    const embedding = response.data[0]
    if (!embedding?.embedding) {
      throw new Error('No embedding data in OpenAI response')
    }

    return {
      embedding: embedding.embedding,
      provider: 'openai',
      model,
      dimensions: embedding.embedding.length,
      tokensUsed: response.usage?.total_tokens || this.countTokens(text),
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    }
  }

  /**
   * Generate Azure OpenAI embeddings
   */
  private async generateAzureEmbedding(
    text: string,
    options: EmbeddingOptions = {}
  ): Promise<EnhancedEmbeddingResponse> {
    if (!this.azureClient) {
      throw new Error('Azure OpenAI client not initialized')
    }

    const model = options.model || MODEL_CONFIG.embeddings.azure

    const response = await this.azureClient.embeddings.create({
      model,
      input: text,
      encoding_format: 'float',
    })

    const embedding = response.data[0]
    if (!embedding?.embedding) {
      throw new Error('No embedding data in Azure OpenAI response')
    }

    return {
      embedding: embedding.embedding,
      provider: 'azure',
      model,
      dimensions: embedding.embedding.length,
      tokensUsed: response.usage?.total_tokens || this.countTokens(text),
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    }
  }

  /**
   * Generate Anthropic embeddings (placeholder for future support)
   */
  private async generateAnthropicEmbedding(
    text: string,
    options: EmbeddingOptions = {}
  ): Promise<EnhancedEmbeddingResponse> {
    throw new Error('Anthropic embeddings not yet supported')
  }

  /**
   * Generate local embeddings using a local service
   */
  private async generateLocalEmbedding(
    text: string,
    options: EmbeddingOptions = {}
  ): Promise<EnhancedEmbeddingResponse> {
    if (!this.localEmbeddingUrl) {
      throw new Error('Local embedding service URL not configured')
    }

    const model = options.model || 'nomic-embed-text'

    try {
      const response = await fetch(`${this.localEmbeddingUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: text,
        }),
      })

      if (!response.ok) {
        throw new Error(`Local embedding service error: ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.data?.[0]?.embedding) {
        throw new Error('No embedding data in local service response')
      }

      return {
        embedding: data.data[0].embedding,
        provider: 'local',
        model,
        dimensions: data.data[0].embedding.length,
        tokensUsed: data.usage?.total_tokens || this.countTokens(text),
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
      }
    } catch (error) {
      logger.error('Local embedding service error', {
        url: this.localEmbeddingUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Embed document with chunking
   */
  async embedDocument(
    text: string,
    options: ChunkOptions & EmbeddingOptions = {}
  ): Promise<Array<{
    chunk: string
    embedding: number[]
    chunkIndex: number
    metadata: any
  }>> {
    const chunkSize = options.chunkSize || VECTOR_CONFIG.embeddings.chunkSize
    const chunkOverlap = options.chunkOverlap || VECTOR_CONFIG.embeddings.chunkOverlap

    // Split text into chunks
    const chunks = this.chunkText(text, chunkSize, chunkOverlap, options.preserveSentences)
    
    logger.info('Document chunking completed', {
      originalLength: text.length,
      chunks: chunks.length,
      chunkSize,
      chunkOverlap,
    })

    // Generate embeddings for each chunk
    const batchResult = await this.generateBatchEmbeddings(chunks, options)

    if (batchResult.failed > 0) {
      logger.warn('Some chunks failed to embed', {
        successful: batchResult.successful,
        failed: batchResult.failed,
        errors: batchResult.errors,
      })
    }

    return chunks.map((chunk, index) => {
      const embedding = batchResult.embeddings.find((_, embIndex) => 
        embIndex === index && batchResult.errors.every(err => err.index !== index)
      )

      return {
        chunk,
        embedding: embedding?.embedding || [],
        chunkIndex: index,
        metadata: {
          ...options.metadata,
          chunkSize: chunk.length,
          originalLength: text.length,
          totalChunks: chunks.length,
          tokensUsed: embedding?.tokensUsed || 0,
          provider: embedding?.provider,
          model: embedding?.model,
        },
      }
    }).filter(item => item.embedding.length > 0) // Filter out failed chunks
  }

  /**
   * Smart text chunking with sentence preservation
   */
  private chunkText(
    text: string, 
    chunkSize: number, 
    overlap: number,
    preserveSentences: boolean = true
  ): string[] {
    const chunks: string[] = []
    let start = 0

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length)
      let chunk = text.slice(start, end)

      // Try to break at sentence boundaries if preserving sentences
      if (end < text.length && preserveSentences) {
        const sentences = ['.', '!', '?', '\n\n']
        let bestBreak = -1

        for (const delimiter of sentences) {
          const lastOccurrence = chunk.lastIndexOf(delimiter)
          if (lastOccurrence > start + chunkSize * 0.5) {
            bestBreak = Math.max(bestBreak, lastOccurrence)
          }
        }

        if (bestBreak > -1) {
          chunk = text.slice(start, bestBreak + 1)
          start = bestBreak + 1 - overlap
        } else {
          // Fallback to word boundaries
          const lastSpace = chunk.lastIndexOf(' ')
          if (lastSpace > start + chunkSize * 0.7) {
            chunk = text.slice(start, lastSpace)
            start = lastSpace + 1 - overlap
          } else {
            start = end - overlap
          }
        }
      } else {
        start = end - overlap
      }

      const trimmedChunk = chunk.trim()
      if (trimmedChunk.length > 0) {
        chunks.push(trimmedChunk)
      }

      // Prevent infinite loops
      if (start <= 0) start = end
    }

    return chunks
  }

  /**
   * Count tokens in text
   */
  countTokens(text: string, model: string = 'gpt-3.5-turbo'): number {
    try {
      return encode(text).length
    } catch (error) {
      // Fallback estimation: roughly 4 characters per token
      return Math.ceil(text.length / 4)
    }
  }

  /**
   * Calculate cosine similarity between embeddings
   */
  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions')
    }

    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i]
      norm1 += embedding1[i] * embedding1[i]
      norm2 += embedding2[i] * embedding2[i]
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2)
    return magnitude === 0 ? 0 : dotProduct / magnitude
  }

  /**
   * Generate cache key
   */
  private getCacheKey(text: string, provider: string, model?: string): string {
    const content = `${provider}:${model || 'default'}:${text}`
    return Buffer.from(content).toString('base64').slice(0, 64)
  }

  /**
   * Clear embedding cache
   */
  clearCache(pattern?: string): void {
    if (pattern) {
      const keys = this.cache.keys()
      const matchingKeys = keys.filter(key => key.includes(pattern))
      this.cache.del(matchingKeys)
    } else {
      this.cache.flushAll()
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    keys: number
    hits: number
    misses: number
    hitRate: number
  } {
    const stats = this.cache.getStats()
    return {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hits / (stats.hits + stats.misses) || 0,
    }
  }

  /**
   * Health check for embedding service
   */
  async healthCheck(provider?: AIServiceProvider): Promise<{
    status: 'healthy' | 'unhealthy'
    details: any
  }> {
    const testProvider = provider || VECTOR_CONFIG.embeddings.defaultProvider

    try {
      const startTime = Date.now()
      
      await this.generateEmbedding(
        'Health check test',
        { 
          provider: testProvider,
          useCache: false 
        }
      )

      const latency = Date.now() - startTime
      const cacheStats = this.getCacheStats()

      return {
        status: 'healthy',
        details: {
          provider: testProvider,
          latency,
          cache: cacheStats,
          timestamp: new Date().toISOString(),
        },
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          provider: testProvider,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      }
    }
  }
}

// Singleton instance
let embeddingService: EnhancedEmbeddingService | null = null

/**
 * Get singleton embedding service instance
 */
export function getEmbeddingService(): EnhancedEmbeddingService {
  if (!embeddingService) {
    embeddingService = new EnhancedEmbeddingService()
  }
  return embeddingService
}