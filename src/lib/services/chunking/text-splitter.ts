/**
 * Text Splitter Service
 * Recursive character text splitting with token awareness and sentence boundary detection
 */

import * as sbd from 'sbd'
import { encode } from 'gpt-tokenizer'
import { logger } from '../../logger'

export interface TextChunk {
  text: string
  tokenCount: number
  startIndex: number
  endIndex: number
  sentenceCount: number
  contentHash: string
}

export interface TextSplitterOptions {
  chunkSize?: number
  chunkOverlap?: number
  maxTokens?: number
  minChunkSize?: number
  preserveSentences?: boolean
  separators?: string[]
  keepSeparator?: boolean
}

export class TextSplitterService {
  private readonly defaultSeparators = [
    '\n\n',  // Double newline (paragraph breaks)
    '\n',    // Single newline
    '. ',    // Sentence endings
    '! ',    // Exclamation endings
    '? ',    // Question endings
    '; ',    // Semicolon
    ', ',    // Comma
    ' ',     // Space
    ''       // Character level (fallback)
  ]

  private readonly defaultOptions: Required<TextSplitterOptions> = {
    chunkSize: 400,
    chunkOverlap: 100,
    maxTokens: 512,
    minChunkSize: 50,
    preserveSentences: true,
    separators: this.defaultSeparators,
    keepSeparator: false,
  }

