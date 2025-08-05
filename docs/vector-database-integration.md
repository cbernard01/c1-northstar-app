# Vector Database Integration

This document describes the Qdrant vector database integration and embedding services for the C1 Northstar Sales Intelligence Platform.

## Overview

The vector database integration provides semantic search capabilities across account data, documents, and insights. It includes:

- **Qdrant Vector Database**: High-performance vector storage and search
- **Enhanced Embedding Service**: Multi-provider embedding generation
- **Vector Search Service**: Semantic search with filtering
- **Vector Store Service**: Batch operations and data management

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Routes    │    │  Vector Services │    │     Qdrant      │
│                 │    │                 │    │                 │
│ /api/vector/*   │───▶│ VectorService   │───▶│   Collections   │
│                 │    │ EmbeddingService│    │     Vectors     │
│                 │    │ SearchService   │    │    Metadata     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Components

### 1. Vector Configuration (`src/lib/config/vector-config.ts`)

Central configuration for all vector operations:
- Qdrant connection settings
- Collection configuration
- Embedding settings
- Search parameters
- Cache configuration

### 2. Qdrant Client (`src/lib/services/vector/qdrant-client.ts`)

Low-level Qdrant database client:
- Connection management with retries
- Health monitoring
- Collection management
- Error handling and logging

### 3. Vector Store Service (`src/lib/services/vector/vector-store.ts`)

High-level vector storage operations:
- Collection creation and management
- Batch upsert operations
- Point management (CRUD)
- Content deduplication
- Performance optimization

### 4. Vector Search Service (`src/lib/services/vector/vector-search.ts`)

Semantic search capabilities:
- Vector similarity search
- Multi-field filtering
- Batch search operations
- Result caching
- Context retrieval

### 5. Enhanced Embedding Service (`src/lib/services/ai/embedding-service.ts`)

Multi-provider embedding generation:
- OpenAI embeddings (text-embedding-3-large)
- Azure OpenAI embeddings
- Local embedding service support
- Batch processing
- Token counting and caching
- Document chunking

## Usage Examples

### Basic Semantic Search

```typescript
import { getVectorService } from '@/lib/services/vector'

const vectorService = getVectorService()

// Search across all content
const results = await vectorService.semanticSearch(
  "technology stack modernization opportunities",
  {
    accountNumber: "ACC001",
    limit: 10,
    scoreThreshold: 0.75
  }
)
```

### Document Processing

```typescript
// Process and store document
const result = await vectorService.processDocument(
  documentContent,
  {
    accountNumber: "ACC001",
    scope: "document",
    sourceType: "pdf",
    documentName: "tech-assessment.pdf"
  },
  {
    chunkSize: 1000,
    chunkOverlap: 100,
    provider: "openai"
  }
)
```

### Context Retrieval

```typescript
// Get context for RAG applications
const context = await vectorService.getContextForAccount(
  "What are the main challenges?",
  "ACC001",
  {
    maxChunks: 5,
    scoreThreshold: 0.8,
    documentTypes: ["pdf", "docx"]
  }
)
```

## API Endpoints

### Health Check
- `GET /api/vector/health` - Service health status

### Search
- `POST /api/vector/search` - Semantic search with filters

### Context
- `POST /api/vector/context` - Get context chunks for account

### Embeddings
- `POST /api/vector/embeddings` - Generate embeddings

### Statistics
- `GET /api/vector/stats` - Service statistics
- `DELETE /api/vector/stats` - Clear caches

## Configuration

### Environment Variables

```bash
# Qdrant Connection
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_API_KEY=optional_api_key

# Vector Settings
VECTOR_SIZE=1536
VECTOR_DISTANCE=Cosine
QDRANT_COLLECTION_NAME=northstar_vectors

# Embedding Settings
AI_EMBEDDINGS_PROVIDER=openai
EMBEDDING_BATCH_SIZE=100
EMBEDDING_CHUNK_SIZE=1000
EMBEDDING_CHUNK_OVERLAP=100

# Search Settings
VECTOR_SEARCH_DEFAULT_LIMIT=10
VECTOR_SEARCH_SCORE_THRESHOLD=0.7

# Cache Settings
VECTOR_CACHE_ENABLED=true
VECTOR_CACHE_TTL=3600
```

### Docker Deployment

Qdrant is included in the docker-compose.yaml:

```yaml
qdrant:
  image: qdrant/qdrant:v1.7.4
  ports:
    - "6333:6333"
    - "6334:6334"
  volumes:
    - qdrant_data:/qdrant/storage
```

## Data Model

### Vector Metadata Structure

```typescript
interface VectorMetadata {
  accountNumber: string
  scope: 'account' | 'contact' | 'technology' | 'document' | 'insight'
  sourceType: string
  contentHash: string
  tokenCount: number
  createdAt: string
  updatedAt?: string
  
  // Optional fields
  documentId?: string
  documentName?: string
  documentType?: string
  chunkIndex?: number
  totalChunks?: number
  accountId?: string
  accountName?: string
  industry?: string
  
  // Custom metadata
  tags?: string[]
  priority?: 'low' | 'medium' | 'high'
  confidenceScore?: number
}
```

## Performance Considerations

### Scaling for 9,000+ Accounts

1. **Batch Operations**: Process embeddings in batches of 100
2. **Collection Sharding**: Configure shards based on data volume
3. **Memory vs Disk**: Use `on_disk` storage for large collections
4. **Indexing**: Optimize indexing threshold (20,000 vectors)
5. **Caching**: Enable vector search result caching
6. **Rate Limiting**: Respect embedding provider rate limits

### Optimization Settings

```typescript
const collectionConfig = {
  vectors: {
    size: 1536,
    distance: 'Cosine',
    on_disk: true, // For large datasets
  },
  optimized_config: {
    default_segment_number: 2,
    memmap_threshold: 20000,
    indexing_threshold: 20000,
    payload_storage_type: 'on_disk',
  },
}
```

## Monitoring and Health

### Health Checks

```typescript
const health = await vectorService.healthCheck()
// Returns: healthy | degraded | unhealthy
```

### Statistics

```typescript
const stats = await vectorService.getStats()
// Returns collection info, cache stats, client metrics
```

### Logging

All operations are logged with appropriate levels:
- `INFO`: Successful operations, performance metrics
- `WARN`: Retries, partial failures
- `ERROR`: Failed operations, connection issues
- `DEBUG`: Detailed operation traces

## Error Handling

The implementation includes comprehensive error handling:

1. **Connection Retries**: Automatic reconnection with exponential backoff
2. **Graceful Degradation**: Fallback when services are unavailable  
3. **Validation**: Input validation for all operations
4. **Logging**: Detailed error logging for debugging
5. **Health Monitoring**: Continuous health checks

## Security

- Optional API key authentication for Qdrant
- Input validation and sanitization
- Rate limiting protection
- Secure embedding provider configurations
- Content hash-based deduplication

## Future Enhancements

1. **Multi-modal Embeddings**: Support for image and audio embeddings
2. **Advanced Filtering**: Complex query capabilities
3. **Real-time Updates**: Streaming vector updates
4. **Analytics**: Advanced search analytics and insights
5. **A/B Testing**: Embedding model comparison tools