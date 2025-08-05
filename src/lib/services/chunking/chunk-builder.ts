/**
 * Chunk Builder Service
 * Orchestrate chunking and vectorization pipeline with batch processing
 */

import { EmbeddingService } from '../../ai/embedding-service'
import { VectorStoreService, getVectorStore } from '../vector/vector-store'
import { VectorMetadata, VectorPoint } from '../../config/vector-config'
import { DocumentChunkerService, DocumentChunk, DocumentChunkingResult, getDocumentChunker } from './document-chunker'
import { AccountChunkerService, AccountChunk, AccountChunkingResult, getAccountChunker } from './account-chunker'
import { AssetChunkerService, AssetChunk, AssetChunkingResult, getAssetChunker } from './asset-chunker'
import { TParserResult } from '../parsers/file-parser.interface'
import { logger } from '../../logger'
import crypto from 'crypto'

export interface ChunkProcessingOptions {
  scope: 'sales-assets' | 'account-summary' | 'global-context'
  accountNumber?: string
  batchSize?: number
  concurrency?: number
  embeddingProvider?: 'openai' | 'azure'
  skipDuplicates?: boolean
  updateExisting?: boolean
  generateProgress?: boolean
  onProgress?: (progress: ChunkProcessingProgress) => void
  onError?: (error: ChunkProcessingError) => void
}

export interface ChunkProcessingProgress {
  stage: 'chunking' | 'embedding' | 'storing' | 'completed'
  processed: number
  total: number
  percentage: number
  currentItem?: string
  errors: number
  warnings: number
  estimatedTimeRemaining?: number
}

export interface ChunkProcessingError {
  stage: string
  itemId: string
  error: string
  recoverable: boolean
}

export interface ChunkProcessingResult {
  processedItems: number
  totalChunks: number
  successfulChunks: number
  failedChunks: number
  duplicateChunks: number
  totalTokens: number
  processingTime: number
  errors: ChunkProcessingError[]
  warnings: string[]
  vectorIds: string[]
}

export interface BatchProcessingJob {
  jobId: string
  scope: ChunkProcessingOptions['scope']
  accountNumbers?: string[]
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: ChunkProcessingProgress
  result?: ChunkProcessingResult
  startTime?: Date
  endTime?: Date
  options: ChunkProcessingOptions
}

export class ChunkBuilderService {
  private embeddingService: EmbeddingService
  private vectorStore: VectorStoreService
  private documentChunker: DocumentChunkerService
  private accountChunker: AccountChunkerService
  private assetChunker: AssetChunkerService
  private activeJobs: Map<string, BatchProcessingJob> = new Map()

  constructor(
    embeddingService?: EmbeddingService,
    vectorStore?: VectorStoreService,
    documentChunker?: DocumentChunkerService,
    accountChunker?: AccountChunkerService,
    assetChunker?: AssetChunkerService
  ) {
    this.embeddingService = embeddingService || new EmbeddingService()
    this.vectorStore = vectorStore || getVectorStore()
    this.documentChunker = documentChunker || getDocumentChunker()
    this.accountChunker = accountChunker || getAccountChunker()
    this.assetChunker = assetChunker || getAssetChunker()
  }

