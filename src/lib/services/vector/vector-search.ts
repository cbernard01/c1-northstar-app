/**
 * Vector Search Service
 * Provides semantic search and similarity operations
 */

import { QdrantVectorClient, getQdrantClient } from './qdrant-client'
import { 
  VECTOR_CONFIG, 
  VectorSearchFilter, 
  VectorSearchResult, 
  VectorSearchOptions,
  VectorMetadata,
} from '../../config/vector-config'
import { logger } from '../../logger'
import NodeCache from 'node-cache'

export class VectorSearchService {
  private client: QdrantVectorClient
  private collectionName: string
  private cache?: NodeCache

  constructor(client?: QdrantVectorClient) {
    this.client = client || getQdrantClient()
    this.collectionName = VECTOR_CONFIG.collections.name
    
    // Initialize cache if enabled
    if (VECTOR_CONFIG.cache.enabled) {
      this.cache = new NodeCache({
        stdTTL: VECTOR_CONFIG.cache.ttl,
        maxKeys: VECTOR_CONFIG.cache.maxSize,
        useClones: false,
      })
    }
  }

  /**
   * Perform semantic search with vector
   */
  async search(
    queryVector: number[],
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    const {
      limit = VECTOR_CONFIG.search.defaultLimit,
      offset = 0,
      scoreThreshold = VECTOR_CONFIG.search.scoreThreshold,
      filter,
      withVector = false,
      withPayload = true,
      exact = VECTOR_CONFIG.search.exactSearch,
    } = options

    // Validate inputs
    if (limit > VECTOR_CONFIG.search.maxLimit) {
      throw new Error(`Search limit cannot exceed ${VECTOR_CONFIG.search.maxLimit}`)
    }

    if (queryVector.length !== VECTOR_CONFIG.collections.vectorSize) {
      throw new Error(
        `Query vector dimension mismatch. Expected ${VECTOR_CONFIG.collections.vectorSize}, got ${queryVector.length}`
      )
    }

    // Check cache
    const cacheKey = this.generateCacheKey(queryVector, options)
    if (this.cache && !options.filter) {
      const cached = this.cache.get<VectorSearchResult[]>(cacheKey)
      if (cached) {
        logger.debug('Vector search cache hit', { limit, scoreThreshold })
        return cached
      }
    }

    try {
      await this.client.ensureConnection()

      const searchParams: any = {
        vector: queryVector,
        limit,
        offset,
        score_threshold: scoreThreshold,
        with_payload: withPayload,
        with_vector: withVector,
        exact,
      }

      // Apply filters if provided
      if (filter) {
        searchParams.filter = this.buildQdrantFilter(filter)
      }

      const result = await this.client.withRetry(async () => {
        const qdrantClient = this.client.getClient()
        return await qdrantClient.search(this.collectionName, searchParams)
      }, 'Vector search')

      const searchResults: VectorSearchResult[] = result.map(point => ({
        id: point.id,
        score: point.score || 0,
        payload: point.payload as VectorMetadata,
        vector: withVector && Array.isArray(point.vector) ? point.vector : undefined,
      }))

      // Cache results if no filter applied
      if (this.cache && !filter) {
        this.cache.set(cacheKey, searchResults)
      }

      logger.debug('Vector search completed', {
        queryDimensions: queryVector.length,
        results: searchResults.length,
        scoreThreshold,
        hasFilter: !!filter,
      })

      return searchResults
    } catch (error) {
      logger.error('Vector search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        queryDimensions: queryVector.length,
        limit,
        scoreThreshold,
      })
      throw error
    }
  }

  /**
   * Search for similar vectors to existing points
   */
  async searchSimilar(
    pointId: string | number,
    options: Omit<VectorSearchOptions, 'limit'> & { limit?: number } = {}
  ): Promise<VectorSearchResult[]> {
    try {
      await this.client.ensureConnection()

      const searchParams: any = {
        positive: [pointId],
        limit: options.limit || VECTOR_CONFIG.search.defaultLimit,
        offset: options.offset || 0,
        score_threshold: options.scoreThreshold || VECTOR_CONFIG.search.scoreThreshold,
        with_payload: options.withPayload !== false,
        with_vector: options.withVector || false,
      }

      // Apply filters if provided
      if (options.filter) {
        searchParams.filter = this.buildQdrantFilter(options.filter)
      }

      const result = await this.client.withRetry(async () => {
        const qdrantClient = this.client.getClient()
        return await qdrantClient.recommend(this.collectionName, searchParams)
      }, `Search similar to ${pointId}`)

      const searchResults: VectorSearchResult[] = result.map(point => ({
        id: point.id,
        score: point.score || 0,
        payload: point.payload as VectorMetadata,
        vector: options.withVector && Array.isArray(point.vector) ? point.vector : undefined,
      }))

      logger.debug('Similar search completed', {
        sourcePointId: pointId,
        results: searchResults.length,
        hasFilter: !!options.filter,
      })

      return searchResults
    } catch (error) {
      logger.error('Similar search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        pointId,
      })
      throw error
    }
  }

  /**
   * Multi-vector search (find points similar to multiple vectors)
   */
  async searchMultiple(
    positiveVectors: number[][],
    negativeVectors: number[][] = [],
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    const {
      limit = VECTOR_CONFIG.search.defaultLimit,
      offset = 0,
      scoreThreshold = VECTOR_CONFIG.search.scoreThreshold,
      filter,
      withVector = false,
      withPayload = true,
    } = options

    try {
      await this.client.ensureConnection()

      const searchParams: any = {
        positive: positiveVectors,
        negative: negativeVectors,
        limit,
        offset,
        score_threshold: scoreThreshold,
        with_payload: withPayload,
        with_vector: withVector,
      }

      // Apply filters if provided
      if (filter) {
        searchParams.filter = this.buildQdrantFilter(filter)
      }

      const result = await this.client.withRetry(async () => {
        const qdrantClient = this.client.getClient()
        return await qdrantClient.recommend(this.collectionName, searchParams)
      }, 'Multi-vector search')

      const searchResults: VectorSearchResult[] = result.map(point => ({
        id: point.id,
        score: point.score || 0,
        payload: point.payload as VectorMetadata,
        vector: withVector && Array.isArray(point.vector) ? point.vector : undefined,
      }))

      logger.debug('Multi-vector search completed', {
        positiveVectors: positiveVectors.length,
        negativeVectors: negativeVectors.length,
        results: searchResults.length,
      })

      return searchResults
    } catch (error) {
      logger.error('Multi-vector search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        positiveCount: positiveVectors.length,
        negativeCount: negativeVectors.length,
      })
      throw error
    }
  }

  /**
   * Search by account number
   */
  async searchByAccount(
    queryVector: number[],
    accountNumber: string,
    options: Omit<VectorSearchOptions, 'filter'> = {}
  ): Promise<VectorSearchResult[]> {
    return this.search(queryVector, {
      ...options,
      filter: {
        accountNumber,
        ...options,
      },
    })
  }

  /**
   * Search by scope (account, contact, technology, etc.)
   */
  async searchByScope(
    queryVector: number[],
    scope: VectorMetadata['scope'],
    options: Omit<VectorSearchOptions, 'filter'> = {}
  ): Promise<VectorSearchResult[]> {
    return this.search(queryVector, {
      ...options,
      filter: {
        scope,
      },
    })
  }

  /**
   * Search within date range
   */
  async searchByDateRange(
    queryVector: number[],
    startDate: string,
    endDate: string,
    options: Omit<VectorSearchOptions, 'filter'> = {}
  ): Promise<VectorSearchResult[]> {
    return this.search(queryVector, {
      ...options,
      filter: {
        dateRange: {
          start: startDate,
          end: endDate,
        },
      },
    })
  }

  /**
   * Get chunks for context (retrieve related document chunks)
   */
  async getContextChunks(
    queryVector: number[],
    accountNumber: string,
    options: {
      maxChunks?: number
      scoreThreshold?: number
      documentTypes?: string[]
    } = {}
  ): Promise<VectorSearchResult[]> {
    const {
      maxChunks = 5,
      scoreThreshold = 0.75,
      documentTypes,
    } = options

    const filter: VectorSearchFilter = {
      accountNumber,
      scope: 'document',
    }

    if (documentTypes && documentTypes.length > 0) {
      filter.documentType = documentTypes
    }

    return this.search(queryVector, {
      limit: maxChunks,
      scoreThreshold,
      filter,
      withPayload: true,
    })
  }

  /**
   * Batch search multiple queries
   */
  async batchSearch(
    queries: Array<{
      vector: number[]
      options?: VectorSearchOptions
    }>
  ): Promise<VectorSearchResult[][]> {
    const results: VectorSearchResult[][] = []

    // Process queries in parallel (with some concurrency limit)
    const concurrencyLimit = 5
    for (let i = 0; i < queries.length; i += concurrencyLimit) {
      const batch = queries.slice(i, i + concurrencyLimit)
      
      const batchResults = await Promise.all(
        batch.map(query => this.search(query.vector, query.options))
      )
      
      results.push(...batchResults)
    }

    return results
  }

  /**
   * Build Qdrant filter from search filter
   */
  private buildQdrantFilter(filter: VectorSearchFilter): any {
    const conditions: any[] = []

    // Account number filter
    if (filter.accountNumber) {
      if (Array.isArray(filter.accountNumber)) {
        conditions.push({
          key: 'accountNumber',
          match: { any: filter.accountNumber },
        })
      } else {
        conditions.push({
          key: 'accountNumber',
          match: { value: filter.accountNumber },
        })
      }
    }

    // Scope filter
    if (filter.scope) {
      if (Array.isArray(filter.scope)) {
        conditions.push({
          key: 'scope',
          match: { any: filter.scope },
        })
      } else {
        conditions.push({
          key: 'scope',
          match: { value: filter.scope },
        })
      }
    }

    // Source type filter
    if (filter.sourceType) {
      if (Array.isArray(filter.sourceType)) {
        conditions.push({
          key: 'sourceType',
          match: { any: filter.sourceType },
        })
      } else {
        conditions.push({
          key: 'sourceType',
          match: { value: filter.sourceType },
        })
      }
    }

    // Document type filter
    if (filter.documentType) {
      if (Array.isArray(filter.documentType)) {
        conditions.push({
          key: 'documentType',
          match: { any: filter.documentType },
        })
      } else {
        conditions.push({
          key: 'documentType',
          match: { value: filter.documentType },
        })
      }
    }

    // Industry filter
    if (filter.industry) {
      if (Array.isArray(filter.industry)) {
        conditions.push({
          key: 'industry',
          match: { any: filter.industry },
        })
      } else {
        conditions.push({
          key: 'industry',
          match: { value: filter.industry },
        })
      }
    }

    // Tags filter
    if (filter.tags) {
      if (Array.isArray(filter.tags)) {
        conditions.push({
          key: 'tags',
          match: { any: filter.tags },
        })
      } else {
        conditions.push({
          key: 'tags',
          match: { value: filter.tags },
        })
      }
    }

    // Date range filter
    if (filter.dateRange) {
      conditions.push({
        key: 'createdAt',
        range: {
          gte: filter.dateRange.start,
          lte: filter.dateRange.end,
        },
      })
    }

    // Confidence range filter
    if (filter.confidenceRange) {
      conditions.push({
        key: 'confidenceScore',
        range: {
          gte: filter.confidenceRange.min,
          lte: filter.confidenceRange.max,
        },
      })
    }

    // Return filter structure
    if (conditions.length === 0) {
      return undefined
    } else if (conditions.length === 1) {
      return conditions[0]
    } else {
      return {
        must: conditions,
      }
    }
  }

  /**
   * Generate cache key for search
   */
  private generateCacheKey(
    vector: number[],
    options: VectorSearchOptions
  ): string {
    const vectorHash = this.hashVector(vector)
    const optionsHash = JSON.stringify({
      limit: options.limit,
      scoreThreshold: options.scoreThreshold,
      withVector: options.withVector,
      withPayload: options.withPayload,
    })
    
    return `search:${vectorHash}:${Buffer.from(optionsHash).toString('base64').slice(0, 16)}`
  }

  /**
   * Create hash from vector for caching
   */
  private hashVector(vector: number[]): string {
    // Sample a few values to create a lightweight hash
    const sample = [
      vector[0] || 0,
      vector[Math.floor(vector.length / 4)] || 0,
      vector[Math.floor(vector.length / 2)] || 0,
      vector[Math.floor((vector.length * 3) / 4)] || 0,
      vector[vector.length - 1] || 0,
    ]
    
    return Buffer.from(sample.map(v => v.toFixed(4)).join(',')).toString('base64').slice(0, 12)
  }

  /**
   * Clear search cache
   */
  clearCache(pattern?: string): void {
    if (!this.cache) return

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
  } | null {
    if (!this.cache) return null

    const stats = this.cache.getStats()
    return {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hits / (stats.hits + stats.misses) || 0,
    }
  }

  /**
   * Health check for search service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy'
    details: any
  }> {
    try {
      const startTime = Date.now()
      
      // Create a test vector (all zeros)
      const testVector = new Array(VECTOR_CONFIG.collections.vectorSize).fill(0)
      
      // Perform a simple search
      await this.search(testVector, { limit: 1 })
      
      const latency = Date.now() - startTime
      const cacheStats = this.getCacheStats()
      
      return {
        status: 'healthy',
        details: {
          latency,
          cache: cacheStats,
          collectionName: this.collectionName,
          timestamp: new Date().toISOString(),
        },
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          collectionName: this.collectionName,
          timestamp: new Date().toISOString(),
        },
      }
    }
  }
}

// Singleton instance
let vectorSearch: VectorSearchService | null = null

/**
 * Get singleton vector search instance
 */
export function getVectorSearch(): VectorSearchService {
  if (!vectorSearch) {
    vectorSearch = new VectorSearchService()
  }
  return vectorSearch
}