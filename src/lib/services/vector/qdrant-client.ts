/**
 * Qdrant Vector Database Client
 * Manages connection and basic operations with Qdrant
 */

import { QdrantClient } from '@qdrant/js-client-rest'
import { VECTOR_CONFIG, VectorHealthCheck, CollectionInfo } from '../../config/vector-config'
import { logger } from '../../logger'

export class QdrantVectorClient {
  private client: QdrantClient
  private isConnected: boolean = false
  private connectionAttempts: number = 0
  private maxConnectionAttempts: number = 5

  constructor() {
    this.initializeClient()
  }

  /**
   * Initialize Qdrant client
   */
  private initializeClient(): void {
    try {
      const config = VECTOR_CONFIG.qdrant
      
      // Build connection URL
      const protocol = config.apiKey ? 'https' : 'http'
      const url = `${protocol}://${config.host}:${config.port}`

      this.client = new QdrantClient({
        url,
        apiKey: config.apiKey,
        timeout: config.timeout,
      })

      logger.info('Qdrant client initialized', {
        host: config.host,
        port: config.port,
        hasApiKey: !!config.apiKey,
      })
    } catch (error) {
      logger.error('Failed to initialize Qdrant client', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Establish connection to Qdrant
   */
  async connect(): Promise<void> {
    try {
      this.connectionAttempts++
      
      // Test connection with a simple API call
      await this.client.getCollections()
      
      this.isConnected = true
      this.connectionAttempts = 0
      
      logger.info('Connected to Qdrant successfully')
    } catch (error) {
      this.isConnected = false
      
      logger.error('Failed to connect to Qdrant', {
        attempt: this.connectionAttempts,
        maxAttempts: this.maxConnectionAttempts,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      if (this.connectionAttempts < this.maxConnectionAttempts) {
        const delay = VECTOR_CONFIG.qdrant.retryDelay * this.connectionAttempts
        logger.info(`Retrying connection in ${delay}ms`)
        
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.connect()
      }

      throw new Error(`Failed to connect to Qdrant after ${this.maxConnectionAttempts} attempts`)
    }
  }

  /**
   * Ensure connection is established
   */
  async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      await this.connect()
    }
  }

  /**
   * Get Qdrant client instance
   */
  getClient(): QdrantClient {
    return this.client
  }

  /**
   * Check if client is connected
   */
  isHealthy(): boolean {
    return this.isConnected
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<VectorHealthCheck> {
    const startTime = Date.now()
    
    try {
      await this.ensureConnection()
      
      // Get collections info
      const collectionsResponse = await this.client.getCollections()
      const collections: VectorHealthCheck['collections'] = {}
      
      // Check each collection
      for (const collection of collectionsResponse.collections) {
        try {
          const info = await this.client.getCollection(collection.name)
          collections[collection.name] = {
            exists: true,
            pointsCount: info.points_count || 0,
            status: info.status || 'unknown',
          }
        } catch (error) {
          collections[collection.name] = {
            exists: false,
            pointsCount: 0,
            status: 'error',
          }
        }
      }

      const latency = Date.now() - startTime
      
      return {
        status: 'healthy',
        collections,
        latency,
        details: {
          connectionAttempts: this.connectionAttempts,
          isConnected: this.isConnected,
        },
      }
    } catch (error) {
      const latency = Date.now() - startTime
      
      logger.error('Qdrant health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        latency,
      })

      return {
        status: 'unhealthy',
        collections: {},
        latency,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          connectionAttempts: this.connectionAttempts,
          isConnected: this.isConnected,
        },
      }
    }
  }

  /**
   * Get collection information
   */
  async getCollectionInfo(collectionName: string): Promise<CollectionInfo | null> {
    try {
      await this.ensureConnection()
      
      const info = await this.client.getCollection(collectionName)
      
      return {
        name: collectionName,
        vectorSize: info.config?.params?.vectors?.size || 0,
        pointsCount: info.points_count || 0,
        indexedVectorsCount: info.indexed_vectors_count || 0,
        segmentsCount: info.segments_count || 0,
        status: info.status || 'unknown',
        config: {
          distance: info.config?.params?.vectors?.distance || 'Unknown',
          onDisk: info.config?.params?.vectors?.on_disk || false,
          replicationFactor: info.config?.replication_factor,
          shardNumber: info.config?.shard_number,
        },
      }
    } catch (error) {
      logger.error('Failed to get collection info', {
        collection: collectionName,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return null
    }
  }

  /**
   * List all collections
   */
  async listCollections(): Promise<string[]> {
    try {
      await this.ensureConnection()
      
      const response = await this.client.getCollections()
      return response.collections.map(c => c.name)
    } catch (error) {
      logger.error('Failed to list collections', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Check if collection exists
   */
  async collectionExists(collectionName: string): Promise<boolean> {
    try {
      await this.ensureConnection()
      
      await this.client.getCollection(collectionName)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Get Qdrant cluster info
   */
  async getClusterInfo(): Promise<any> {
    try {
      await this.ensureConnection()
      
      return await this.client.clusterInfo()
    } catch (error) {
      logger.error('Failed to get cluster info', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Get Qdrant metrics
   */
  async getMetrics(): Promise<any> {
    try {
      await this.ensureConnection()
      
      // Get basic metrics from collections
      const collections = await this.listCollections()
      const metrics: any = {
        collections: {},
        totalPoints: 0,
        totalCollections: collections.length,
      }

      for (const collectionName of collections) {
        const info = await this.getCollectionInfo(collectionName)
        if (info) {
          metrics.collections[collectionName] = {
            pointsCount: info.pointsCount,
            status: info.status,
          }
          metrics.totalPoints += info.pointsCount
        }
      }

      return metrics
    } catch (error) {
      logger.error('Failed to get metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Disconnect from Qdrant
   */
  async disconnect(): Promise<void> {
    try {
      this.isConnected = false
      logger.info('Disconnected from Qdrant')
    } catch (error) {
      logger.error('Error during disconnect', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Retry wrapper for operations
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = VECTOR_CONFIG.qdrant.maxRetries
  ): Promise<T> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        logger.warn(`${operationName} failed (attempt ${attempt}/${maxRetries})`, {
          error: lastError.message,
        })

        if (attempt < maxRetries) {
          const delay = VECTOR_CONFIG.qdrant.retryDelay * attempt
          await new Promise(resolve => setTimeout(resolve, delay))
          
          // Try to reconnect if connection was lost
          if (!this.isConnected) {
            try {
              await this.connect()
            } catch (connectError) {
              logger.error('Failed to reconnect during retry', {
                error: connectError instanceof Error ? connectError.message : 'Unknown error',
              })
            }
          }
        }
      }
    }

    throw lastError || new Error(`${operationName} failed after ${maxRetries} attempts`)
  }
}

// Singleton instance
let qdrantClient: QdrantVectorClient | null = null

/**
 * Get singleton Qdrant client instance
 */
export function getQdrantClient(): QdrantVectorClient {
  if (!qdrantClient) {
    qdrantClient = new QdrantVectorClient()
  }
  return qdrantClient
}

/**
 * Initialize and connect to Qdrant
 */
export async function initializeQdrant(): Promise<QdrantVectorClient> {
  const client = getQdrantClient()
  await client.connect()
  return client
}