/**
 * Account Data Chunker Service
 * Specialized chunking for account summaries and account-specific data
 */

import { TextSplitterService, TextChunk, TextSplitterOptions, getTextSplitter } from './text-splitter'
import { logger } from '../../logger'
import crypto from 'crypto'

export interface AccountData {
  accountNumber: string
  accountName: string
  industry?: string
  companySize?: string
  gemStatus?: 'GEM' | 'Non-GEM'
  vendors?: string[]
  technologies?: Array<{
    name: string
    category: string
    confidence?: number
  }>
  contacts?: Array<{
    name: string
    title: string
    department?: string
    email?: string
  }>
  summary?: string
  notes?: string
  opportunities?: Array<{
    name: string
    value?: number
    stage?: string
    probability?: number
  }>
  lastUpdated?: Date
  source?: string
  [key: string]: any
}

export interface AccountChunk extends TextChunk {
  accountNumber: string
  accountName: string
  chunkId: string
  chunkType: 'summary' | 'contacts' | 'technologies' | 'opportunities' | 'notes' | 'general'
  priority: 'high' | 'medium' | 'low'
  gemStatus?: 'GEM' | 'Non-GEM'
  industry?: string
  companySize?: string
  contextKeys: string[]
  metadata: Record<string, any>
}

export interface AccountChunkingOptions extends TextSplitterOptions {
  includeContacts?: boolean
  includeTechnologies?: boolean
  includeOpportunities?: boolean
  prioritizeGEM?: boolean
  maxContactsPerChunk?: number
  maxTechnologiesPerChunk?: number
  preserveContext?: boolean
  contextPrefix?: string
}

export interface AccountChunkingResult {
  accountNumber: string
  accountName: string
  totalChunks: number
  chunkTypes: Record<string, number>
  chunks: AccountChunk[]
  processingTime: number
  errors: string[]
  warnings: string[]
}

export class AccountChunkerService {
  private textSplitter: TextSplitterService

  constructor(textSplitter?: TextSplitterService) {
    this.textSplitter = textSplitter || getTextSplitter()
  }