  /**
   * Process a single document with chunking and vectorization
   */
  async processDocument(
    parserResult: TParserResult,
    options: ChunkProcessingOptions
  ): Promise<ChunkProcessingResult> {
    const startTime = Date.now()
    const errors: ChunkProcessingError[] = []
    const warnings: string[] = []
    const vectorIds: string[] = []

    try {
      logger.info('Starting document processing', {
        fileName: parserResult.metadata.fileName,
        scope: options.scope,
        accountNumber: options.accountNumber,
      })

      // Stage 1: Chunking
      this.reportProgress(options, {
        stage: 'chunking',
        processed: 0,
        total: 1,
        percentage: 0,
        currentItem: parserResult.metadata.fileName,
        errors: 0,
        warnings: 0,
      })

      let chunkingResult: DocumentChunkingResult | AssetChunkingResult
      
      if (options.scope === 'sales-assets') {
        // Process as sales asset
        const assetMetadata = this.assetChunker.createAssetMetadata(parserResult)
        chunkingResult = await this.assetChunker.chunkAsset(parserResult, assetMetadata)
      } else {
        // Process as regular document
        chunkingResult = await this.documentChunker.chunkDocument(parserResult)
      }

      warnings.push(...chunkingResult.warnings)
      if (chunkingResult.errors.length > 0) {
        chunkingResult.errors.forEach(error => {
          errors.push({
            stage: 'chunking',
            itemId: parserResult.metadata.fileName,
            error,
            recoverable: true,
          })
        })
      }

      if (chunkingResult.chunks.length === 0) {
        throw new Error('No chunks were generated from the document')
      }

      // Stage 2: Embedding
      this.reportProgress(options, {
        stage: 'embedding',
        processed: 0,
        total: chunkingResult.chunks.length,
        percentage: 25,
        currentItem: 'Generating embeddings',
        errors: errors.length,
        warnings: warnings.length,
      })

      const vectorPoints = await this.generateEmbeddings(
        chunkingResult.chunks,
        options,
        (progress) => {
          this.reportProgress(options, {
            stage: 'embedding',
            processed: progress.processed,
            total: progress.total,
            percentage: 25 + (progress.percentage * 0.5),
            currentItem: `Embedding chunk ${progress.processed}/${progress.total}`,
            errors: errors.length,
            warnings: warnings.length,
          })
        }
      )

      // Stage 3: Storing
      this.reportProgress(options, {
        stage: 'storing',
        processed: 0,
        total: vectorPoints.length,
        percentage: 75,
        currentItem: 'Storing vectors',
        errors: errors.length,
        warnings: warnings.length,
      })

      const storeResult = await this.storeVectors(vectorPoints, options)
      vectorIds.push(...storeResult.vectorIds)

      if (storeResult.errors.length > 0) {
        errors.push(...storeResult.errors)
      }

      // Stage 4: Completed
      this.reportProgress(options, {
        stage: 'completed',
        processed: chunkingResult.chunks.length,
        total: chunkingResult.chunks.length,
        percentage: 100,
        errors: errors.length,
        warnings: warnings.length,
      })

      const processingTime = Date.now() - startTime
      const totalTokens = chunkingResult.chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0)

      logger.info('Document processing completed', {
        fileName: parserResult.metadata.fileName,
        totalChunks: chunkingResult.chunks.length,
        successfulChunks: storeResult.successful,
        failedChunks: storeResult.failed,
        totalTokens,
        processingTime,
      })

      return {
        processedItems: 1,
        totalChunks: chunkingResult.chunks.length,
        successfulChunks: storeResult.successful,
        failedChunks: storeResult.failed,
        duplicateChunks: storeResult.duplicates,
        totalTokens,
        processingTime,
        errors,
        warnings,
        vectorIds,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      errors.push({
        stage: 'processing',
        itemId: parserResult.metadata.fileName,
        error: errorMsg,
        recoverable: false,
      })

      logger.error('Document processing failed', {
        fileName: parserResult.metadata.fileName,
        error: errorMsg,
      })

      return {
        processedItems: 0,
        totalChunks: 0,
        successfulChunks: 0,
        failedChunks: 1,
        duplicateChunks: 0,
        totalTokens: 0,
        processingTime: Date.now() - startTime,
        errors,
        warnings,
        vectorIds: [],
      }
    }
  }

