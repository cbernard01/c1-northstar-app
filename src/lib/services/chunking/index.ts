/**
 * Chunking Services - Main Export
 * Comprehensive document chunking services for the C1 Northstar Sales Intelligence Platform
 */

// Core chunking services
export {
  TextSplitterService,
  getTextSplitter,
  type TextChunk,
  type TextSplitterOptions,
} from './text-splitter'

export {
  DocumentChunkerService,
  getDocumentChunker,
  type DocumentChunk,
  type DocumentChunkingOptions,
  type DocumentChunkingResult,
} from './document-chunker'

export {
  AccountChunkerService,
  getAccountChunker,
  type AccountData,
  type AccountChunk,
  type AccountChunkingOptions,
  type AccountChunkingResult,
} from './account-chunker'

export {
  AssetChunkerService,
  getAssetChunker,
  type AssetMetadata,
  type AssetChunk,
  type AssetChunkingOptions,
  type AssetChunkingResult,
} from './asset-chunker'

export {
  ChunkBuilderService,
  getChunkBuilder,
  type ChunkProcessingOptions,
  type ChunkProcessingProgress,
  type ChunkProcessingError,
  type ChunkProcessingResult,
  type BatchProcessingJob,
} from './chunk-builder'

// Convenience class that provides unified access to all chunking services
export class ChunkingService {
  public readonly textSplitter: TextSplitterService
  public readonly documentChunker: DocumentChunkerService
  public readonly accountChunker: AccountChunkerService
  public readonly assetChunker: AssetChunkerService
  public readonly chunkBuilder: ChunkBuilderService

  constructor() {
    this.textSplitter = getTextSplitter()
    this.documentChunker = getDocumentChunker()
    this.accountChunker = getAccountChunker()
    this.assetChunker = getAssetChunker()
    this.chunkBuilder = getChunkBuilder()
  }

  /**
   * Process a document with automatic type detection and chunking
   */
  async processDocument(
    parserResult: any, // TParserResult
    options: {
      scope?: 'sales-assets' | 'account-summary' | 'global-context'
      accountNumber?: string
      assetMetadata?: Partial<AssetMetadata>
      generateEmbeddings?: boolean
      storeVectors?: boolean
    } = {}
  ) {
    const scope = options.scope || 'global-context'
    
    if (options.generateEmbeddings || options.storeVectors) {
      // Use chunk builder for full processing pipeline
      return await this.chunkBuilder.processDocument(parserResult, {
        scope,
        accountNumber: options.accountNumber,
        embeddingProvider: 'openai',
        skipDuplicates: true,
      })
    } else if (scope === 'sales-assets') {
      // Use asset chunker
      const assetMetadata = options.assetMetadata 
        ? { ...this.assetChunker.createAssetMetadata(parserResult), ...options.assetMetadata }
        : this.assetChunker.createAssetMetadata(parserResult)
      
      return await this.assetChunker.chunkAsset(parserResult, assetMetadata)
    } else {
      // Use document chunker
      return await this.documentChunker.chunkDocument(parserResult, {
        documentId: options.accountNumber ? `${options.accountNumber}_doc` : undefined,
      })
    }
  }

  /**
   * Process account data with chunking and optional vectorization
   */
  async processAccount(
    accountData: AccountData,
    options: {
      generateEmbeddings?: boolean
      storeVectors?: boolean
      includeContacts?: boolean
      includeTechnologies?: boolean
      includeOpportunities?: boolean
    } = {}
  ) {
    if (options.generateEmbeddings || options.storeVectors) {
      // Use chunk builder for full processing pipeline
      return await this.chunkBuilder.processAccount(accountData, {
        scope: 'account-summary',
        accountNumber: accountData.accountNumber,
        includeContacts: options.includeContacts,
        includeTechnologies: options.includeTechnologies,
        includeOpportunities: options.includeOpportunities,
        embeddingProvider: 'openai',
        skipDuplicates: true,
      })
    } else {
      // Use account chunker only
      return await this.accountChunker.chunkAccountData(accountData, {
        includeContacts: options.includeContacts,
        includeTechnologies: options.includeTechnologies,
        includeOpportunities: options.includeOpportunities,
      })
    }
  }

  /**
   * Process multiple items in batch
   */
  async processBatch(
    items: Array<{
      type: 'document'
      data: any // TParserResult
      options?: {
        scope?: 'sales-assets' | 'account-summary' | 'global-context'
        accountNumber?: string
        assetMetadata?: Partial<AssetMetadata>
      }
    } | {
      type: 'account'
      data: AccountData
      options?: {
        includeContacts?: boolean
        includeTechnologies?: boolean
        includeOpportunities?: boolean
      }
    }>,
    globalOptions: {
      concurrency?: number
      batchSize?: number
      embeddingProvider?: 'openai' | 'azure'
      onProgress?: (progress: ChunkProcessingProgress) => void
    } = {}
  ) {
    // Convert to chunk builder format
    const builderItems = items.map(item => ({
      type: item.type,
      data: item.data,
    }))

    return await this.chunkBuilder.processBatch(builderItems, {
      scope: 'global-context', // Default scope
      concurrency: globalOptions.concurrency,
      batchSize: globalOptions.batchSize,
      embeddingProvider: globalOptions.embeddingProvider,
      onProgress: globalOptions.onProgress,
    })
  }

