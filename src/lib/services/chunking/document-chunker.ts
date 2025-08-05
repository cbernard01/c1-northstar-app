/**
 * Document Chunker Service
 * Process parsed documents from file parsers and maintain document structure
 */

import { TParserResult, TParsedBlock } from '../parsers/file-parser.interface'
import { TextSplitterService, TextChunk, TextSplitterOptions, getTextSplitter } from './text-splitter'
import { logger } from '../../logger'
import crypto from 'crypto'

export interface DocumentChunk extends TextChunk {
  blockId: string
  documentId: string
  documentName: string
  documentType: string
  chunkIndex: number
  totalChunks: number
  blockType: 'text' | 'table' | 'list' | 'heading'
  pageNumber?: number
  slideNumber?: number
  lineNumber?: number
  title?: string
  rawContent: string
  metadata: Record<string, any>
}

export interface DocumentChunkingOptions extends TextSplitterOptions {
  documentId?: string
  documentName?: string
  documentType?: string
  preserveStructure?: boolean
  includeHeaders?: boolean
  mergeSmallBlocks?: boolean
  minBlockSize?: number
  maxBlockSize?: number
}

export interface DocumentChunkingResult {
  documentId: string
  documentName: string
  documentType: string
  totalBlocks: number
  totalChunks: number
  chunks: DocumentChunk[]
  processingTime: number
  errors: string[]
  warnings: string[]
}

export class DocumentChunkerService {
  private textSplitter: TextSplitterService

  constructor(textSplitter?: TextSplitterService) {
    this.textSplitter = textSplitter || getTextSplitter()
  }