  /**
   * Process account data with chunking and vectorization
   */
  async processAccount(
    accountData: any, // Import AccountData type from account-chunker when needed
    options: ChunkProcessingOptions
  ): Promise<ChunkProcessingResult> {
    const startTime = Date.now()
    const errors: ChunkProcessingError[] = []
    const warnings: string[] = []
    const vectorIds: string[] = []

    try {
      logger.info('Starting account processing', {
        accountNumber: accountData.accountNumber,
        accountName: accountData.accountName,
        scope: options.scope,
      })

      // Stage 1: Chunking
      this.reportProgress(options, {
        stage: 'chunking',
        processed: 0,
        total: 1,
        percentage: 0,
        currentItem: accountData.accountName,
        errors: 0,
        warnings: 0,
      })

      const chunkingResult = await this.accountChunker.chunkAccountData(accountData, options)
      
      warnings.push(...chunkingResult.warnings)
      if (chunkingResult.errors.length > 0) {
        chunkingResult.errors.forEach(error => {
          errors.push({
            stage: 'chunking',
            itemId: accountData.accountNumber,
            error,
            recoverable: true,
          })
        })
      }

      if (chunkingResult.chunks.length === 0) {
        throw new Error('No chunks were generated from the account data')
      }

      // Stage 2: Embedding
      this.reportProgress(options, {
        stage: 'embedding',
        processed: 0,
        total: chunkingResult.chunks.length,
        percentage: 25,
        currentItem: 'Generating embeddings',
        errors: errors.length,
        warnings: warnings.length,
      })

      const vectorPoints = await this.generateEmbeddings(
        chunkingResult.chunks,
        options,
        (progress) => {
          this.reportProgress(options, {
            stage: 'embedding',
            processed: progress.processed,
            total: progress.total,
            percentage: 25 + (progress.percentage * 0.5),
            currentItem: `Embedding chunk ${progress.processed}/${progress.total}`,
            errors: errors.length,
            warnings: warnings.length,
          })
        }
      )

      // Stage 3: Storing
      this.reportProgress(options, {
        stage: 'storing',
        processed: 0,
        total: vectorPoints.length,
        percentage: 75,
        currentItem: 'Storing vectors',
        errors: errors.length,
        warnings: warnings.length,
      })

      const storeResult = await this.storeVectors(vectorPoints, options)
      vectorIds.push(...storeResult.vectorIds)

      if (storeResult.errors.length > 0) {
        errors.push(...storeResult.errors)
      }

      // Stage 4: Completed
      this.reportProgress(options, {
        stage: 'completed',
        processed: chunkingResult.chunks.length,
        total: chunkingResult.chunks.length,
        percentage: 100,
        errors: errors.length,
        warnings: warnings.length,
      })

      const processingTime = Date.now() - startTime
      const totalTokens = chunkingResult.chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0)

      logger.info('Account processing completed', {
        accountNumber: accountData.accountNumber,
        totalChunks: chunkingResult.chunks.length,
        successfulChunks: storeResult.successful,
        failedChunks: storeResult.failed,
        totalTokens,
        processingTime,
      })

      return {
        processedItems: 1,
        totalChunks: chunkingResult.chunks.length,
        successfulChunks: storeResult.successful,
        failedChunks: storeResult.failed,
        duplicateChunks: storeResult.duplicates,
        totalTokens,
        processingTime,
        errors,
        warnings,
        vectorIds,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      errors.push({
        stage: 'processing',
        itemId: accountData.accountNumber,
        error: errorMsg,
        recoverable: false,
      })

      logger.error('Account processing failed', {
        accountNumber: accountData.accountNumber,
        error: errorMsg,
      })

      return {
        processedItems: 0,
        totalChunks: 0,
        successfulChunks: 0,
        failedChunks: 1,
        duplicateChunks: 0,
        totalTokens: 0,
        processingTime: Date.now() - startTime,
        errors,
        warnings,
        vectorIds: [],
      }
    }
  }