  /**
   * Process account data into optimized chunks for insight generation
   */
  async chunkAccountData(
    accountData: AccountData,
    options: AccountChunkingOptions = {}
  ): Promise<AccountChunkingResult> {
    const startTime = Date.now()
    
    try {
      logger.info('Starting account data chunking', {
        accountNumber: accountData.accountNumber,
        accountName: accountData.accountName,
        gemStatus: accountData.gemStatus,
        industry: accountData.industry,
      })

      const chunks: AccountChunk[] = []
      const errors: string[] = []
      const warnings: string[] = []
      const chunkTypes: Record<string, number> = {}

      // Process summary/notes first (highest priority)
      if (accountData.summary) {
        const summaryChunks = await this.chunkAccountSummary(accountData, options)
        chunks.push(...summaryChunks)
        this.updateChunkTypeCount(chunkTypes, 'summary', summaryChunks.length)
      }

      // Process opportunities (high priority for sales)
      if (accountData.opportunities && options.includeOpportunities !== false) {
        try {
          const opportunityChunks = await this.chunkOpportunities(accountData, options)
          chunks.push(...opportunityChunks)
          this.updateChunkTypeCount(chunkTypes, 'opportunities', opportunityChunks.length)
        } catch (error) {
          const errorMsg = `Failed to chunk opportunities: ${error instanceof Error ? error.message : 'Unknown error'}`
          errors.push(errorMsg)
          logger.warn('Opportunities chunking failed', { accountNumber: accountData.accountNumber, error: errorMsg })
        }
      }

      // Process technologies (medium priority)
      if (accountData.technologies && options.includeTechnologies !== false) {
        try {
          const technologyChunks = await this.chunkTechnologies(accountData, options)
          chunks.push(...technologyChunks)
          this.updateChunkTypeCount(chunkTypes, 'technologies', technologyChunks.length)
        } catch (error) {
          const errorMsg = `Failed to chunk technologies: ${error instanceof Error ? error.message : 'Unknown error'}`
          errors.push(errorMsg)
          logger.warn('Technologies chunking failed', { accountNumber: accountData.accountNumber, error: errorMsg })
        }
      }

      // Process contacts (medium priority)
      if (accountData.contacts && options.includeContacts !== false) {
        try {
          const contactChunks = await this.chunkContacts(accountData, options)
          chunks.push(...contactChunks)
          this.updateChunkTypeCount(chunkTypes, 'contacts', contactChunks.length)
        } catch (error) {
          const errorMsg = `Failed to chunk contacts: ${error instanceof Error ? error.message : 'Unknown error'}`
          errors.push(errorMsg)
          logger.warn('Contacts chunking failed', { accountNumber: accountData.accountNumber, error: errorMsg })
        }
      }

      // Process general notes/additional data
      if (accountData.notes) {
        const notesChunks = await this.chunkNotes(accountData, options)
        chunks.push(...notesChunks)
        this.updateChunkTypeCount(chunkTypes, 'notes', notesChunks.length)
      }

      // Update chunk indices and priorities
      this.updateChunkMetadata(chunks, accountData, options)

      const processingTime = Date.now() - startTime

      logger.info('Account data chunking completed', {
        accountNumber: accountData.accountNumber,
        accountName: accountData.accountName,
        totalChunks: chunks.length,
        chunkTypes,
        processingTime,
        errorsCount: errors.length,
        warningsCount: warnings.length,
      })

      return {
        accountNumber: accountData.accountNumber,
        accountName: accountData.accountName,
        totalChunks: chunks.length,
        chunkTypes,
        chunks,
        processingTime,
        errors,
        warnings,
      }
    } catch (error) {
      const errorMsg = `Account data chunking failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      logger.error('Account data chunking failed', {
        accountNumber: accountData.accountNumber,
        error: errorMsg,
      })
      throw new Error(errorMsg)
    }
  }

  /**
   * Chunk account summary with context preservation
   */
  private async chunkAccountSummary(
    accountData: AccountData,
    options: AccountChunkingOptions
  ): Promise<AccountChunk[]> {
    if (!accountData.summary) return []

    const contextPrefix = this.buildContextPrefix(accountData, options.contextPrefix)
    const fullText = `${contextPrefix}\n\nAccount Summary:\n${accountData.summary}`

    const textChunks = await this.textSplitter.splitText(fullText, {
      chunkSize: options.chunkSize || 400,
      chunkOverlap: options.chunkOverlap || 100,
      maxTokens: options.maxTokens || 512,
      preserveSentences: options.preserveSentences !== false,
    })

    return textChunks.map((chunk, index) => this.createAccountChunk(
      chunk,
      accountData,
      'summary',
      this.getGEMPriority(accountData, 'high'),
      ['account_summary', 'overview'],
      {
        chunkWithinSummary: index,
        totalSummaryChunks: textChunks.length,
        hasContext: !!contextPrefix,
      }
    ))
  }

  /**
   * Chunk opportunities data
   */
  private async chunkOpportunities(
    accountData: AccountData,
    options: AccountChunkingOptions
  ): Promise<AccountChunk[]> {
    if (!accountData.opportunities || accountData.opportunities.length === 0) return []

    const contextPrefix = this.buildContextPrefix(accountData, options.contextPrefix)
    const opportunitiesText = this.formatOpportunities(accountData.opportunities)
    const fullText = `${contextPrefix}\n\nOpportunities:\n${opportunitiesText}`

    const textChunks = await this.textSplitter.splitText(fullText, {
      chunkSize: options.chunkSize || 400,
      chunkOverlap: options.chunkOverlap || 50, // Less overlap for structured data
      maxTokens: options.maxTokens || 512,
      preserveSentences: false, // Structured data doesn't need sentence preservation
    })

    return textChunks.map((chunk, index) => this.createAccountChunk(
      chunk,
      accountData,
      'opportunities',
      this.getGEMPriority(accountData, 'high'),
      ['opportunities', 'sales', 'deals'],
      {
        chunkWithinOpportunities: index,
        totalOpportunityChunks: textChunks.length,
        opportunityCount: accountData.opportunities!.length,
      }
    ))
  }

  /**
   * Chunk technologies data
   */
  private async chunkTechnologies(
    accountData: AccountData,
    options: AccountChunkingOptions
  ): Promise<AccountChunk[]> {
    if (!accountData.technologies || accountData.technologies.length === 0) return []

    const contextPrefix = this.buildContextPrefix(accountData, options.contextPrefix)
    const technologiesText = this.formatTechnologies(accountData.technologies)
    const fullText = `${contextPrefix}\n\nTechnologies:\n${technologiesText}`

    const textChunks = await this.textSplitter.splitText(fullText, {
      chunkSize: options.chunkSize || 300, // Smaller chunks for tech data
      chunkOverlap: options.chunkOverlap || 30,
      maxTokens: options.maxTokens || 400,
      preserveSentences: false,
    })

    return textChunks.map((chunk, index) => this.createAccountChunk(
      chunk,
      accountData,
      'technologies',
      this.getGEMPriority(accountData, 'medium'),
      ['technologies', 'tech_stack', 'vendors'],
      {
        chunkWithinTechnologies: index,
        totalTechnologyChunks: textChunks.length,
        technologyCount: accountData.technologies!.length,
      }
    ))
  }

  /**
   * Chunk contacts data
   */
  private async chunkContacts(
    accountData: AccountData,
    options: AccountChunkingOptions
  ): Promise<AccountChunk[]> {
    if (!accountData.contacts || accountData.contacts.length === 0) return []

    const maxContactsPerChunk = options.maxContactsPerChunk || 5
    const contactGroups = this.groupContacts(accountData.contacts, maxContactsPerChunk)
    const chunks: AccountChunk[] = []

    for (let i = 0; i < contactGroups.length; i++) {
      const contactGroup = contactGroups[i]
      const contextPrefix = this.buildContextPrefix(accountData, options.contextPrefix)
      const contactsText = this.formatContacts(contactGroup)
      const fullText = `${contextPrefix}\n\nContacts:\n${contactsText}`

      const textChunks = await this.textSplitter.splitText(fullText, {
        chunkSize: options.chunkSize || 350,
        chunkOverlap: 0, // No overlap for contact chunks
        maxTokens: options.maxTokens || 450,
        preserveSentences: false,
      })

      const contactChunks = textChunks.map((chunk, chunkIndex) => this.createAccountChunk(
        chunk,
        accountData,
        'contacts',
        this.getGEMPriority(accountData, 'medium'),
        ['contacts', 'people', 'stakeholders'],
        {
          contactGroup: i,
          chunkWithinGroup: chunkIndex,
          totalContactGroups: contactGroups.length,
          contactsInChunk: contactGroup.length,
        }
      ))

      chunks.push(...contactChunks)
    }

    return chunks
  }

  /**
   * Chunk notes data
   */
  private async chunkNotes(
    accountData: AccountData,
    options: AccountChunkingOptions
  ): Promise<AccountChunk[]> {
    if (!accountData.notes) return []

    const contextPrefix = this.buildContextPrefix(accountData, options.contextPrefix)
    const fullText = `${contextPrefix}\n\nNotes:\n${accountData.notes}`

    const textChunks = await this.textSplitter.splitText(fullText, {
      chunkSize: options.chunkSize || 400,
      chunkOverlap: options.chunkOverlap || 80,
      maxTokens: options.maxTokens || 512,
      preserveSentences: options.preserveSentences !== false,
    })

    return textChunks.map((chunk, index) => this.createAccountChunk(
      chunk,
      accountData,
      'notes',
      this.getGEMPriority(accountData, 'low'),
      ['notes', 'additional_info'],
      {
        chunkWithinNotes: index,
        totalNotesChunks: textChunks.length,
      }
    ))
  }

  /**
   * Build context prefix for chunks
   */
  private buildContextPrefix(accountData: AccountData, customPrefix?: string): string {
    if (customPrefix) return customPrefix

    const parts = [
      `Account: ${accountData.accountName} (${accountData.accountNumber})`
    ]

    if (accountData.industry) parts.push(`Industry: ${accountData.industry}`)
    if (accountData.companySize) parts.push(`Company Size: ${accountData.companySize}`)
    if (accountData.gemStatus) parts.push(`Status: ${accountData.gemStatus}`)

    return parts.join(' | ')
  }

  /**
   * Format opportunities for text chunking
   */
  private formatOpportunities(opportunities: AccountData['opportunities']): string {
    if (!opportunities) return ''

    return opportunities.map(opp => {
      const parts = [`- ${opp.name}`]
      if (opp.value) parts.push(`Value: $${opp.value.toLocaleString()}`)
      if (opp.stage) parts.push(`Stage: ${opp.stage}`)
      if (opp.probability) parts.push(`Probability: ${opp.probability}%`)
      return parts.join(' | ')
    }).join('\n')
  }

  /**
   * Format technologies for text chunking
   */
  private formatTechnologies(technologies: AccountData['technologies']): string {
    if (!technologies) return ''

    const byCategory = technologies.reduce((acc, tech) => {
      const category = tech.category || 'Other'
      if (!acc[category]) acc[category] = []
      acc[category].push(tech)
      return acc
    }, {} as Record<string, typeof technologies>)

    return Object.entries(byCategory).map(([category, techs]) => {
      const techList = techs.map(tech => {
        const parts = [tech.name]
        if (tech.confidence) parts.push(`(${Math.round(tech.confidence * 100)}% confidence)`)
        return parts.join(' ')
      }).join(', ')
      
      return `${category}: ${techList}`
    }).join('\n')
  }

  /**
   * Format contacts for text chunking
   */
  private formatContacts(contacts: NonNullable<AccountData['contacts']>): string {
    return contacts.map(contact => {
      const parts = [`- ${contact.name}`]
      if (contact.title) parts.push(`Title: ${contact.title}`)
      if (contact.department) parts.push(`Department: ${contact.department}`)
      if (contact.email) parts.push(`Email: ${contact.email}`)
      return parts.join(' | ')
    }).join('\n')
  }

  /**
   * Group contacts for chunking
   */
  private groupContacts(
    contacts: NonNullable<AccountData['contacts']>,
    maxPerGroup: number
  ): Array<NonNullable<AccountData['contacts']>> {
    const groups: Array<NonNullable<AccountData['contacts']>> = []
    
    for (let i = 0; i < contacts.length; i += maxPerGroup) {
      groups.push(contacts.slice(i, i + maxPerGroup))
    }
    
    return groups
  }

  /**
   * Create an account chunk with proper metadata
   */
  private createAccountChunk(
    textChunk: TextChunk,
    accountData: AccountData,
    chunkType: AccountChunk['chunkType'],
    priority: AccountChunk['priority'],
    contextKeys: string[],
    additionalMetadata: Record<string, any> = {}
  ): AccountChunk {
    const chunkId = this.generateChunkId(
      accountData.accountNumber,
      chunkType,
      textChunk.contentHash
    )

    return {
      ...textChunk,
      accountNumber: accountData.accountNumber,
      accountName: accountData.accountName,
      chunkId,
      chunkType,
      priority,
      gemStatus: accountData.gemStatus,
      industry: accountData.industry,
      companySize: accountData.companySize,
      contextKeys,
      metadata: {
        source: accountData.source || 'account_data',
        lastUpdated: accountData.lastUpdated?.toISOString() || new Date().toISOString(),
        chunkType,
        priority,
        contextKeys,
        ...additionalMetadata,
      },
    }
  }

  /**
   * Get priority based on GEM status
   */
  private getGEMPriority(
    accountData: AccountData,
    basePriority: AccountChunk['priority']
  ): AccountChunk['priority'] {
    if (accountData.gemStatus === 'GEM') {
      return basePriority === 'low' ? 'medium' : 'high'
    }
    return basePriority
  }

  /**
   * Update chunk type counts
   */
  private updateChunkTypeCount(
    chunkTypes: Record<string, number>,
    type: string,
    count: number
  ): void {
    chunkTypes[type] = (chunkTypes[type] || 0) + count
  }

  /**
   * Update chunk metadata after processing
   */
  private updateChunkMetadata(
    chunks: AccountChunk[],
    accountData: AccountData,
    options: AccountChunkingOptions
  ): void {
    chunks.forEach((chunk, index) => {
      chunk.chunkIndex = index
      chunk.totalChunks = chunks.length
      
      // Add global context keys
      if (!chunk.contextKeys.includes(accountData.accountNumber)) {
        chunk.contextKeys.push(accountData.accountNumber)
      }
      
      if (accountData.industry && !chunk.contextKeys.includes(accountData.industry.toLowerCase())) {
        chunk.contextKeys.push(accountData.industry.toLowerCase())
      }
    })
  }

  /**
   * Generate unique chunk ID
   */
  private generateChunkId(
    accountNumber: string,
    chunkType: string,
    contentHash: string
  ): string {
    const idContent = `${accountNumber}_${chunkType}_${contentHash}`
    return crypto.createHash('md5').update(idContent).digest('hex')
  }

  /**
   * Validate account chunks
   */
  validateAccountChunks(chunks: AccountChunk[]): {
    valid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []

    for (const chunk of chunks) {
      // Check required fields
      if (!chunk.accountNumber) errors.push(`Chunk missing accountNumber: ${chunk.chunkId}`)
      if (!chunk.chunkId) errors.push(`Chunk missing chunkId`)
      if (!chunk.chunkType) errors.push(`Chunk missing chunkType: ${chunk.chunkId}`)
      
      // Check context keys
      if (!chunk.contextKeys.includes(chunk.accountNumber)) {
        warnings.push(`Chunk missing account context key: ${chunk.chunkId}`)
      }
      
      // Check token limits for account context
      if (chunk.tokenCount > 512) {
        warnings.push(`Account chunk exceeds token limit: ${chunk.chunkId} (${chunk.tokenCount} tokens)`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Get account chunking statistics
   */
  getAccountStats(accountData: AccountData): {
    hasBasicInfo: boolean
    hasContacts: boolean
    hasTechnologies: boolean
    hasOpportunities: boolean
    hasSummary: boolean
    hasNotes: boolean
    estimatedChunks: number
    isGEM: boolean
  } {
    return {
      hasBasicInfo: !!(accountData.accountNumber && accountData.accountName),
      hasContacts: !!(accountData.contacts && accountData.contacts.length > 0),
      hasTechnologies: !!(accountData.technologies && accountData.technologies.length > 0),
      hasOpportunities: !!(accountData.opportunities && accountData.opportunities.length > 0),
      hasSummary: !!accountData.summary,
      hasNotes: !!accountData.notes,
      estimatedChunks: this.estimateChunkCount(accountData),
      isGEM: accountData.gemStatus === 'GEM',
    }
  }

  /**
   * Estimate chunk count for account data
   */
  private estimateChunkCount(accountData: AccountData): number {
    let estimatedTokens = 0

    if (accountData.summary) {
      estimatedTokens += Math.ceil(accountData.summary.length / 4)
    }
    
    if (accountData.notes) {
      estimatedTokens += Math.ceil(accountData.notes.length / 4)
    }
    
    if (accountData.opportunities) {
      estimatedTokens += accountData.opportunities.length * 50 // Estimate per opportunity
    }
    
    if (accountData.technologies) {
      estimatedTokens += accountData.technologies.length * 30 // Estimate per technology
    }
    
    if (accountData.contacts) {
      estimatedTokens += accountData.contacts.length * 40 // Estimate per contact
    }

    // Estimate chunks based on 400 token average with 100 token overlap
    return Math.max(1, Math.ceil(estimatedTokens / 300))
  }
}

// Singleton instance
let accountChunker: AccountChunkerService | null = null

/**
 * Get singleton account chunker instance
 */
export function getAccountChunker(): AccountChunkerService {
  if (!accountChunker) {
    accountChunker = new AccountChunkerService()
  }
  return accountChunker
}