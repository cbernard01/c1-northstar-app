/**
 * Asset Document Chunker Service
 * Process sales assets and materials with specialized handling for different asset types
 */

import { DocumentChunkerService, DocumentChunk, DocumentChunkingOptions, getDocumentChunker } from './document-chunker'
import { TParserResult } from '../parsers/file-parser.interface'
import { logger } from '../../logger'
import crypto from 'crypto'

export interface AssetMetadata {
  assetId: string
  assetName: string
  assetType: 'case-study' | 'data-sheet' | 'whitepaper' | 'presentation' | 'brochure' | 'manual' | 'other'
  category: string
  tags: string[]
  targetAudience?: string[]
  industry?: string[]
  technologies?: string[]
  products?: string[]
  version?: string
  createdDate?: Date
  lastModified?: Date
  author?: string
  language?: string
  fileSize?: number
  pageCount?: number
  confidenceLevel?: 'high' | 'medium' | 'low'
  reviewStatus?: 'approved' | 'pending' | 'draft'
  accessLevel?: 'public' | 'internal' | 'confidential'
}

export interface AssetChunk extends DocumentChunk {
  assetId: string
  assetType: AssetMetadata['assetType']
  category: string
  tags: string[]
  targetAudience?: string[]
  industry?: string[]
  technologies?: string[]
  products?: string[]
  contentCategory: 'overview' | 'benefits' | 'features' | 'technical' | 'pricing' | 'contact' | 'other'
  relevanceScore: number
  keyPoints: string[]
  assetMetadata: AssetMetadata
}

export interface AssetChunkingOptions extends DocumentChunkingOptions {
  assetMetadata?: Partial<AssetMetadata>
  extractKeyPoints?: boolean
  categorizeContent?: boolean
  enhanceWithContext?: boolean
  targetAudience?: string[]
  filterByIndustry?: string[]
  minRelevanceScore?: number
  includeMetadataContext?: boolean
}

export interface AssetChunkingResult {
  assetId: string
  assetName: string
  assetType: AssetMetadata['assetType']
  category: string
  totalChunks: number
  contentCategories: Record<string, number>
  chunks: AssetChunk[]
  processingTime: number
  keyPoints: string[]
  errors: string[]
  warnings: string[]
}

export class AssetChunkerService {
  private documentChunker: DocumentChunkerService

  constructor(documentChunker?: DocumentChunkerService) {
    this.documentChunker = documentChunker || getDocumentChunker()
  }