  /**
   * Process multiple items in batch
   */
  async processBatch(
    items: Array<{ type: 'document'; data: TParserResult } | { type: 'account'; data: any }>,
    options: ChunkProcessingOptions
  ): Promise<{ jobId: string; job: BatchProcessingJob }> {
    const jobId = this.generateJobId()
    const job: BatchProcessingJob = {
      jobId,
      scope: options.scope,
      status: 'pending',
      progress: {
        stage: 'chunking',
        processed: 0,
        total: items.length,
        percentage: 0,
        errors: 0,
        warnings: 0,
      },
      startTime: new Date(),
      options,
    }

    this.activeJobs.set(jobId, job)

    // Process in background
    this.processBatchAsync(job, items, options).catch(error => {
      logger.error('Batch processing failed', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      job.status = 'failed'
      job.endTime = new Date()
    })

    return { jobId, job }
  }

  /**
   * Process batch asynchronously
   */
  private async processBatchAsync(
    job: BatchProcessingJob,
    items: Array<{ type: 'document'; data: TParserResult } | { type: 'account'; data: any }>,
    options: ChunkProcessingOptions
  ): Promise<void> {
    try {
      job.status = 'running'
      
      const results: ChunkProcessingResult[] = []
      const concurrency = options.concurrency || 3
      const batches = this.chunkArray(items, concurrency)

      let processed = 0
      const startTime = Date.now()

      for (const batch of batches) {
        const batchPromises = batch.map(async (item) => {
          try {
            let result: ChunkProcessingResult
            
            if (item.type === 'document') {
              result = await this.processDocument(item.data, options)
            } else {
              result = await this.processAccount(item.data, options)
            }
            
            processed++
            
            // Update progress
            const percentage = Math.round((processed / items.length) * 100)
            const elapsed = Date.now() - startTime
            const estimatedTimeRemaining = processed > 0 
              ? Math.round((elapsed / processed) * (items.length - processed))
              : undefined

            job.progress = {
              stage: processed === items.length ? 'completed' : 'storing',
              processed,
              total: items.length,
              percentage,
              currentItem: item.type === 'document' 
                ? item.data.metadata.fileName 
                : item.data.accountName,
              errors: result.errors.length,
              warnings: result.warnings.length,
              estimatedTimeRemaining,
            }

            return result
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            logger.error('Batch item processing failed', {
              jobId: job.jobId,
              itemType: item.type,
              error: errorMsg,
            })
            
            return {
              processedItems: 0,
              totalChunks: 0,
              successfulChunks: 0,
              failedChunks: 1,
              duplicateChunks: 0,
              totalTokens: 0,
              processingTime: 0,
              errors: [{
                stage: 'processing',
                itemId: item.type === 'document' ? item.data.metadata.fileName : item.data.accountNumber,
                error: errorMsg,
                recoverable: false,
              }],
              warnings: [],
              vectorIds: [],
            }
          }
        })

        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)
      }

      // Aggregate results
      const aggregatedResult: ChunkProcessingResult = {
        processedItems: results.reduce((sum, r) => sum + r.processedItems, 0),
        totalChunks: results.reduce((sum, r) => sum + r.totalChunks, 0),
        successfulChunks: results.reduce((sum, r) => sum + r.successfulChunks, 0),
        failedChunks: results.reduce((sum, r) => sum + r.failedChunks, 0),
        duplicateChunks: results.reduce((sum, r) => sum + r.duplicateChunks, 0),
        totalTokens: results.reduce((sum, r) => sum + r.totalTokens, 0),
        processingTime: Date.now() - startTime,
        errors: results.flatMap(r => r.errors),
        warnings: results.flatMap(r => r.warnings),
        vectorIds: results.flatMap(r => r.vectorIds),
      }

      job.result = aggregatedResult
      job.status = 'completed'
      job.endTime = new Date()

      logger.info('Batch processing completed', {
        jobId: job.jobId,
        processedItems: aggregatedResult.processedItems,
        totalChunks: aggregatedResult.totalChunks,
        successfulChunks: aggregatedResult.successfulChunks,
        failedChunks: aggregatedResult.failedChunks,
        processingTime: aggregatedResult.processingTime,
      })
    } catch (error) {
      job.status = 'failed'
      job.endTime = new Date()
      throw error
    }
  }

