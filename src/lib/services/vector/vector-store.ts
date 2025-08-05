/**
 * Vector Store Service
 * Manages vector storage operations with Qdrant
 */

import { QdrantVectorClient, getQdrantClient } from './qdrant-client'
import { 
  VECTOR_CONFIG, 
  VectorPoint, 
  VectorMetadata, 
  BatchUpsertRequest, 
  BatchUpsertResult,
  CollectionInfo,
} from '../../config/vector-config'
import { logger } from '../../logger'
import crypto from 'crypto'

export class VectorStoreService {
  private client: QdrantVectorClient
  private collectionName: string

  constructor(client?: QdrantVectorClient) {
    this.client = client || getQdrantClient()
    this.collectionName = VECTOR_CONFIG.collections.name
  }

  /**
   * Create collection if it doesn't exist
   */
  async createCollection(
    collectionName?: string,
    vectorSize?: number,
    distance?: 'Cosine' | 'Euclid' | 'Dot'
  ): Promise<void> {
    const name = collectionName || this.collectionName
    const size = vectorSize || VECTOR_CONFIG.collections.vectorSize
    const distanceMetric = distance || VECTOR_CONFIG.collections.distance

    try {
      await this.client.ensureConnection()
      
      // Check if collection already exists
      const exists = await this.client.collectionExists(name)
      if (exists) {
        logger.info('Collection already exists', { collection: name })
        return
      }

      // Create collection
      await this.client.withRetry(async () => {
        const qdrantClient = this.client.getClient()
        
        await qdrantClient.createCollection(name, {
          vectors: {
            size,
            distance: distanceMetric,
            on_disk: VECTOR_CONFIG.collections.onDisk,
          },
          replication_factor: VECTOR_CONFIG.collections.replicationFactor,
          shard_number: VECTOR_CONFIG.collections.shardNumber,
          optimized_config: {
            default_segment_number: 2,
            memmap_threshold: 20000,
            indexing_threshold: 20000,
            payload_storage_type: 'on_disk',
          },
        })
      }, `Create collection ${name}`)

      logger.info('Collection created successfully', {
        collection: name,
        vectorSize: size,
        distance: distanceMetric,
      })
    } catch (error) {
      logger.error('Failed to create collection', {
        collection: name,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Ensure collection exists with proper configuration
   */
  async ensureCollection(): Promise<void> {
    await this.createCollection()
  }

  /**
   * Upsert a single vector point
   */
  async upsertPoint(
    id: string,
    vector: number[],
    metadata: VectorMetadata,
    collectionName?: string
  ): Promise<void> {
    const collection = collectionName || this.collectionName

    try {
      await this.ensureCollection()
      
      // Validate vector dimensions
      if (vector.length !== VECTOR_CONFIG.collections.vectorSize) {
        throw new Error(
          `Vector dimension mismatch. Expected ${VECTOR_CONFIG.collections.vectorSize}, got ${vector.length}`
        )
      }

      // Add timestamp if not present
      const enrichedMetadata: VectorMetadata = {
        ...metadata,
        updatedAt: new Date().toISOString(),
      }

      await this.client.withRetry(async () => {
        const qdrantClient = this.client.getClient()
        
        await qdrantClient.upsert(collection, {
          wait: true,
          points: [{
            id,
            vector,
            payload: enrichedMetadata,
          }],
        })
      }, `Upsert point ${id}`)

      logger.debug('Point upserted successfully', {
        collection,
        pointId: id,
        metadataKeys: Object.keys(enrichedMetadata),
      })
    } catch (error) {
      logger.error('Failed to upsert point', {
        collection,
        pointId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Batch upsert multiple vector points
   */
  async batchUpsert(
    points: VectorPoint[],
    options?: {
      collectionName?: string
      wait?: boolean
      batchSize?: number
    }
  ): Promise<BatchUpsertResult[]> {
    const collection = options?.collectionName || this.collectionName
    const wait = options?.wait !== false
    const batchSize = options?.batchSize || VECTOR_CONFIG.embeddings.batchSize

    if (points.length === 0) {
      return []
    }

    try {
      await this.ensureCollection()

      // Validate all vectors have correct dimensions
      const expectedDim = VECTOR_CONFIG.collections.vectorSize
      for (const point of points) {
        if (point.vector.length !== expectedDim) {
          throw new Error(
            `Vector dimension mismatch for point ${point.id}. Expected ${expectedDim}, got ${point.vector.length}`
          )
        }
      }

      const results: BatchUpsertResult[] = []
      const timestamp = new Date().toISOString()

      // Process in batches
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize)
        
        // Enrich metadata with timestamps
        const enrichedBatch = batch.map(point => ({
          ...point,
          payload: {
            ...point.payload,
            updatedAt: timestamp,
          },
        }))

        const result = await this.client.withRetry(async () => {
          const qdrantClient = this.client.getClient()
          
          return await qdrantClient.upsert(collection, {
            wait,
            points: enrichedBatch,
          })
        }, `Batch upsert ${i}-${i + batch.length}`)

        results.push({
          operationId: result.operation_id,
          status: result.status as any,
          result,
        })

        // Log progress for large batches
        if (points.length > batchSize) {
          const processed = Math.min(i + batchSize, points.length)
          logger.info('Batch upsert progress', {
            collection,
            processed,
            total: points.length,
            percentage: Math.round((processed / points.length) * 100),
          })
        }
      }

      logger.info('Batch upsert completed', {
        collection,
        totalPoints: points.length,
        batches: results.length,
      })

      return results
    } catch (error) {
      logger.error('Failed to batch upsert', {
        collection,
        pointCount: points.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Delete points by IDs
   */
  async deletePoints(
    ids: (string | number)[],
    collectionName?: string
  ): Promise<void> {
    const collection = collectionName || this.collectionName

    try {
      await this.client.withRetry(async () => {
        const qdrantClient = this.client.getClient()
        
        await qdrantClient.delete(collection, {
          wait: true,
          points: ids,
        })
      }, `Delete ${ids.length} points`)

      logger.info('Points deleted successfully', {
        collection,
        deletedCount: ids.length,
      })
    } catch (error) {
      logger.error('Failed to delete points', {
        collection,
        pointCount: ids.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Delete points by filter
   */
  async deleteByFilter(
    filter: Record<string, any>,
    collectionName?: string
  ): Promise<void> {
    const collection = collectionName || this.collectionName

    try {
      await this.client.withRetry(async () => {
        const qdrantClient = this.client.getClient()
        
        await qdrantClient.delete(collection, {
          wait: true,
          filter,
        })
      }, 'Delete points by filter')

      logger.info('Points deleted by filter', {
        collection,
        filter,
      })
    } catch (error) {
      logger.error('Failed to delete points by filter', {
        collection,
        filter,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Get point by ID
   */
  async getPoint(
    id: string | number,
    collectionName?: string
  ): Promise<VectorPoint | null> {
    const collection = collectionName || this.collectionName

    try {
      const result = await this.client.withRetry(async () => {
        const qdrantClient = this.client.getClient()
        
        return await qdrantClient.retrieve(collection, {
          ids: [id],
          with_payload: true,
          with_vector: true,
        })
      }, `Get point ${id}`)

      if (result.length === 0) {
        return null
      }

      const point = result[0]
      return {
        id: point.id,
        vector: Array.isArray(point.vector) ? point.vector : [],
        payload: point.payload as VectorMetadata,
      }
    } catch (error) {
      logger.error('Failed to get point', {
        collection,
        pointId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return null
    }
  }

  /**
   * Get multiple points by IDs
   */
  async getPoints(
    ids: (string | number)[],
    collectionName?: string
  ): Promise<VectorPoint[]> {
    const collection = collectionName || this.collectionName

    if (ids.length === 0) {
      return []
    }

    try {
      const result = await this.client.withRetry(async () => {
        const qdrantClient = this.client.getClient()
        
        return await qdrantClient.retrieve(collection, {
          ids,
          with_payload: true,
          with_vector: true,
        })
      }, `Get ${ids.length} points`)

      return result.map(point => ({
        id: point.id,
        vector: Array.isArray(point.vector) ? point.vector : [],
        payload: point.payload as VectorMetadata,
      }))
    } catch (error) {
      logger.error('Failed to get points', {
        collection,
        pointCount: ids.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return []
    }
  }

  /**
   * Generate content hash for deduplication
   */
  generateContentHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex')
  }

  /**
   * Create vector point from content and metadata
   */
  createVectorPoint(
    content: string,
    vector: number[],
    metadata: Partial<VectorMetadata>
  ): VectorPoint {
    const contentHash = this.generateContentHash(content)
    const timestamp = new Date().toISOString()
    
    // Generate ID from content hash and metadata
    const idContent = `${contentHash}-${metadata.accountNumber}-${metadata.scope}`
    const id = crypto.createHash('sha256').update(idContent).digest('hex')

    const fullMetadata: VectorMetadata = {
      accountNumber: metadata.accountNumber || '',
      scope: metadata.scope || 'document',
      sourceType: metadata.sourceType || 'unknown',
      contentHash,
      tokenCount: this.estimateTokenCount(content),
      createdAt: timestamp,
      ...metadata,
    }

    return {
      id,
      vector,
      payload: fullMetadata,
    }
  }

  /**
   * Estimate token count for content
   */
  private estimateTokenCount(content: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(content.length / 4)
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(collectionName?: string): Promise<CollectionInfo | null> {
    const collection = collectionName || this.collectionName
    return await this.client.getCollectionInfo(collection)
  }

  /**
   * Optimize collection
   */
  async optimizeCollection(collectionName?: string): Promise<void> {
    const collection = collectionName || this.collectionName

    try {
      await this.client.withRetry(async () => {
        const qdrantClient = this.client.getClient()
        
        // Trigger optimization
        await qdrantClient.updateCollection(collection, {
          optimizers_config: {
            indexing_threshold: 20000,
            default_segment_number: 2,
          },
        })
      }, `Optimize collection ${collection}`)

      logger.info('Collection optimization triggered', { collection })
    } catch (error) {
      logger.error('Failed to optimize collection', {
        collection,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Clear collection (delete all points)
   */
  async clearCollection(collectionName?: string): Promise<void> {
    const collection = collectionName || this.collectionName

    try {
      await this.client.withRetry(async () => {
        const qdrantClient = this.client.getClient()
        
        // Delete all points
        await qdrantClient.delete(collection, {
          wait: true,
          filter: {}, // Empty filter matches all points
        })
      }, `Clear collection ${collection}`)

      logger.warn('Collection cleared', { collection })
    } catch (error) {
      logger.error('Failed to clear collection', {
        collection,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Drop collection
   */
  async dropCollection(collectionName?: string): Promise<void> {
    const collection = collectionName || this.collectionName

    try {
      await this.client.withRetry(async () => {
        const qdrantClient = this.client.getClient()
        
        await qdrantClient.deleteCollection(collection)
      }, `Drop collection ${collection}`)

      logger.warn('Collection dropped', { collection })
    } catch (error) {
      logger.error('Failed to drop collection', {
        collection,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }
}

// Singleton instance
let vectorStore: VectorStoreService | null = null

/**
 * Get singleton vector store instance
 */
export function getVectorStore(): VectorStoreService {
  if (!vectorStore) {
    vectorStore = new VectorStoreService()
  }
  return vectorStore
}