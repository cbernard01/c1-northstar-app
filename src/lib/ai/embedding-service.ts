/**
 * Embedding Service - Generate and manage vector embeddings
 */

import NodeCache from 'node-cache'
import OpenAI from 'openai'

import { AI_CONFIG, MODEL_CONFIG, CACHE_CONFIG } from './config'
import { EmbeddingResponse, AIServiceProvider } from './types'
import { logger } from '../logger'

export class EmbeddingService {
  private openai?: OpenAI
  private cache: NodeCache
  private azureClient?: OpenAI

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
    if (AI_CONFIG.openai.apiKey) {
      this.openai = new OpenAI({
        apiKey: AI_CONFIG.openai.apiKey,
        baseURL: AI_CONFIG.openai.baseUrl,
        timeout: AI_CONFIG.openai.timeout,
      })
    }

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
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbedding(
    text: string,
    provider: AIServiceProvider = 'openai',
    options?: {
      model?: string
      dimensions?: number
      useCache?: boolean
    }
  ): Promise<EmbeddingResponse> {
    const useCache = options?.useCache !== false
    const cacheKey = this.getCacheKey(text, provider, options?.model)

    // Check cache first
    if (useCache) {
      const cached = this.cache.get<EmbeddingResponse>(cacheKey)
      if (cached) {
        logger.debug('Embedding cache hit', { provider, textLength: text.length })
        return cached
      }
    }

    try {
      let response: EmbeddingResponse

      switch (provider) {
        case 'openai':
          response = await this.generateOpenAIEmbedding(text, options)
          break
        case 'azure':
          response = await this.generateAzureEmbedding(text, options)
          break
        default:
          throw new Error(`Unsupported embedding provider: ${provider}`)
      }

      // Cache the result
      if (useCache) {
        this.cache.set(cacheKey, response)
      }

      logger.info('Embedding generated', {
        provider,
        textLength: text.length,
        dimensions: response.embedding.length,
        cached: false,
      })

      return response

    } catch (error) {
      logger.error('Embedding generation error', {
        provider,
        error: error instanceof Error ? error.message : 'Unknown error',
        textLength: text.length,
      })
      throw error
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateBatchEmbeddings(
    texts: string[],
    provider: AIServiceProvider = 'openai',
    options?: {
      model?: string
      dimensions?: number
      useCache?: boolean
      batchSize?: number
    }
  ): Promise<EmbeddingResponse[]> {
    const batchSize = options?.batchSize || 100
    const results: EmbeddingResponse[] = []

    // Process in batches
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(text => this.generateEmbedding(text, provider, options))
      )
      results.push(...batchResults)

      // Log progress for large batches
      if (texts.length > batchSize) {
        const progress = Math.min(i + batchSize, texts.length)
        logger.info('Batch embedding progress', {
          processed: progress,
          total: texts.length,
          percentage: Math.round((progress / texts.length) * 100),
        })
      }
    }

    return results
  }

  /**
   * Generate OpenAI embeddings
   */
  private async generateOpenAIEmbedding(
    text: string,
    options?: {
      model?: string
      dimensions?: number
    }
  ): Promise<EmbeddingResponse> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized')
    }

    const model = options?.model || MODEL_CONFIG.embeddings.openai
    
    const requestParams: any = {
      model,
      input: text,
      encoding_format: 'float',
    }

    // Add dimensions if specified and supported by model
    if (options?.dimensions && model === 'text-embedding-3-large') {
      requestParams.dimensions = options.dimensions
    }

    const response = await this.openai.embeddings.create(requestParams)

    const embedding = response.data[0]
    if (!embedding?.embedding) {
      throw new Error('No embedding data in OpenAI response')
    }

    return {
      embedding: embedding.embedding,
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
    options?: {
      model?: string
      dimensions?: number
    }
  ): Promise<EmbeddingResponse> {
    if (!this.azureClient) {
      throw new Error('Azure OpenAI client not initialized')
    }

    const response = await this.azureClient.embeddings.create({
      model: options?.model || MODEL_CONFIG.embeddings.azure,
      input: text,
      encoding_format: 'float',
    })

    const embedding = response.data[0]
    if (!embedding?.embedding) {
      throw new Error('No embedding data in Azure OpenAI response')
    }

    return {
      embedding: embedding.embedding,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
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
   * Find most similar embeddings from a collection
   */
  findMostSimilar(
    queryEmbedding: number[],
    embeddings: Array<{ id: string; embedding: number[]; metadata?: any }>,
    topK: number = 5
  ): Array<{ id: string; similarity: number; metadata?: any }> {
    const similarities = embeddings.map(item => ({
      id: item.id,
      similarity: this.calculateSimilarity(queryEmbedding, item.embedding),
      metadata: item.metadata,
    }))

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
  }

  /**
   * Embed text for semantic search
   */
  async embedForSearch(
    text: string,
    provider: AIServiceProvider = 'openai',
    options?: {
      prefix?: string
      useCache?: boolean
    }
  ): Promise<EmbeddingResponse> {
    const searchText = options?.prefix ? `${options.prefix}${text}` : text
    
    return this.generateEmbedding(searchText, provider, {
      useCache: options?.useCache,
    })
  }

  /**
   * Embed documents with chunking for large texts
   */
  async embedDocument(
    text: string,
    provider: AIServiceProvider = 'openai',
    options?: {
      chunkSize?: number
      chunkOverlap?: number
      useCache?: boolean
      metadata?: Record<string, any>
    }
  ): Promise<Array<{
    chunk: string
    embedding: number[]
    chunkIndex: number
    metadata?: Record<string, any>
  }>> {
    const chunkSize = options?.chunkSize || 1000
    const chunkOverlap = options?.chunkOverlap || 100

    // Split text into chunks
    const chunks = this.chunkText(text, chunkSize, chunkOverlap)
    
    // Generate embeddings for each chunk
    const embeddings = await this.generateBatchEmbeddings(
      chunks,
      provider,
      { useCache: options?.useCache }
    )

    return chunks.map((chunk, index) => ({
      chunk,
      embedding: embeddings[index].embedding,
      chunkIndex: index,
      metadata: {
        ...options?.metadata,
        chunkSize: chunk.length,
        originalLength: text.length,
        totalChunks: chunks.length,
      },
    }))
  }

  /**
   * Split text into chunks with overlap
   */
  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = []
    let start = 0

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length)
      let chunk = text.slice(start, end)

      // Try to break at sentence boundaries
      if (end < text.length) {
        const lastSentence = chunk.lastIndexOf('.')
        const lastNewline = chunk.lastIndexOf('\n')
        const breakPoint = Math.max(lastSentence, lastNewline)
        
        if (breakPoint > start + chunkSize * 0.5) {
          chunk = text.slice(start, breakPoint + 1)
          start = breakPoint + 1 - overlap
        } else {
          start = end - overlap
        }
      } else {
        start = end
      }

      if (chunk.trim()) {
        chunks.push(chunk.trim())
      }
    }

    return chunks
  }

  /**
   * Generate cache key for embeddings
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
  async healthCheck(provider: AIServiceProvider = 'openai'): Promise<{
    status: 'healthy' | 'unhealthy'
    details: any
  }> {
    try {
      const startTime = Date.now()
      
      await this.generateEmbedding(
        'Health check test',
        provider,
        { useCache: false }
      )

      const latency = Date.now() - startTime
      const cacheStats = this.getCacheStats()

      return {
        status: 'healthy',
        details: {
          provider,
          latency,
          cache: cacheStats,
          timestamp: new Date().toISOString(),
        },
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          provider,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      }
    }
  }
}