  /**
   * Generate embeddings for chunks
   */
  private async generateEmbeddings(
    chunks: (DocumentChunk | AccountChunk | AssetChunk)[],
    options: ChunkProcessingOptions,
    onProgress?: (progress: { processed: number; total: number; percentage: number }) => void
  ): Promise<VectorPoint[]> {
    const batchSize = options.batchSize || 10
    const provider = options.embeddingProvider || 'openai'
    const vectorPoints: VectorPoint[] = []

    const batches = this.chunkArray(chunks, batchSize)
    let processed = 0

    for (const batch of batches) {
      const texts = batch.map(chunk => chunk.text)
      
      try {
        const embeddings = await this.embeddingService.generateBatchEmbeddings(
          texts,
          provider,
          { useCache: true }
        )

        // Create vector points
        for (let i = 0; i < batch.length; i++) {
          const chunk = batch[i]
          const embedding = embeddings[i]
          
          const vectorPoint = this.createVectorPoint(chunk, embedding.embedding, options)
          vectorPoints.push(vectorPoint)
        }

        processed += batch.length
        
        if (onProgress) {
          onProgress({
            processed,
            total: chunks.length,
            percentage: Math.round((processed / chunks.length) * 100),
          })
        }
      } catch (error) {
        logger.error('Batch embedding generation failed', {
          batchSize: batch.length,
          processed,
          total: chunks.length,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        throw error
      }
    }

    return vectorPoints
  }

  /**
   * Store vectors in Qdrant
   */
  private async storeVectors(
    vectorPoints: VectorPoint[],
    options: ChunkProcessingOptions
  ): Promise<{
    successful: number
    failed: number
    duplicates: number
    vectorIds: string[]
    errors: ChunkProcessingError[]
  }> {
    const errors: ChunkProcessingError[] = []
    const vectorIds: string[] = []
    let successful = 0
    let failed = 0
    let duplicates = 0

    try {
      // Check for duplicates if requested
      if (options.skipDuplicates) {
        const uniquePoints: VectorPoint[] = []
        const contentHashes = new Set<string>()

        for (const point of vectorPoints) {
          const contentHash = point.payload.contentHash
          if (!contentHashes.has(contentHash)) {
            contentHashes.add(contentHash)
            uniquePoints.push(point)
          } else {
            duplicates++
          }
        }

        vectorPoints = uniquePoints
      }

      // Store in batches
      const batchSize = options.batchSize || 50
      const batches = this.chunkArray(vectorPoints, batchSize)

      for (const batch of batches) {
        try {
          const results = await this.vectorStore.batchUpsert(batch, {
            wait: true,
            batchSize,
          })
          
          successful += batch.length
          vectorIds.push(...batch.map(p => p.id.toString()))
        } catch (error) {
          failed += batch.length
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          
          // Try to process individually to identify specific failures
          for (const point of batch) {
            try {
              await this.vectorStore.upsertPoint(
                point.id.toString(),
                point.vector,
                point.payload
              )
              successful++
              vectorIds.push(point.id.toString())
            } catch (pointError) {
              failed++
              errors.push({
                stage: 'storing',
                itemId: point.id.toString(),
                error: pointError instanceof Error ? pointError.message : 'Unknown error',
                recoverable: true,
              })
            }
          }
        }
      }
    } catch (error) {
      logger.error('Vector storage failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }

    return {
      successful,
      failed,
      duplicates,
      vectorIds,
      errors,
    }
  }

  /**
   * Create vector point from chunk
   */
  private createVectorPoint(
    chunk: DocumentChunk | AccountChunk | AssetChunk,
    embedding: number[],
    options: ChunkProcessingOptions
  ): VectorPoint {
    const metadata: VectorMetadata = {
      accountNumber: options.accountNumber || ('accountNumber' in chunk ? chunk.accountNumber : ''),
      scope: this.mapScopeToMetadataScope(options.scope),
      sourceType: this.getSourceType(chunk),
      contentHash: chunk.contentHash,
      tokenCount: chunk.tokenCount,
      createdAt: new Date().toISOString(),
      
      // Document-specific metadata
      documentId: 'documentId' in chunk ? chunk.documentId : undefined,
      documentName: 'documentName' in chunk ? chunk.documentName : undefined,
      documentType: 'documentType' in chunk ? chunk.documentType : undefined,
      chunkIndex: chunk.chunkIndex,
      totalChunks: chunk.totalChunks,
      
      // Asset-specific metadata
      ...('assetId' in chunk ? {
        assetId: chunk.assetId,
        assetType: chunk.assetType,
        category: chunk.category,
        tags: chunk.tags,
        contentCategory: chunk.contentCategory,
        relevanceScore: chunk.relevanceScore,
      } : {}),
      
      // Account-specific metadata
      ...('chunkType' in chunk ? {
        chunkType: chunk.chunkType,
        priority: chunk.priority,
        contextKeys: chunk.contextKeys,
      } : {}),
    }

    const pointId = this.generateVectorId(chunk.contentHash, metadata)

    return {
      id: pointId,
      vector: embedding,
      payload: metadata,
    }
  }

  /**
   * Map scope to vector metadata scope
   */
  private mapScopeToMetadataScope(scope: ChunkProcessingOptions['scope']): VectorMetadata['scope'] {
    const mapping = {
      'sales-assets': 'document' as const,
      'account-summary': 'account' as const,
      'global-context': 'document' as const,
    }
    return mapping[scope]
  }

  /**
   * Get source type from chunk
   */
  private getSourceType(chunk: DocumentChunk | AccountChunk | AssetChunk): string {
    if ('assetType' in chunk) return chunk.assetType
    if ('chunkType' in chunk) return `account_${chunk.chunkType}`
    if ('blockType' in chunk) return chunk.blockType
    return 'document'
  }

  /**
   * Generate vector ID
   */
  private generateVectorId(contentHash: string, metadata: VectorMetadata): string {
    const idContent = `${metadata.accountNumber}_${metadata.scope}_${contentHash}`
    return crypto.createHash('sha256').update(idContent).digest('hex')
  }

  /**
   * Generate job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Report progress to callback
   */
  private reportProgress(options: ChunkProcessingOptions, progress: ChunkProcessingProgress): void {
    if (options.onProgress) {
      options.onProgress(progress)
    }
  }

  /**
   * Chunk array into batches
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  /**
   * Get job status
   */
  getJob(jobId: string): BatchProcessingJob | undefined {
    return this.activeJobs.get(jobId)
  }

  /**
   * Get all active jobs
   */
  getActiveJobs(): BatchProcessingJob[] {
    return Array.from(this.activeJobs.values())
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId)
    if (job && job.status === 'running') {
      job.status = 'cancelled'
      job.endTime = new Date()
      return true
    }
    return false
  }

  /**
   * Clean up completed jobs
   */
  cleanupJobs(maxAge: number = 24 * 60 * 60 * 1000): number {
    const cutoff = new Date(Date.now() - maxAge)
    let cleaned = 0

    for (const [jobId, job] of this.activeJobs.entries()) {
      if (job.endTime && job.endTime < cutoff) {
        this.activeJobs.delete(jobId)
        cleaned++
      }
    }

    return cleaned
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    services: {
      embedding: any
      vectorStore: any
    }
    activeJobs: number
    details: any
  }> {
    try {
      const [embeddingHealth, vectorStoreHealth] = await Promise.all([
        this.embeddingService.healthCheck(),
        // Add vector store health check method
        Promise.resolve({ status: 'healthy', details: {} }),
      ])

      const allHealthy = [embeddingHealth.status].every(status => status === 'healthy')
      const someHealthy = [embeddingHealth.status].some(status => status === 'healthy')

      return {
        status: allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy',
        services: {
          embedding: embeddingHealth,
          vectorStore: vectorStoreHealth,
        },
        activeJobs: this.activeJobs.size,
        details: {
          runningJobs: Array.from(this.activeJobs.values()).filter(job => job.status === 'running').length,
          completedJobs: Array.from(this.activeJobs.values()).filter(job => job.status === 'completed').length,
          failedJobs: Array.from(this.activeJobs.values()).filter(job => job.status === 'failed').length,
        },
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        services: {
          embedding: { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' },
          vectorStore: { status: 'unknown' },
        },
        activeJobs: this.activeJobs.size,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }
    }
  }
}

// Singleton instance
let chunkBuilder: ChunkBuilderService | null = null

/**
 * Get singleton chunk builder instance
 */
export function getChunkBuilder(): ChunkBuilderService {
  if (!chunkBuilder) {
    chunkBuilder = new ChunkBuilderService()
  }
  return chunkBuilder
}