  /**
   * Split text into chunks with token awareness
   */
  async splitText(
    text: string,
    options: TextSplitterOptions = {}
  ): Promise<TextChunk[]> {
    const opts = { ...this.defaultOptions, ...options }
    
    if (!text || text.trim().length === 0) {
      return []
    }

    try {
      const startTime = Date.now()
      
      // Clean and normalize text
      const cleanText = this.cleanText(text)
      
      // Split into sentences if preserving sentence boundaries
      let chunks: TextChunk[]
      if (opts.preserveSentences) {
        chunks = await this.splitBySentences(cleanText, opts)
      } else {
        chunks = await this.recursiveSplit(cleanText, opts)
      }

      // Filter out chunks that are too small
      const filteredChunks = chunks.filter(chunk => 
        chunk.text.trim().length >= opts.minChunkSize
      )

      const processingTime = Date.now() - startTime
      
      logger.debug('Text splitting completed', {
        originalLength: text.length,
        cleanedLength: cleanText.length,
        totalChunks: filteredChunks.length,
        avgChunkSize: filteredChunks.length > 0 
          ? Math.round(filteredChunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / filteredChunks.length)
          : 0,
        avgTokenCount: filteredChunks.length > 0
          ? Math.round(filteredChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0) / filteredChunks.length)
          : 0,
        processingTime,
      })

      return filteredChunks
    } catch (error) {
      logger.error('Text splitting failed', {
        textLength: text.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw new Error(`Text splitting failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Split text by sentence boundaries using sbd library
   */
  private async splitBySentences(
    text: string,
    options: Required<TextSplitterOptions>
  ): Promise<TextChunk[]> {
    try {
      // Use sbd to detect sentence boundaries
      const sentences = sbd.sentences(text, {
        newline_boundaries: true,
        html_boundaries: false,
        sanitize: false,
        allowed_tags: false,
        preserve_whitespace: true,
      })

      if (sentences.length === 0) {
        return this.recursiveSplit(text, options)
      }

      const chunks: TextChunk[] = []
      let currentChunk = ''
      let currentStartIndex = 0
      let sentenceStartIndex = 0

      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i]
        const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence
        const tokenCount = this.countTokens(potentialChunk)

        // Check if adding this sentence would exceed limits
        if (tokenCount > options.maxTokens || potentialChunk.length > options.chunkSize) {
          // If we have accumulated content, create a chunk
          if (currentChunk.trim()) {
            const chunk = this.createChunk(
              currentChunk.trim(),
              currentStartIndex,
              sentenceStartIndex + currentChunk.length - 1,
              this.countSentences(currentChunk)
            )
            chunks.push(chunk)

            // Calculate overlap for next chunk
            const overlapText = this.getOverlapText(currentChunk, options.chunkOverlap)
            currentChunk = overlapText + (overlapText ? ' ' : '') + sentence
            currentStartIndex = Math.max(0, sentenceStartIndex - overlapText.length)
          } else {
            // Single sentence is too large, use recursive splitting
            const recursiveChunks = await this.recursiveSplit(sentence, options)
            chunks.push(...recursiveChunks)
            currentChunk = ''
            currentStartIndex = sentenceStartIndex + sentence.length
          }
        } else {
          // Add sentence to current chunk
          currentChunk = potentialChunk
          if (i === 0) {
            currentStartIndex = sentenceStartIndex
          }
        }

        sentenceStartIndex += sentence.length + 1 // +1 for space/separator
      }

      // Add remaining chunk
      if (currentChunk.trim()) {
        const chunk = this.createChunk(
          currentChunk.trim(),
          currentStartIndex,
          text.length - 1,
          this.countSentences(currentChunk)
        )
        chunks.push(chunk)
      }

      return chunks
    } catch (error) {
      logger.warn('Sentence-based splitting failed, falling back to recursive splitting', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return this.recursiveSplit(text, options)
    }
  }

  /**
   * Recursive text splitting using multiple separators
   */
  private async recursiveSplit(
    text: string,
    options: Required<TextSplitterOptions>
  ): Promise<TextChunk[]> {
    const chunks: TextChunk[] = []
    const texts = [text]

    while (texts.length > 0) {
      const currentText = texts.pop()!
      
      if (currentText.length <= options.chunkSize) {
        // Text is small enough, create a chunk
        if (currentText.trim()) {
          const chunk = this.createChunk(
            currentText.trim(),
            0, // Index will be recalculated later
            currentText.length - 1,
            this.countSentences(currentText)
          )
          chunks.push(chunk)
        }
        continue
      }

      // Try to split using separators
      let splitSuccessful = false
      
      for (const separator of options.separators) {
        if (separator === '') {
          // Character-level splitting as last resort
          const midpoint = Math.floor(currentText.length / 2)
          const firstHalf = currentText.substring(0, midpoint)
          const secondHalf = currentText.substring(midpoint)
          
          texts.push(secondHalf)
          texts.push(firstHalf)
          splitSuccessful = true
          break
        } else if (currentText.includes(separator)) {
          const parts = this.splitWithSeparator(currentText, separator, options.keepSeparator)
          
          // Add parts in reverse order so they're processed in correct order
          for (let i = parts.length - 1; i >= 0; i--) {
            if (parts[i].trim()) {
              texts.push(parts[i])
            }
          }
          splitSuccessful = true
          break
        }
      }

      if (!splitSuccessful) {
        // Force character-level split
        const midpoint = Math.floor(currentText.length / 2)
        const firstHalf = currentText.substring(0, midpoint)
        const secondHalf = currentText.substring(midpoint)
        
        texts.push(secondHalf)
        texts.push(firstHalf)
      }
    }

    // Apply overlap and merge adjacent chunks if needed
    return this.applyOverlap(chunks, options.chunkOverlap)
  }

  /**
   * Split text with a specific separator
   */
  private splitWithSeparator(
    text: string,
    separator: string,
    keepSeparator: boolean
  ): string[] {
    const parts = text.split(separator)
    
    if (!keepSeparator || separator === '') {
      return parts
    }

    // Add separator back to parts (except the last one)
    const result: string[] = []
    for (let i = 0; i < parts.length; i++) {
      if (i === parts.length - 1) {
        result.push(parts[i])
      } else {
        result.push(parts[i] + separator)
      }
    }
    
    return result
  }

  /**
   * Apply overlap between chunks
   */
  private applyOverlap(chunks: TextChunk[], overlapSize: number): TextChunk[] {
    if (chunks.length <= 1 || overlapSize <= 0) {
      return chunks
    }

    const overlappedChunks: TextChunk[] = []
    
    for (let i = 0; i < chunks.length; i++) {
      let chunkText = chunks[i].text
      
      // Add overlap from previous chunk
      if (i > 0 && overlapSize > 0) {
        const prevChunk = chunks[i - 1]
        const overlapText = this.getOverlapText(prevChunk.text, overlapSize)
        if (overlapText) {
          chunkText = overlapText + ' ' + chunkText
        }
      }

      overlappedChunks.push(this.createChunk(
        chunkText,
        chunks[i].startIndex,
        chunks[i].endIndex,
        this.countSentences(chunkText)
      ))
    }

    return overlappedChunks
  }

  /**
   * Get overlap text from the end of a chunk
   */
  private getOverlapText(text: string, overlapSize: number): string {
    if (overlapSize <= 0 || text.length <= overlapSize) {
      return ''
    }

    // Try to break at word boundaries
    const overlapText = text.substring(text.length - overlapSize)
    const firstSpaceIndex = overlapText.indexOf(' ')
    
    if (firstSpaceIndex > 0) {
      return overlapText.substring(firstSpaceIndex + 1)
    }
    
    return overlapText
  }

  /**
   * Clean and normalize text
   */
  private cleanText(text: string): string {
    return text
      // Normalize whitespace
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove excessive whitespace
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      // Trim
      .trim()
  }

  /**
   * Count tokens in text using gpt-tokenizer
   */
  private countTokens(text: string): number {
    try {
      return encode(text).length
    } catch (error) {
      // Fallback to character-based estimation
      return Math.ceil(text.length / 4)
    }
  }

  /**
   * Count sentences in text
   */
  private countSentences(text: string): number {
    try {
      const sentences = sbd.sentences(text, {
        newline_boundaries: false,
        html_boundaries: false,
        sanitize: false,
      })
      return sentences.length
    } catch (error) {
      // Fallback to simple sentence counting
      return (text.match(/[.!?]+/g) || []).length
    }
  }

  /**
   * Create a text chunk with metadata
   */
  private createChunk(
    text: string,
    startIndex: number,
    endIndex: number,
    sentenceCount: number
  ): TextChunk {
    const tokenCount = this.countTokens(text)
    const contentHash = this.generateContentHash(text)

    return {
      text,
      tokenCount,
      startIndex,
      endIndex,
      sentenceCount,
      contentHash,
    }
  }

  /**
   * Generate content hash for deduplication
   */
  private generateContentHash(content: string): string {
    const crypto = require('crypto')
    return crypto.createHash('md5').update(content).digest('hex')
  }

  /**
   * Validate chunk size and token limits
   */
  validateChunk(chunk: TextChunk, options: TextSplitterOptions = {}): boolean {
    const opts = { ...this.defaultOptions, ...options }
    
    return (
      chunk.text.length <= opts.chunkSize &&
      chunk.tokenCount <= opts.maxTokens &&
      chunk.text.trim().length >= opts.minChunkSize
    )
  }

  /**
   * Get splitting statistics for text
   */
  async getSplittingStats(text: string, options: TextSplitterOptions = {}): Promise<{
    originalLength: number
    estimatedTokens: number
    estimatedChunks: number
    avgChunkSize: number
    avgTokensPerChunk: number
  }> {
    const opts = { ...this.defaultOptions, ...options }
    const cleanText = this.cleanText(text)
    const totalTokens = this.countTokens(cleanText)
    
    const estimatedChunks = Math.ceil(totalTokens / (opts.maxTokens - opts.chunkOverlap))
    const avgChunkSize = Math.floor(cleanText.length / estimatedChunks)
    const avgTokensPerChunk = Math.floor(totalTokens / estimatedChunks)

    return {
      originalLength: text.length,
      estimatedTokens: totalTokens,
      estimatedChunks,
      avgChunkSize,
      avgTokensPerChunk,
    }
  }
}

// Singleton instance
let textSplitter: TextSplitterService | null = null

/**
 * Get singleton text splitter instance
 */
export function getTextSplitter(): TextSplitterService {
  if (!textSplitter) {
    textSplitter = new TextSplitterService()
  }
  return textSplitter
}