  /**
   * Get comprehensive statistics for a document
   */
  async getDocumentStats(parserResult: any) {
    const [
      chunkingStats,
      splittingStats,
      assetStats,
    ] = await Promise.all([
      this.documentChunker.getChunkingStats(parserResult),
      this.textSplitter.getSplittingStats(
        parserResult.blocks.map((b: any) => b.rawText || '').join('\n\n')
      ),
      this.assetChunker.getAssetStats(parserResult, this.assetChunker.createAssetMetadata(parserResult)),
    ])

    return {
      chunking: chunkingStats,
      splitting: splittingStats,
      asset: assetStats,
      recommendations: this.generateProcessingRecommendations(chunkingStats, splittingStats, assetStats),
    }
  }

  /**
   * Get statistics for account data
   */
  getAccountStats(accountData: AccountData) {
    return this.accountChunker.getAccountStats(accountData)
  }

  /**
   * Generate processing recommendations based on statistics
   */
  private generateProcessingRecommendations(
    chunkingStats: any,
    splittingStats: any,
    assetStats: any
  ): string[] {
    const recommendations: string[] = []

    // Check document size
    if (splittingStats.estimatedChunks > 50) {
      recommendations.push('Large document detected - consider using smaller chunk sizes or processing in batches')
    }

    // Check complexity
    if (assetStats.complexity === 'high') {
      recommendations.push('Complex document structure - enable structure preservation and increase chunk overlap')
    }

    // Check content types
    if (assetStats.hasTables) {
      recommendations.push('Tables detected - consider specialized table processing')
    }

    if (chunkingStats.blockTypes.heading > 10) {
      recommendations.push('Many headings detected - enable header inclusion for better context')
    }

    // Check token usage
    if (splittingStats.avgTokensPerChunk > 400) {
      recommendations.push('Large average chunk size - consider reducing chunk size for better embedding quality')
    }

    return recommendations
  }

  /**
   * Validate configuration and setup
   */
  async validateSetup(): Promise<{
    valid: boolean
    issues: string[]
    warnings: string[]
  }> {
    const issues: string[] = []
    const warnings: string[] = []

    try {
      // Test text splitter
      const testText = 'This is a test sentence. This is another test sentence.'
      const chunks = await this.textSplitter.splitText(testText)
      if (chunks.length === 0) {
        issues.push('Text splitter is not working correctly')
      }

      // Test document chunker
      const testResult = {
        blocks: [
          {
            id: 'test',
            content: { type: 'text', text: testText },
            metadata: {},
            rawText: testText,
          }
        ],
        metadata: {
          fileName: 'test.txt',
          fileSize: 100,
          fileType: 'text/plain',
          totalBlocks: 1,
          processingTime: 100,
          errors: [],
          warnings: [],
        },
      }

      const docResult = await this.documentChunker.chunkDocument(testResult as any)
      if (docResult.chunks.length === 0) {
        issues.push('Document chunker is not working correctly')
      }

      // Test account chunker
      const testAccount: AccountData = {
        accountNumber: 'TEST001',
        accountName: 'Test Account',
        summary: 'This is a test account summary.',
      }

      const accountResult = await this.accountChunker.chunkAccountData(testAccount)
      if (accountResult.chunks.length === 0) {
        issues.push('Account chunker is not working correctly')
      }

      // Check chunk builder health
      const health = await this.chunkBuilder.getHealthStatus()
      if (health.status === 'unhealthy') {
        issues.push('Chunk builder services are unhealthy')
      } else if (health.status === 'degraded') {
        warnings.push('Some chunk builder services are degraded')
      }

    } catch (error) {
      issues.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
    }
  }

  /**
   * Get overall service health
   */
  async getServiceHealth() {
    return await this.chunkBuilder.getHealthStatus()
  }
}

// Singleton instance
let chunkingService: ChunkingService | null = null

/**
 * Get singleton chunking service instance
 */
export function getChunkingService(): ChunkingService {
  if (!chunkingService) {
    chunkingService = new ChunkingService()
  }
  return chunkingService
}

/**
 * Initialize chunking services
 */
export async function initializeChunkingServices(): Promise<ChunkingService> {
  const service = getChunkingService()
  
  // Validate setup
  const validation = await service.validateSetup()
  if (!validation.valid) {
    throw new Error(`Chunking services validation failed: ${validation.issues.join(', ')}`)
  }

  if (validation.warnings.length > 0) {
    console.warn('Chunking services warnings:', validation.warnings.join(', '))
  }

  return service
}