  /**
   * Process sales asset documents into specialized chunks
   */
  async chunkAsset(
    parserResult: TParserResult,
    assetMetadata: AssetMetadata,
    options: AssetChunkingOptions = {}
  ): Promise<AssetChunkingResult> {
    const startTime = Date.now()

    try {
      logger.info('Starting asset document chunking', {
        assetId: assetMetadata.assetId,
        assetName: assetMetadata.assetName,
        assetType: assetMetadata.assetType,
        category: assetMetadata.category,
        totalBlocks: parserResult.blocks.length,
      })

      // First, get document chunks using the base document chunker
      const documentResult = await this.documentChunker.chunkDocument(parserResult, {
        ...options,
        documentId: assetMetadata.assetId,
        documentName: assetMetadata.assetName,
        documentType: assetMetadata.assetType,
      })

      const errors: string[] = [...documentResult.errors]
      const warnings: string[] = [...documentResult.warnings]
      const keyPoints: string[] = []
      const contentCategories: Record<string, number> = {}

      // Convert document chunks to asset chunks with enhanced metadata
      const assetChunks: AssetChunk[] = []

      for (const docChunk of documentResult.chunks) {
        try {
          const assetChunk = await this.enhanceDocumentChunk(
            docChunk,
            assetMetadata,
            options
          )
          
          assetChunks.push(assetChunk)
          
          // Update content category counts
          const category = assetChunk.contentCategory
          contentCategories[category] = (contentCategories[category] || 0) + 1
          
          // Collect key points
          keyPoints.push(...assetChunk.keyPoints)
        } catch (error) {
          const errorMsg = `Failed to enhance chunk ${docChunk.blockId}: ${error instanceof Error ? error.message : 'Unknown error'}`
          errors.push(errorMsg)
          logger.warn('Asset chunk enhancement failed', {
            assetId: assetMetadata.assetId,
            blockId: docChunk.blockId,
            error: errorMsg,
          })
        }
      }

      // Filter chunks by relevance if specified
      const filteredChunks = this.filterByRelevance(assetChunks, options.minRelevanceScore || 0)
      if (filteredChunks.length !== assetChunks.length) {
        warnings.push(`Filtered out ${assetChunks.length - filteredChunks.length} chunks with low relevance`)
      }

      // Deduplicate key points
      const uniqueKeyPoints = Array.from(new Set(keyPoints))

      const processingTime = Date.now() - startTime

      logger.info('Asset document chunking completed', {
        assetId: assetMetadata.assetId,
        assetName: assetMetadata.assetName,
        totalChunks: filteredChunks.length,
        contentCategories,
        keyPointsCount: uniqueKeyPoints.length,
        processingTime,
        errorsCount: errors.length,
        warningsCount: warnings.length,
      })

      return {
        assetId: assetMetadata.assetId,
        assetName: assetMetadata.assetName,
        assetType: assetMetadata.assetType,
        category: assetMetadata.category,
        totalChunks: filteredChunks.length,
        contentCategories,
        chunks: filteredChunks,
        processingTime,
        keyPoints: uniqueKeyPoints,
        errors,
        warnings,
      }
    } catch (error) {
      const errorMsg = `Asset chunking failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      logger.error('Asset document chunking failed', {
        assetId: assetMetadata.assetId,
        error: errorMsg,
      })
      throw new Error(errorMsg)
    }
  }

  /**
   * Enhance a document chunk with asset-specific metadata and analysis
   */
  private async enhanceDocumentChunk(
    docChunk: DocumentChunk,
    assetMetadata: AssetMetadata,
    options: AssetChunkingOptions
  ): Promise<AssetChunk> {
    // Categorize content
    const contentCategory = this.categorizeContent(docChunk.text, assetMetadata.assetType)
    
    // Calculate relevance score
    const relevanceScore = this.calculateRelevanceScore(docChunk, assetMetadata, options)
    
    // Extract key points
    const keyPoints = options.extractKeyPoints !== false 
      ? this.extractKeyPoints(docChunk.text, contentCategory)
      : []

    // Build enhanced metadata context
    const metadataContext = options.includeMetadataContext !== false
      ? this.buildMetadataContext(assetMetadata)
      : ''

    // Enhance text with context if requested
    let enhancedText = docChunk.text
    if (options.enhanceWithContext && metadataContext) {
      enhancedText = `${metadataContext}\n\n${docChunk.text}`
    }

    const assetChunk: AssetChunk = {
      ...docChunk,
      text: enhancedText,
      tokenCount: this.estimateTokenCount(enhancedText),
      contentHash: this.generateContentHash(enhancedText),
      assetId: assetMetadata.assetId,
      assetType: assetMetadata.assetType,
      category: assetMetadata.category,
      tags: assetMetadata.tags || [],
      targetAudience: assetMetadata.targetAudience,
      industry: assetMetadata.industry,
      technologies: assetMetadata.technologies,
      products: assetMetadata.products,
      contentCategory,
      relevanceScore,
      keyPoints,
      assetMetadata,
      metadata: {
        ...docChunk.metadata,
        assetType: assetMetadata.assetType,
        category: assetMetadata.category,
        contentCategory,
        relevanceScore,
        keyPointsCount: keyPoints.length,
        hasMetadataContext: !!metadataContext,
        author: assetMetadata.author,
        version: assetMetadata.version,
        accessLevel: assetMetadata.accessLevel,
        reviewStatus: assetMetadata.reviewStatus,
        confidenceLevel: assetMetadata.confidenceLevel,
      },
    }

    return assetChunk
  }

  /**
   * Categorize content based on text analysis and asset type
   */
  private categorizeContent(
    text: string,
    assetType: AssetMetadata['assetType']
  ): AssetChunk['contentCategory'] {
    const lowerText = text.toLowerCase()

    // Asset-type specific patterns
    const patterns = {
      overview: [
        'overview', 'introduction', 'summary', 'about', 'what is',
        'executive summary', 'key highlights', 'at a glance'
      ],
      benefits: [
        'benefits', 'advantages', 'value', 'roi', 'return on investment',
        'why choose', 'key benefits', 'value proposition'
      ],
      features: [
        'features', 'capabilities', 'functionality', 'what it does',
        'key features', 'feature set', 'specifications'
      ],
      technical: [
        'technical', 'architecture', 'implementation', 'integration',
        'api', 'system requirements', 'specifications', 'how it works'
      ],
      pricing: [
        'pricing', 'cost', 'price', 'packages', 'plans', 'subscription',
        'license', 'pricing model', 'investment'
      ],
      contact: [
        'contact', 'support', 'help', 'sales', 'phone', 'email',
        'reach out', 'get in touch', 'learn more'
      ],
    }

    // Check patterns with weights based on asset type
    const scores: Record<string, number> = {}
    
    for (const [category, keywords] of Object.entries(patterns)) {
      scores[category] = 0
      
      for (const keyword of keywords) {
        const matches = (lowerText.match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length
        scores[category] += matches
      }
      
      // Apply asset type weights
      if (assetType === 'data-sheet' && category === 'technical') {
        scores[category] *= 1.5
      } else if (assetType === 'case-study' && category === 'benefits') {
        scores[category] *= 1.5
      } else if (assetType === 'presentation' && category === 'overview') {
        scores[category] *= 1.3
      }
    }

    // Find highest scoring category
    const maxScore = Math.max(...Object.values(scores))
    if (maxScore === 0) return 'other'

    const topCategory = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0]
    return (topCategory as AssetChunk['contentCategory']) || 'other'
  }

  /**
   * Calculate relevance score for a chunk
   */
  private calculateRelevanceScore(
    docChunk: DocumentChunk,
    assetMetadata: AssetMetadata,
    options: AssetChunkingOptions
  ): number {
    let score = 0.5 // Base score

    const lowerText = docChunk.text.toLowerCase()

    // Industry relevance
    if (options.filterByIndustry && assetMetadata.industry) {
      const industryMatch = assetMetadata.industry.some(industry =>
        options.filterByIndustry!.includes(industry)
      )
      if (industryMatch) score += 0.2
    }

    // Target audience relevance
    if (options.targetAudience && assetMetadata.targetAudience) {
      const audienceMatch = assetMetadata.targetAudience.some(audience =>
        options.targetAudience!.includes(audience)
      )
      if (audienceMatch) score += 0.15
    }

    // Technology relevance
    if (assetMetadata.technologies) {
      const techMentions = assetMetadata.technologies.filter(tech =>
        lowerText.includes(tech.toLowerCase())
      ).length
      score += Math.min(techMentions * 0.05, 0.15)
    }

    // Product relevance
    if (assetMetadata.products) {
      const productMentions = assetMetadata.products.filter(product =>
        lowerText.includes(product.toLowerCase())
      ).length
      score += Math.min(productMentions * 0.05, 0.15)
    }

    // Content category relevance (higher score for overview and benefits)
    const contentCategory = this.categorizeContent(docChunk.text, assetMetadata.assetType)
    if (contentCategory === 'overview' || contentCategory === 'benefits') {
      score += 0.1
    }

    // Block type relevance (headings are more relevant)
    if (docChunk.blockType === 'heading') {
      score += 0.1
    }

    // Confidence level from parser
    if (docChunk.metadata.confidence) {
      score += docChunk.metadata.confidence * 0.1
    }

    return Math.min(Math.max(score, 0), 1) // Clamp between 0 and 1
  }

  /**
   * Extract key points from text
   */
  private extractKeyPoints(
    text: string,
    contentCategory: AssetChunk['contentCategory']
  ): string[] {
    const keyPoints: string[] = []
    
    // Extract bullet points
    const bulletPatterns = [
      /^[•·\-*]\s+(.+)$/gm,
      /^\d+\.\s+(.+)$/gm,
      /^[a-zA-Z]\.\s+(.+)$/gm,
    ]

    for (const pattern of bulletPatterns) {
      const matches = text.match(pattern)
      if (matches) {
        keyPoints.push(...matches.map(match => match.replace(/^[•·\-*\d+\.a-zA-Z\.]\s+/, '').trim()))
      }
    }

    // Extract sentences with key indicators based on content category
    const keyIndicators = {
      overview: ['key', 'main', 'primary', 'essential', 'important'],
      benefits: ['benefit', 'advantage', 'improve', 'increase', 'reduce', 'save'],
      features: ['feature', 'capability', 'function', 'enable', 'support'],
      technical: ['architecture', 'system', 'technology', 'platform', 'integration'],
      pricing: ['price', 'cost', 'investment', 'subscription', 'license'],
      contact: ['contact', 'support', 'sales', 'help'],
      other: ['important', 'key', 'significant'],
    }

    const indicators = keyIndicators[contentCategory] || keyIndicators.other
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20)

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase()
      if (indicators.some(indicator => lowerSentence.includes(indicator))) {
        keyPoints.push(sentence.trim())
      }
    }

    // Deduplicate and limit
    const uniqueKeyPoints = Array.from(new Set(keyPoints))
    return uniqueKeyPoints.slice(0, 5) // Limit to top 5 key points
  }

  /**
   * Build metadata context string
   */
  private buildMetadataContext(assetMetadata: AssetMetadata): string {
    const parts = [
      `Asset: ${assetMetadata.assetName}`,
      `Type: ${assetMetadata.assetType}`,
      `Category: ${assetMetadata.category}`,
    ]

    if (assetMetadata.industry && assetMetadata.industry.length > 0) {
      parts.push(`Industry: ${assetMetadata.industry.join(', ')}`)
    }

    if (assetMetadata.targetAudience && assetMetadata.targetAudience.length > 0) {
      parts.push(`Audience: ${assetMetadata.targetAudience.join(', ')}`)
    }

    if (assetMetadata.technologies && assetMetadata.technologies.length > 0) {
      parts.push(`Technologies: ${assetMetadata.technologies.join(', ')}`)
    }

    if (assetMetadata.products && assetMetadata.products.length > 0) {
      parts.push(`Products: ${assetMetadata.products.join(', ')}`)
    }

    return parts.join(' | ')
  }

  /**
   * Filter chunks by relevance score
   */
  private filterByRelevance(chunks: AssetChunk[], minRelevanceScore: number): AssetChunk[] {
    if (minRelevanceScore <= 0) return chunks
    return chunks.filter(chunk => chunk.relevanceScore >= minRelevanceScore)
  }

  /**
   * Infer asset type from document metadata
   */
  inferAssetType(parserResult: TParserResult): AssetMetadata['assetType'] {
    const fileName = parserResult.metadata.fileName.toLowerCase()
    const fileType = parserResult.metadata.fileType

    // Check filename patterns
    if (fileName.includes('case') && fileName.includes('study')) return 'case-study'
    if (fileName.includes('datasheet') || fileName.includes('data-sheet')) return 'data-sheet'
    if (fileName.includes('whitepaper') || fileName.includes('white-paper')) return 'whitepaper'
    if (fileName.includes('brochure')) return 'brochure'
    if (fileName.includes('manual') || fileName.includes('guide')) return 'manual'

    // Check file type
    if (fileType.includes('presentation')) return 'presentation'
    if (fileType.includes('pdf')) return 'whitepaper' // Default for PDFs
    if (fileType.includes('word')) return 'brochure' // Default for Word docs

    return 'other'
  }

  /**
   * Create asset metadata from parser result
   */
  createAssetMetadata(
    parserResult: TParserResult,
    customMetadata: Partial<AssetMetadata> = {}
  ): AssetMetadata {
    const fileName = parserResult.metadata.fileName
    const assetId = customMetadata.assetId || this.generateAssetId(fileName)
    const assetType = customMetadata.assetType || this.inferAssetType(parserResult)

    return {
      assetId,
      assetName: customMetadata.assetName || fileName,
      assetType,
      category: customMetadata.category || 'general',
      tags: customMetadata.tags || [],
      targetAudience: customMetadata.targetAudience,
      industry: customMetadata.industry,
      technologies: customMetadata.technologies,
      products: customMetadata.products,
      version: customMetadata.version,
      createdDate: customMetadata.createdDate || new Date(),
      lastModified: customMetadata.lastModified || new Date(),
      author: customMetadata.author,
      language: customMetadata.language || 'en',
      fileSize: parserResult.metadata.fileSize,
      pageCount: this.estimatePageCount(parserResult),
      confidenceLevel: customMetadata.confidenceLevel || 'medium',
      reviewStatus: customMetadata.reviewStatus || 'draft',
      accessLevel: customMetadata.accessLevel || 'internal',
    }
  }

  /**
   * Generate asset ID from filename
   */
  private generateAssetId(fileName: string): string {
    const cleanName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const timestamp = Date.now()
    const hash = crypto.createHash('md5').update(`${fileName}_${timestamp}`).digest('hex').substring(0, 8)
    return `asset_${cleanName}_${hash}`
  }

  /**
   * Estimate page count from parser result
   */
  private estimatePageCount(parserResult: TParserResult): number {
    const pagesFromMetadata = parserResult.blocks
      .map(block => block.metadata.pageNumber)
      .filter(page => page !== undefined)
    
    if (pagesFromMetadata.length > 0) {
      return Math.max(...pagesFromMetadata as number[])
    }

    // Estimate based on content length
    const totalLength = parserResult.blocks.reduce((sum, block) => 
      sum + (block.rawText?.length || 0), 0
    )
    
    return Math.max(1, Math.ceil(totalLength / 3000)) // Rough estimate
  }

  /**
   * Estimate token count (fallback method)
   */
  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4)
  }

  /**
   * Generate content hash
   */
  private generateContentHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex')
  }

  /**
   * Validate asset chunks
   */
  validateAssetChunks(chunks: AssetChunk[]): {
    valid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []

    for (const chunk of chunks) {
      // Check required asset fields
      if (!chunk.assetId) errors.push(`Chunk missing assetId: ${chunk.chunkId}`)
      if (!chunk.assetType) errors.push(`Chunk missing assetType: ${chunk.chunkId}`)
      if (!chunk.category) errors.push(`Chunk missing category: ${chunk.chunkId}`)
      
      // Check relevance score
      if (chunk.relevanceScore < 0 || chunk.relevanceScore > 1) {
        warnings.push(`Invalid relevance score: ${chunk.chunkId} (${chunk.relevanceScore})`)
      }
      
      // Check key points
      if (chunk.keyPoints.length === 0) {
        warnings.push(`No key points extracted: ${chunk.chunkId}`)
      }
      
      // Check content category
      const validCategories = ['overview', 'benefits', 'features', 'technical', 'pricing', 'contact', 'other']
      if (!validCategories.includes(chunk.contentCategory)) {
        warnings.push(`Invalid content category: ${chunk.chunkId} (${chunk.contentCategory})`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Get asset chunking statistics
   */
  getAssetStats(parserResult: TParserResult, assetMetadata: AssetMetadata): {
    estimatedChunks: number
    contentTypes: Record<string, number>
    hasStructuredContent: boolean
    hasImages: boolean
    hasTables: boolean
    complexity: 'low' | 'medium' | 'high'
  } {
    const blockTypes: Record<string, number> = {}
    let totalLength = 0

    for (const block of parserResult.blocks) {
      blockTypes[block.content.type] = (blockTypes[block.content.type] || 0) + 1
      totalLength += block.rawText?.length || 0
    }

    const hasStructuredContent = (blockTypes.table || 0) > 0 || (blockTypes.list || 0) > 0
    const hasTables = (blockTypes.table || 0) > 0
    const hasImages = false // Would need to be detected by parsers
    
    const estimatedChunks = Math.max(1, Math.ceil(totalLength / 1500)) // Rough estimate

    // Determine complexity
    let complexity: 'low' | 'medium' | 'high' = 'low'
    if (hasStructuredContent && Object.keys(blockTypes).length > 2) {
      complexity = 'medium'
    }
    if (hasTables && (blockTypes.heading || 0) > 5 && totalLength > 10000) {
      complexity = 'high'
    }

    return {
      estimatedChunks,
      contentTypes: blockTypes,
      hasStructuredContent,
      hasImages,
      hasTables,
      complexity,
    }
  }
}

// Singleton instance
let assetChunker: AssetChunkerService | null = null

/**
 * Get singleton asset chunker instance
 */
export function getAssetChunker(): AssetChunkerService {
  if (!assetChunker) {
    assetChunker = new AssetChunkerService()
  }
  return assetChunker
}