  /**
   * Process a parsed document into chunks
   */
  async chunkDocument(
    parserResult: TParserResult,
    options: DocumentChunkingOptions = {}
  ): Promise<DocumentChunkingResult> {
    const startTime = Date.now()
    const documentId = options.documentId || this.generateDocumentId(parserResult.metadata.fileName)
    const documentName = options.documentName || parserResult.metadata.fileName
    const documentType = options.documentType || this.inferDocumentType(parserResult.metadata.fileType)

    try {
      logger.info('Starting document chunking', {
        documentId,
        documentName,
        documentType,
        totalBlocks: parserResult.blocks.length,
      })

      const chunks: DocumentChunk[] = []
      const errors: string[] = []
      const warnings: string[] = []

      // Process each block
      for (let i = 0; i < parserResult.blocks.length; i++) {
        const block = parserResult.blocks[i]
        
        try {
          const blockChunks = await this.chunkBlock(
            block,
            documentId,
            documentName,
            documentType,
            options
          )
          chunks.push(...blockChunks)
        } catch (error) {
          const errorMsg = `Failed to chunk block ${block.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          errors.push(errorMsg)
          logger.warn('Block chunking failed', {
            documentId,
            blockId: block.id,
            blockType: block.content.type,
            error: errorMsg,
          })
        }
      }

      // Merge small blocks if requested
      if (options.mergeSmallBlocks) {
        const mergedChunks = this.mergeSmallChunks(chunks, options)
        if (mergedChunks.length !== chunks.length) {
          warnings.push(`Merged ${chunks.length - mergedChunks.length} small chunks`)
        }
        chunks.splice(0, chunks.length, ...mergedChunks)
      }

      // Update chunk indices
      chunks.forEach((chunk, index) => {
        chunk.chunkIndex = index
        chunk.totalChunks = chunks.length
      })

      const processingTime = Date.now() - startTime

      logger.info('Document chunking completed', {
        documentId,
        documentName,
        totalBlocks: parserResult.blocks.length,
        totalChunks: chunks.length,
        processingTime,
        errorsCount: errors.length,
        warningsCount: warnings.length,
      })

      return {
        documentId,
        documentName,
        documentType,
        totalBlocks: parserResult.blocks.length,
        totalChunks: chunks.length,
        chunks,
        processingTime,
        errors,
        warnings,
      }
    } catch (error) {
      const errorMsg = `Document chunking failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      logger.error('Document chunking failed', {
        documentId,
        documentName,
        error: errorMsg,
      })
      throw new Error(errorMsg)
    }
  }

  /**
   * Chunk a single parsed block
   */
  private async chunkBlock(
    block: TParsedBlock,
    documentId: string,
    documentName: string,
    documentType: string,
    options: DocumentChunkingOptions
  ): Promise<DocumentChunk[]> {
    const blockContent = this.extractBlockContent(block)
    
    if (!blockContent.trim()) {
      return []
    }

    // Determine if block needs chunking
    const blockSize = blockContent.length
    const maxBlockSize = options.maxBlockSize || 2000

    let textChunks: TextChunk[]

    if (blockSize <= maxBlockSize && block.content.type !== 'text') {
      // Small non-text block, treat as single chunk
      textChunks = [{
        text: blockContent,
        tokenCount: this.textSplitter['countTokens'](blockContent),
        startIndex: 0,
        endIndex: blockContent.length - 1,
        sentenceCount: 1,
        contentHash: this.generateContentHash(blockContent),
      }]
    } else {
      // Large block or text block, split it
      const splitterOptions: TextSplitterOptions = {
        chunkSize: options.chunkSize || 400,
        chunkOverlap: options.chunkOverlap || 100,
        maxTokens: options.maxTokens || 512,
        minChunkSize: options.minChunkSize || 50,
        preserveSentences: options.preserveSentences !== false,
      }

      textChunks = await this.textSplitter.splitText(blockContent, splitterOptions)
    }

    // Convert text chunks to document chunks
    return textChunks.map((textChunk, index) => {
      const documentChunk: DocumentChunk = {
        ...textChunk,
        blockId: block.id,
        documentId,
        documentName,
        documentType,
        chunkIndex: index,
        totalChunks: textChunks.length,
        blockType: block.content.type,
        pageNumber: block.metadata.pageNumber,
        slideNumber: block.metadata.slideNumber,
        lineNumber: block.metadata.lineNumber,
        title: block.title || this.generateChunkTitle(block, index),
        rawContent: block.rawText || blockContent,
        metadata: {
          ...block.metadata,
          blockTitle: block.title,
          blockType: block.content.type,
          chunkWithinBlock: index,
          totalChunksInBlock: textChunks.length,
          confidence: block.metadata.confidence,
          source: block.metadata.source,
        },
      }

      return documentChunk
    })
  }

  /**
   * Extract content from a parsed block
   */
  private extractBlockContent(block: TParsedBlock): string {
    switch (block.content.type) {
      case 'text':
        return block.content.text

      case 'heading':
        return block.content.text

      case 'table':
        // Convert table to text representation
        const headers = block.content.headers.join(' | ')
        const rows = block.content.rows.map(row => row.join(' | ')).join('\n')
        return `${headers}\n${rows}`

      case 'list':
        // Convert list to text representation
        const prefix = block.content.ordered ? '1. ' : '• '
        return block.content.items.map((item, index) => {
          if (block.content.ordered) {
            return `${index + 1}. ${item}`
          }
          return `${prefix}${item}`
        }).join('\n')

      default:
        return block.rawText || ''
    }
  }

  /**
   * Merge small chunks with adjacent ones
   */
  private mergeSmallChunks(
    chunks: DocumentChunk[],
    options: DocumentChunkingOptions
  ): DocumentChunk[] {
    const minSize = options.minChunkSize || 50
    const maxSize = options.chunkSize || 400
    const mergedChunks: DocumentChunk[] = []

    let i = 0
    while (i < chunks.length) {
      const currentChunk = chunks[i]
      
      // If chunk is large enough, keep it as is
      if (currentChunk.text.length >= minSize) {
        mergedChunks.push(currentChunk)
        i++
        continue
      }

      // Try to merge with next chunk
      let merged = false
      if (i + 1 < chunks.length) {
        const nextChunk = chunks[i + 1]
        const combinedLength = currentChunk.text.length + nextChunk.text.length
        
        // Only merge if they're from the same document and block type
        if (combinedLength <= maxSize &&
            currentChunk.documentId === nextChunk.documentId &&
            currentChunk.blockType === nextChunk.blockType) {
          
          const mergedChunk = this.mergeChunks(currentChunk, nextChunk)
          mergedChunks.push(mergedChunk)
          i += 2 // Skip both chunks
          merged = true
        }
      }

      if (!merged) {
        // If we can't merge and chunk is too small, keep it anyway
        mergedChunks.push(currentChunk)
        i++
      }
    }

    return mergedChunks
  }

  /**
   * Merge two adjacent chunks
   */
  private mergeChunks(chunk1: DocumentChunk, chunk2: DocumentChunk): DocumentChunk {
    const mergedText = `${chunk1.text} ${chunk2.text}`
    const mergedRawContent = `${chunk1.rawContent} ${chunk2.rawContent}`
    
    return {
      ...chunk1,
      text: mergedText,
      tokenCount: this.textSplitter['countTokens'](mergedText),
      endIndex: chunk2.endIndex,
      sentenceCount: chunk1.sentenceCount + chunk2.sentenceCount,
      contentHash: this.generateContentHash(mergedText),
      rawContent: mergedRawContent,
      metadata: {
        ...chunk1.metadata,
        mergedWith: chunk2.blockId,
        merged: true,
      },
    }
  }

  /**
   * Generate a title for a chunk
   */
  private generateChunkTitle(block: TParsedBlock, chunkIndex: number): string {
    if (block.title) {
      return `${block.title} (Part ${chunkIndex + 1})`
    }

    switch (block.content.type) {
      case 'heading':
        return block.content.text
      case 'table':
        return `Table (Part ${chunkIndex + 1})`
      case 'list':
        return `List (Part ${chunkIndex + 1})`
      default:
        return `Text Block (Part ${chunkIndex + 1})`
    }
  }

  /**
   * Generate document ID from filename
   */
  private generateDocumentId(fileName: string): string {
    const cleanName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const timestamp = Date.now()
    const hash = crypto.createHash('md5').update(`${fileName}_${timestamp}`).digest('hex').substring(0, 8)
    return `doc_${cleanName}_${hash}`
  }

  /**
   * Infer document type from file type
   */
  private inferDocumentType(fileType: string): string {
    const typeMap: Record<string, string> = {
      'text/csv': 'csv',
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'text/plain': 'txt',
    }

    return typeMap[fileType] || 'unknown'
  }

  /**
   * Generate content hash for deduplication
   */
  private generateContentHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex')
  }

  /**
   * Validate document chunks
   */
  validateChunks(chunks: DocumentChunk[]): {
    valid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []

    for (const chunk of chunks) {
      // Check required fields
      if (!chunk.documentId) errors.push(`Chunk missing documentId: ${chunk.blockId}`)
      if (!chunk.blockId) errors.push(`Chunk missing blockId`)
      if (!chunk.text.trim()) errors.push(`Chunk has empty text: ${chunk.blockId}`)
      
      // Check token limits
      if (chunk.tokenCount > 512) {
        warnings.push(`Chunk exceeds token limit: ${chunk.blockId} (${chunk.tokenCount} tokens)`)
      }
      
      // Check content hash
      const expectedHash = this.generateContentHash(chunk.text)
      if (chunk.contentHash !== expectedHash) {
        errors.push(`Content hash mismatch: ${chunk.blockId}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Get chunking statistics for a document
   */
  async getChunkingStats(parserResult: TParserResult): Promise<{
    totalBlocks: number
    estimatedChunks: number
    totalCharacters: number
    estimatedTokens: number
    blockTypes: Record<string, number>
    avgBlockSize: number
  }> {
    const blockTypes: Record<string, number> = {}
    let totalCharacters = 0
    let estimatedTokens = 0

    for (const block of parserResult.blocks) {
      const content = this.extractBlockContent(block)
      totalCharacters += content.length
      estimatedTokens += this.textSplitter['countTokens'](content)
      
      blockTypes[block.content.type] = (blockTypes[block.content.type] || 0) + 1
    }

    const avgBlockSize = parserResult.blocks.length > 0 
      ? Math.round(totalCharacters / parserResult.blocks.length)
      : 0

    // Estimate chunks based on token count and overlap
    const avgChunkTokens = 400 // Average target chunk size in tokens
    const overlapTokens = 100 // Average overlap
    const estimatedChunks = Math.ceil(estimatedTokens / (avgChunkTokens - overlapTokens))

    return {
      totalBlocks: parserResult.blocks.length,
      estimatedChunks,
      totalCharacters,
      estimatedTokens,
      blockTypes,
      avgBlockSize,
    }
  }
}

// Singleton instance
let documentChunker: DocumentChunkerService | null = null

/**
 * Get singleton document chunker instance
 */
export function getDocumentChunker(): DocumentChunkerService {
  if (!documentChunker) {
    documentChunker = new DocumentChunkerService()
  }
  return documentChunker
}