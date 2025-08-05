/**
 * Vector Database Configuration
 * Configuration for Qdrant vector database and embedding services
 */

export interface VectorConfig {
  qdrant: {
    host: string
    port: number
    grpcPort?: number
    apiKey?: string
    timeout: number
    maxRetries: number
    retryDelay: number
  }
  collections: {
    name: string
    vectorSize: number
    distance: 'Cosine' | 'Euclid' | 'Dot'
    onDisk?: boolean
    replicationFactor?: number
    shardNumber?: number
  }
  embeddings: {
    defaultProvider: 'openai' | 'anthropic' | 'local'
    dimensions: Record<string, number>
    batchSize: number
    chunkSize: number
    chunkOverlap: number
    maxTokens: number
  }
  search: {
    defaultLimit: number
    maxLimit: number
    scoreThreshold: number
    exactSearch: boolean
  }
  cache: {
    enabled: boolean
    ttl: number
    maxSize: number
  }
}

// Default vector configuration
export const VECTOR_CONFIG: VectorConfig = {
  qdrant: {
    host: process.env.QDRANT_HOST || 'localhost',
    port: parseInt(process.env.QDRANT_PORT || '6333'),
    grpcPort: process.env.QDRANT_GRPC_PORT ? parseInt(process.env.QDRANT_GRPC_PORT) : undefined,
    apiKey: process.env.QDRANT_API_KEY,
    timeout: parseInt(process.env.QDRANT_TIMEOUT || '30000'),
    maxRetries: parseInt(process.env.QDRANT_MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.QDRANT_RETRY_DELAY || '1000'),
  },
  collections: {
    name: process.env.QDRANT_COLLECTION_NAME || 'northstar_vectors',
    vectorSize: parseInt(process.env.VECTOR_SIZE || '1536'), // OpenAI text-embedding-3-large default
    distance: (process.env.VECTOR_DISTANCE as any) || 'Cosine',
    onDisk: process.env.VECTOR_ON_DISK === 'true',
    replicationFactor: process.env.VECTOR_REPLICATION_FACTOR ? parseInt(process.env.VECTOR_REPLICATION_FACTOR) : undefined,
    shardNumber: process.env.VECTOR_SHARD_NUMBER ? parseInt(process.env.VECTOR_SHARD_NUMBER) : undefined,
  },
  embeddings: {
    defaultProvider: (process.env.AI_EMBEDDINGS_PROVIDER as any) || 'openai',
    dimensions: {
      'text-embedding-3-large': 3072, // Max for OpenAI
      'text-embedding-3-small': 1536,
      'text-embedding-ada-002': 1536,
      'nomic-embed-text': 768,
      'claude-3-embeddings': 1024, // Hypothetical
    },
    batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE || '100'),
    chunkSize: parseInt(process.env.EMBEDDING_CHUNK_SIZE || '1000'),
    chunkOverlap: parseInt(process.env.EMBEDDING_CHUNK_OVERLAP || '100'),
    maxTokens: parseInt(process.env.EMBEDDING_MAX_TOKENS || '8000'),
  },
  search: {
    defaultLimit: parseInt(process.env.VECTOR_SEARCH_DEFAULT_LIMIT || '10'),
    maxLimit: parseInt(process.env.VECTOR_SEARCH_MAX_LIMIT || '100'),
    scoreThreshold: parseFloat(process.env.VECTOR_SEARCH_SCORE_THRESHOLD || '0.7'),
    exactSearch: process.env.VECTOR_EXACT_SEARCH === 'true',
  },
  cache: {
    enabled: process.env.VECTOR_CACHE_ENABLED !== 'false',
    ttl: parseInt(process.env.VECTOR_CACHE_TTL || '3600'), // 1 hour
    maxSize: parseInt(process.env.VECTOR_CACHE_MAX_SIZE || '1000'),
  },
}

// Vector metadata interface
export interface VectorMetadata {
  accountNumber: string
  scope: 'account' | 'contact' | 'technology' | 'document' | 'insight'
  sourceType: string
  contentHash: string
  tokenCount: number
  createdAt: string
  updatedAt?: string
  
  // Optional fields based on scope
  documentId?: string
  documentName?: string
  documentType?: string
  chunkIndex?: number
  totalChunks?: number
  
  // Account-specific metadata
  accountId?: string
  accountName?: string
  industry?: string
  companySize?: string
  
  // Contact-specific metadata
  contactId?: string
  contactName?: string
  title?: string
  department?: string
  
  // Technology-specific metadata
  technologyName?: string
  technologyCategory?: string
  confidence?: number
  
  // Custom metadata
  tags?: string[]
  priority?: 'low' | 'medium' | 'high'
  confidenceScore?: number
  
  [key: string]: any
}

// Search filter interface
export interface VectorSearchFilter {
  accountNumber?: string | string[]
  scope?: VectorMetadata['scope'] | VectorMetadata['scope'][]
  sourceType?: string | string[]
  documentType?: string | string[]
  industry?: string | string[]
  tags?: string | string[]
  dateRange?: {
    start: string
    end: string
  }
  confidenceRange?: {
    min: number
    max: number
  }
}

// Vector point interface for Qdrant
export interface VectorPoint {
  id: string | number
  vector: number[]
  payload: VectorMetadata
}

// Search result interface
export interface VectorSearchResult {
  id: string | number
  score: number
  payload: VectorMetadata
  vector?: number[]
}

// Collection info interface
export interface CollectionInfo {
  name: string
  vectorSize: number
  pointsCount: number
  indexedVectorsCount: number
  segmentsCount: number
  status: string
  config: {
    distance: string
    onDisk: boolean
    replicationFactor?: number
    shardNumber?: number
  }
}

// Health check result
export interface VectorHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  collections: {
    [collectionName: string]: {
      exists: boolean
      pointsCount: number
      status: string
    }
  }
  latency: number
  version?: string
  details?: any
}

// Batch operation interfaces
export interface BatchUpsertRequest {
  points: VectorPoint[]
  wait?: boolean
}

export interface BatchUpsertResult {
  operationId?: number
  status: 'completed' | 'acknowledged'
  result?: {
    operationId?: number
    status: string
  }
}

// Search options
export interface VectorSearchOptions {
  limit?: number
  offset?: number
  scoreThreshold?: number
  filter?: VectorSearchFilter
  withVector?: boolean
  withPayload?: boolean
  exact?: boolean
}

// Embedding generation options
export interface EmbeddingOptions {
  provider?: 'openai' | 'anthropic' | 'local'
  model?: string
  dimensions?: number
  useCache?: boolean
  batchSize?: number
}

// Chunk processing options
export interface ChunkOptions {
  chunkSize?: number
  chunkOverlap?: number
  preserveSentences?: boolean
  metadata?: Partial<VectorMetadata>
}