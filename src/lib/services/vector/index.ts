/**
 * Vector Services - Main Export
 * Centralized exports for all vector database services
 */

// Core services
export { QdrantVectorClient, getQdrantClient, initializeQdrant } from './qdrant-client'
export { VectorStoreService, getVectorStore } from './vector-store'
export { VectorSearchService, getVectorSearch } from './vector-search'

// Enhanced AI services
export { 
  EmbeddingService,
} from '../../ai/embedding-service'

// Configuration and types
export * from '../../config/vector-config'

// Convenience class that combines all vector operations
export class VectorService {
  public readonly client: QdrantVectorClient
  public readonly store: VectorStoreService
  public readonly search: VectorSearchService
  public readonly embeddings: EmbeddingService

  constructor() {
    this.client = getQdrantClient()
    this.store = getVectorStore()
    this.search = getVectorSearch()
    this.embeddings = new EmbeddingService()
  }

  /**
   * Initialize all vector services
   */
  async initialize(): Promise<void> {
    await this.client.connect()
    await this.store.ensureCollection()
  }

  /**
   * Health check for all services
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    services: {
      client: any
      search: any
      embeddings: any
    }
  }> {
    const [clientHealth, searchHealth, embeddingsHealth] = await Promise.all([
      this.client.healthCheck(),
      this.search.healthCheck(),
      this.embeddings.healthCheck(),
    ])

    const allHealthy = [clientHealth.status, searchHealth.status, embeddingsHealth.status]
      .every(status => status === 'healthy')

    const someHealthy = [clientHealth.status, searchHealth.status, embeddingsHealth.status]
      .some(status => status === 'healthy')

    return {
      status: allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy',
      services: {
        client: clientHealth,
        search: searchHealth,
        embeddings: embeddingsHealth,
      },
    }
  }

  /**
   * Process and store document with embeddings
   */
  async processDocument(
    content: string,
    metadata: Partial<VectorMetadata>,
    options: {
      chunkSize?: number
      chunkOverlap?: number
      provider?: 'openai' | 'anthropic' | 'local'
    } = {}
  ): Promise<{
    chunks: number
    successful: number
    failed: number
    errors: string[]
  }> {
    try {
      // Generate embeddings for document chunks
      const embeddedChunks = await this.embeddings.embedDocument(content, {
        ...options,
        metadata,
      })

      if (embeddedChunks.length === 0) {
        throw new Error('No chunks were successfully embedded')
      }

      // Create vector points
      const points = embeddedChunks.map(chunk => 
        this.store.createVectorPoint(chunk.chunk, chunk.embedding, {
          ...metadata,
          ...chunk.metadata,
          chunkIndex: chunk.chunkIndex,
        })
      )

      // Store in vector database
      const results = await this.store.batchUpsert(points)

      const successful = results.filter(r => r.status === 'completed').length
      const failed = results.length - successful

      return {
        chunks: embeddedChunks.length,
        successful,
        failed,
        errors: failed > 0 ? ['Some chunks failed to store'] : [],
      }
    } catch (error) {
      throw new Error(`Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Semantic search with embedding generation
   */
  async semanticSearch(
    query: string,
    options: {
      accountNumber?: string
      scope?: VectorMetadata['scope']
      limit?: number
      scoreThreshold?: number
      provider?: 'openai' | 'anthropic' | 'local'
    } = {}
  ): Promise<VectorSearchResult[]> {
    // Generate query embedding
    const queryEmbedding = await this.embeddings.generateEmbedding(query, {
      provider: options.provider,
    })

    // Build search filter
    const filter: VectorSearchFilter = {}
    if (options.accountNumber) filter.accountNumber = options.accountNumber
    if (options.scope) filter.scope = options.scope

    // Perform search
    return await this.search.search(queryEmbedding.embedding, {
      limit: options.limit,
      scoreThreshold: options.scoreThreshold,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      withPayload: true,
    })
  }

  /**
   * Get context chunks for a query within an account
   */
  async getContextForAccount(
    query: string,
    accountNumber: string,
    options: {
      maxChunks?: number
      scoreThreshold?: number
      documentTypes?: string[]
      provider?: 'openai' | 'anthropic' | 'local'
    } = {}
  ): Promise<VectorSearchResult[]> {
    // Generate query embedding
    const queryEmbedding = await this.embeddings.generateEmbedding(query, {
      provider: options.provider,
    })

    // Get context chunks
    return await this.search.getContextChunks(
      queryEmbedding.embedding,
      accountNumber,
      options
    )
  }

  /**
   * Find similar content across accounts
   */
  async findSimilarContent(
    content: string,
    options: {
      excludeAccount?: string
      limit?: number
      scoreThreshold?: number
      provider?: 'openai' | 'anthropic' | 'local'
    } = {}
  ): Promise<VectorSearchResult[]> {
    // Generate content embedding
    const embedding = await this.embeddings.generateEmbedding(content, {
      provider: options.provider,
    })

    // Build filter to exclude specific account
    const filter: VectorSearchFilter = {}
    if (options.excludeAccount) {
      // Note: This would need to be implemented as "not equals" in the search filter
      // For now, we'll filter results post-search
    }

    const results = await this.search.search(embedding.embedding, {
      limit: options.limit,
      scoreThreshold: options.scoreThreshold,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      withPayload: true,
    })

    // Filter out excluded account if specified
    if (options.excludeAccount) {
      return results.filter(result => 
        result.payload.accountNumber !== options.excludeAccount
      )
    }

    return results
  }

  /**
   * Get service statistics
   */
  async getStats(): Promise<{
    collections: any
    cache: {
      search: any
      embeddings: any
    }
    client: any
  }> {
    const [collectionStats, clientMetrics] = await Promise.all([
      this.store.getCollectionStats(),
      this.client.getMetrics(),
    ])

    return {
      collections: collectionStats,
      cache: {
        search: this.search.getCacheStats(),
        embeddings: this.embeddings.getCacheStats(),
      },
      client: clientMetrics,
    }
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.search.clearCache()
    this.embeddings.clearCache()
  }
}

// Singleton instance
let vectorService: VectorService | null = null

/**
 * Get singleton vector service instance
 */
export function getVectorService(): VectorService {
  if (!vectorService) {
    vectorService = new VectorService()
  }
  return vectorService
}

/**
 * Initialize vector services
 */
export async function initializeVectorServices(): Promise<VectorService> {
  const service = getVectorService()
  await service.initialize()
  return service
}