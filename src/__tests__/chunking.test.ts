/**
 * Chunking Services Tests
 * Comprehensive tests for all chunking functionality
 */

import {
  getTextSplitter,
  getDocumentChunker,
  getAccountChunker,
  getAssetChunker,
  getChunkBuilder,
  getChunkingService,
  type AccountData,
  type AssetMetadata,
} from '../lib/services/chunking'
import { TParserResult } from '../lib/services/parsers/file-parser.interface'

// Mock dependencies
jest.mock('../lib/ai/embedding-service', () => ({
  EmbeddingService: jest.fn().mockImplementation(() => ({
    generateEmbedding: jest.fn().mockResolvedValue({
      embedding: new Array(1536).fill(0.1),
      usage: { promptTokens: 10, totalTokens: 10 },
    }),
    generateBatchEmbeddings: jest.fn().mockImplementation((texts: string[]) =>
      Promise.resolve(texts.map(() => ({
        embedding: new Array(1536).fill(0.1),
        usage: { promptTokens: 10, totalTokens: 10 },
      })))
    ),
    healthCheck: jest.fn().mockResolvedValue({ status: 'healthy', details: {} }),
  })),
}))

jest.mock('../lib/services/vector/vector-store', () => ({
  getVectorStore: jest.fn().mockReturnValue({
    batchUpsert: jest.fn().mockResolvedValue([
      { operationId: 1, status: 'completed', result: {} },
    ]),
    upsertPoint: jest.fn().mockResolvedValue(undefined),
    createVectorPoint: jest.fn().mockImplementation((content, vector, metadata) => ({
      id: 'test-id',
      vector,
      payload: metadata,
    })),
    generateContentHash: jest.fn().mockReturnValue('test-hash'),
  }),
}))

jest.mock('../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

describe('Text Splitter Service', () => {
  const textSplitter = getTextSplitter()

  const sampleText = `
    The C1 Northstar Sales Intelligence Platform is a comprehensive solution designed to empower sales teams.
    
    The platform integrates with existing CRM systems and provides real-time account intelligence.
    
    Key features include automated account research, intelligent lead scoring, and dynamic sales asset recommendations.
  `

  test('should split text into chunks', async () => {
    const chunks = await textSplitter.splitText(sampleText)
    
    expect(chunks).toBeDefined()
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0]).toHaveProperty('text')
    expect(chunks[0]).toHaveProperty('tokenCount')
    expect(chunks[0]).toHaveProperty('contentHash')
  })

  test('should respect chunk size limits', async () => {
    const chunks = await textSplitter.splitText(sampleText, {
      chunkSize: 100,
      maxTokens: 50,
    })

    chunks.forEach(chunk => {
      expect(chunk.text.length).toBeLessThanOrEqual(100)
      expect(chunk.tokenCount).toBeLessThanOrEqual(50)
    })
  })

  test('should preserve sentences when requested', async () => {
    const chunks = await textSplitter.splitText(sampleText, {
      preserveSentences: true,
    })

    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0].sentenceCount).toBeGreaterThan(0)
  })

  test('should handle empty text', async () => {
    const chunks = await textSplitter.splitText('')
    expect(chunks).toEqual([])
  })

  test('should provide splitting statistics', async () => {
    const stats = await textSplitter.getSplittingStats(sampleText)
    
    expect(stats).toHaveProperty('originalLength')
    expect(stats).toHaveProperty('estimatedTokens')
    expect(stats).toHaveProperty('estimatedChunks')
    expect(stats.originalLength).toBeGreaterThan(0)
  })
})

describe('Document Chunker Service', () => {
  const documentChunker = getDocumentChunker()

  const sampleParserResult: TParserResult = {
    blocks: [
      {
        id: 'heading_1',
        title: 'Executive Summary',
        content: {
          type: 'heading',
          text: 'Executive Summary',
          level: 1,
        },
        metadata: {
          pageNumber: 1,
        },
        rawText: 'Executive Summary',
      },
      {
        id: 'text_1',
        content: {
          type: 'text',
          text: 'This is a comprehensive analysis of the enterprise software market. Our research indicates significant opportunities for growth in the healthcare vertical.',
        },
        metadata: {
          pageNumber: 1,
        },
        rawText: 'This is a comprehensive analysis of the enterprise software market. Our research indicates significant opportunities for growth in the healthcare vertical.',
      },
    ],
    metadata: {
      fileName: 'test-document.pdf',
      fileSize: 1024,
      fileType: 'application/pdf',
      totalBlocks: 2,
      processingTime: 1000,
      errors: [],
      warnings: [],
    },
  }

  test('should chunk document blocks', async () => {
    const result = await documentChunker.chunkDocument(sampleParserResult)
    
    expect(result).toHaveProperty('documentName', 'test-document.pdf')
    expect(result).toHaveProperty('totalBlocks', 2)
    expect(result).toHaveProperty('chunks')
    expect(result.chunks.length).toBeGreaterThan(0)
    
    result.chunks.forEach(chunk => {
      expect(chunk).toHaveProperty('documentId')
      expect(chunk).toHaveProperty('blockType')
      expect(chunk).toHaveProperty('text')
      expect(chunk).toHaveProperty('tokenCount')
    })
  })

  test('should preserve document structure', async () => {
    const result = await documentChunker.chunkDocument(sampleParserResult, {
      preserveStructure: true,
      includeHeaders: true,
    })

    const headingChunk = result.chunks.find(chunk => chunk.blockType === 'heading')
    expect(headingChunk).toBeDefined()
    expect(headingChunk?.title).toBe('Executive Summary')
  })

  test('should handle table blocks', async () => {
    const tableResult: TParserResult = {
      ...sampleParserResult,
      blocks: [
        {
          id: 'table_1',
          content: {
            type: 'table',
            headers: ['Product', 'Revenue', 'Growth'],
            rows: [
              ['Product A', '$1M', '10%'],
              ['Product B', '$2M', '15%'],
            ],
          },
          metadata: {},
          rawText: 'Product\tRevenue\tGrowth\nProduct A\t$1M\t10%\nProduct B\t$2M\t15%',
        },
      ],
    }

    const result = await documentChunker.chunkDocument(tableResult)
    expect(result.chunks.length).toBeGreaterThan(0)
    
    const tableChunk = result.chunks.find(chunk => chunk.blockType === 'table')
    expect(tableChunk).toBeDefined()
    expect(tableChunk?.text).toContain('Product')
    expect(tableChunk?.text).toContain('Revenue')
  })

  test('should get chunking statistics', async () => {
    const stats = await documentChunker.getChunkingStats(sampleParserResult)
    
    expect(stats).toHaveProperty('totalBlocks', 2)
    expect(stats).toHaveProperty('estimatedChunks')
    expect(stats).toHaveProperty('blockTypes')
    expect(stats.blockTypes).toHaveProperty('heading', 1)
    expect(stats.blockTypes).toHaveProperty('text', 1)
  })
})

describe('Account Chunker Service', () => {
  const accountChunker = getAccountChunker()

  const sampleAccount: AccountData = {
    accountNumber: 'ACC-TEST-001',
    accountName: 'Test Corporation',
    industry: 'Technology',
    companySize: 'Enterprise',
    gemStatus: 'GEM',
    summary: 'Test Corporation is a leading technology company that provides innovative software solutions to enterprises worldwide. They are currently undergoing digital transformation.',
    contacts: [
      { name: 'John Doe', title: 'CTO', department: 'IT' },
      { name: 'Jane Smith', title: 'VP Operations', department: 'Operations' },
    ],
    technologies: [
      { name: 'Salesforce', category: 'CRM', confidence: 0.9 },
      { name: 'AWS', category: 'Cloud', confidence: 0.8 },
    ],
    opportunities: [
      { name: 'Digital Transformation', value: 500000, stage: 'Proposal', probability: 70 },
    ],
    notes: 'Recent discussions show strong interest in our AI capabilities.',
  }

  test('should chunk account data', async () => {
    const result = await accountChunker.chunkAccountData(sampleAccount)
    
    expect(result).toHaveProperty('accountNumber', 'ACC-TEST-001')
    expect(result).toHaveProperty('accountName', 'Test Corporation')
    expect(result).toHaveProperty('totalChunks')
    expect(result).toHaveProperty('chunkTypes')
    expect(result.chunks.length).toBeGreaterThan(0)
    
    result.chunks.forEach(chunk => {
      expect(chunk).toHaveProperty('accountNumber', 'ACC-TEST-001')
      expect(chunk).toHaveProperty('chunkType')
      expect(chunk).toHaveProperty('priority')
      expect(chunk).toHaveProperty('contextKeys')
    })
  })

  test('should create different chunk types', async () => {
    const result = await accountChunker.chunkAccountData(sampleAccount, {
      includeContacts: true,
      includeTechnologies: true,
      includeOpportunities: true,
    })

    const chunkTypes = Object.keys(result.chunkTypes)
    expect(chunkTypes).toContain('summary')
    expect(chunkTypes).toContain('contacts')
    expect(chunkTypes).toContain('technologies')
    expect(chunkTypes).toContain('opportunities')
    expect(chunkTypes).toContain('notes')
  })

  test('should prioritize GEM accounts', async () => {
    const result = await accountChunker.chunkAccountData(sampleAccount)
    
    const summaryChunk = result.chunks.find(chunk => chunk.chunkType === 'summary')
    expect(summaryChunk?.priority).toBe('high') // GEM accounts get high priority
    expect(summaryChunk?.gemStatus).toBe('GEM')
  })

  test('should include context keys', async () => {
    const result = await accountChunker.chunkAccountData(sampleAccount)
    
    result.chunks.forEach(chunk => {
      expect(chunk.contextKeys).toContain('ACC-TEST-001')
      expect(chunk.contextKeys).toContain('technology')
    })
  })

  test('should get account statistics', () => {
    const stats = accountChunker.getAccountStats(sampleAccount)
    
    expect(stats).toHaveProperty('hasBasicInfo', true)
    expect(stats).toHaveProperty('hasContacts', true)
    expect(stats).toHaveProperty('hasTechnologies', true)
    expect(stats).toHaveProperty('hasOpportunities', true)
    expect(stats).toHaveProperty('hasSummary', true)
    expect(stats).toHaveProperty('isGEM', true)
    expect(stats).toHaveProperty('estimatedChunks')
  })
})

describe('Asset Chunker Service', () => {
  const assetChunker = getAssetChunker()

  const sampleAssetMetadata: AssetMetadata = {
    assetId: 'asset-test-001',
    assetName: 'Test Case Study',
    assetType: 'case-study',
    category: 'Customer Success',
    tags: ['healthcare', 'digital-transformation'],
    targetAudience: ['CTO', 'VP Engineering'],
    industry: ['Healthcare'],
    technologies: ['AI', 'Cloud'],
    products: ['Platform', 'Analytics'],
    confidenceLevel: 'high',
    reviewStatus: 'approved',
    accessLevel: 'internal',
  }

  const sampleCaseStudyResult: TParserResult = {
    blocks: [
      {
        id: 'overview',
        title: 'Company Overview',
        content: {
          type: 'text',
          text: 'TechCorp is a leading healthcare technology provider that helps hospitals improve patient outcomes through innovative software solutions.',
        },
        metadata: { pageNumber: 1 },
        rawText: 'TechCorp is a leading healthcare technology provider that helps hospitals improve patient outcomes through innovative software solutions.',
      },
      {
        id: 'benefits',
        title: 'Key Benefits',
        content: {
          type: 'text',
          text: 'Implementation of our platform resulted in 40% efficiency improvement, reduced costs by 30%, and increased patient satisfaction scores by 25%.',
        },
        metadata: { pageNumber: 1 },
        rawText: 'Implementation of our platform resulted in 40% efficiency improvement, reduced costs by 30%, and increased patient satisfaction scores by 25%.',
      },
    ],
    metadata: {
      fileName: 'techcorp-case-study.pdf',
      fileSize: 2048,
      fileType: 'application/pdf',
      totalBlocks: 2,
      processingTime: 1500,
      errors: [],
      warnings: [],
    },
  }

  test('should chunk sales asset', async () => {
    const result = await assetChunker.chunkAsset(sampleCaseStudyResult, sampleAssetMetadata)
    
    expect(result).toHaveProperty('assetId', 'asset-test-001')
    expect(result).toHaveProperty('assetType', 'case-study')
    expect(result).toHaveProperty('totalChunks')
    expect(result).toHaveProperty('contentCategories')
    expect(result.chunks.length).toBeGreaterThan(0)
    
    result.chunks.forEach(chunk => {
      expect(chunk).toHaveProperty('assetId', 'asset-test-001')
      expect(chunk).toHaveProperty('contentCategory')
      expect(chunk).toHaveProperty('relevanceScore')
      expect(chunk).toHaveProperty('keyPoints')
      expect(chunk).toHaveProperty('tags')
    })
  })

  test('should categorize content correctly', async () => {
    const result = await assetChunker.chunkAsset(sampleCaseStudyResult, sampleAssetMetadata, {
      categorizeContent: true,
    })

    const overviewChunk = result.chunks.find(chunk => 
      chunk.text.includes('healthcare technology provider')
    )
    expect(overviewChunk?.contentCategory).toBe('overview')

    const benefitsChunk = result.chunks.find(chunk => 
      chunk.text.includes('efficiency improvement')
    )
    expect(benefitsChunk?.contentCategory).toBe('benefits')
  })

  test('should extract key points', async () => {
    const result = await assetChunker.chunkAsset(sampleCaseStudyResult, sampleAssetMetadata, {
      extractKeyPoints: true,
    })

    expect(result.keyPoints.length).toBeGreaterThan(0)
    result.chunks.forEach(chunk => {
      expect(chunk.keyPoints).toBeDefined()
    })
  })

  test('should calculate relevance scores', async () => {
    const result = await assetChunker.chunkAsset(sampleCaseStudyResult, sampleAssetMetadata, {
      targetAudience: ['CTO'],
      filterByIndustry: ['Healthcare'],
    })

    result.chunks.forEach(chunk => {
      expect(chunk.relevanceScore).toBeGreaterThanOrEqual(0)
      expect(chunk.relevanceScore).toBeLessThanOrEqual(1)
    })
  })

  test('should infer asset type from document', () => {
    const assetType = assetChunker.inferAssetType(sampleCaseStudyResult)
    expect(['case-study', 'whitepaper', 'other']).toContain(assetType)
  })

  test('should create asset metadata', () => {
    const metadata = assetChunker.createAssetMetadata(sampleCaseStudyResult, {
      assetType: 'case-study',
      category: 'Customer Success',
    })
    
    expect(metadata).toHaveProperty('assetId')
    expect(metadata).toHaveProperty('assetName', 'techcorp-case-study.pdf')
    expect(metadata).toHaveProperty('assetType', 'case-study')
    expect(metadata).toHaveProperty('category', 'Customer Success')
  })
})

describe('Chunk Builder Service', () => {
  const chunkBuilder = getChunkBuilder()

  const sampleDocument: TParserResult = {
    blocks: [
      {
        id: 'test-block',
        content: {
          type: 'text',
          text: 'This is a test document for chunk building and vectorization.',
        },
        metadata: {},
        rawText: 'This is a test document for chunk building and vectorization.',
      },
    ],
    metadata: {
      fileName: 'test-doc.pdf',
      fileSize: 512,
      fileType: 'application/pdf',
      totalBlocks: 1,
      processingTime: 500,
      errors: [],
      warnings: [],
    },
  }

  test('should process document end-to-end', async () => {
    const result = await chunkBuilder.processDocument(sampleDocument, {
      scope: 'sales-assets',
      accountNumber: 'ACC-TEST',
      batchSize: 5,
      embeddingProvider: 'openai',
      skipDuplicates: true,
    })

    expect(result).toHaveProperty('processedItems', 1)
    expect(result).toHaveProperty('totalChunks')
    expect(result).toHaveProperty('successfulChunks')
    expect(result).toHaveProperty('processingTime')
    expect(result).toHaveProperty('vectorIds')
    expect(result.totalChunks).toBeGreaterThan(0)
  })

  test('should process account data', async () => {
    const sampleAccount: AccountData = {
      accountNumber: 'ACC-BUILDER-TEST',
      accountName: 'Builder Test Account',
      summary: 'Test account for chunk builder service.',
    }

    const result = await chunkBuilder.processAccount(sampleAccount, {
      scope: 'account-summary',
      accountNumber: 'ACC-BUILDER-TEST',
      batchSize: 5,
    })

    expect(result).toHaveProperty('processedItems', 1)
    expect(result).toHaveProperty('totalChunks')
    expect(result.totalChunks).toBeGreaterThan(0)
  })

  test('should handle batch processing', async () => {
    const items = [
      { type: 'document' as const, data: sampleDocument },
    ]

    const { jobId, job } = await chunkBuilder.processBatch(items, {
      scope: 'global-context',
      concurrency: 1,
      batchSize: 2,
    })

    expect(jobId).toBeDefined()
    expect(job).toHaveProperty('jobId', jobId)
    expect(job).toHaveProperty('status')
    expect(job).toHaveProperty('progress')
  })

  test('should track job progress', async () => {
    const items = [
      { type: 'document' as const, data: sampleDocument },
    ]

    const { jobId } = await chunkBuilder.processBatch(items, {
      scope: 'global-context',
    })

    const job = chunkBuilder.getJob(jobId)
    expect(job).toBeDefined()
    expect(job?.jobId).toBe(jobId)
  })

  test('should provide health status', async () => {
    const health = await chunkBuilder.getHealthStatus()
    
    expect(health).toHaveProperty('status')
    expect(health).toHaveProperty('services')
    expect(health).toHaveProperty('activeJobs')
    expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status)
  })
})

describe('Chunking Service Integration', () => {
  const chunkingService = getChunkingService()

  test('should provide unified document processing', async () => {
    const sampleDoc: TParserResult = {
      blocks: [
        {
          id: 'unified-test',
          content: {
            type: 'text',
            text: 'This is a unified service test document.',
          },
          metadata: {},
          rawText: 'This is a unified service test document.',
        },
      ],
      metadata: {
        fileName: 'unified-test.pdf',
        fileSize: 256,
        fileType: 'application/pdf',
        totalBlocks: 1,
        processingTime: 200,
        errors: [],
        warnings: [],
      },
    }

    const result = await chunkingService.processDocument(sampleDoc, {
      scope: 'global-context',
      generateEmbeddings: false,
    })

    expect(result).toBeDefined()
    expect(result).toHaveProperty('chunks')
  })

  test('should provide unified account processing', async () => {
    const sampleAccount: AccountData = {
      accountNumber: 'ACC-UNIFIED-TEST',
      accountName: 'Unified Test Account',
      summary: 'Test account for unified service.',
    }

    const result = await chunkingService.processAccount(sampleAccount, {
      generateEmbeddings: false,
    })

    expect(result).toBeDefined()
    expect(result).toHaveProperty('chunks')
  })

  test('should validate service setup', async () => {
    const validation = await chunkingService.validateSetup()
    
    expect(validation).toHaveProperty('valid')
    expect(validation).toHaveProperty('issues')
    expect(validation).toHaveProperty('warnings')
    expect(Array.isArray(validation.issues)).toBe(true)
    expect(Array.isArray(validation.warnings)).toBe(true)
  })

  test('should provide service health check', async () => {
    const health = await chunkingService.getServiceHealth()
    
    expect(health).toHaveProperty('status')
    expect(health).toHaveProperty('services')
    expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status)
  })

  test('should get document statistics', async () => {
    const sampleDoc: TParserResult = {
      blocks: [
        {
          id: 'stats-test',
          content: {
            type: 'text',
            text: 'This document is used for testing statistics generation.',
          },
          metadata: {},
          rawText: 'This document is used for testing statistics generation.',
        },
      ],
      metadata: {
        fileName: 'stats-test.pdf',
        fileSize: 128,
        fileType: 'application/pdf',
        totalBlocks: 1,
        processingTime: 100,
        errors: [],
        warnings: [],
      },
    }

    const stats = await chunkingService.getDocumentStats(sampleDoc)
    
    expect(stats).toHaveProperty('chunking')
    expect(stats).toHaveProperty('splitting')
    expect(stats).toHaveProperty('asset')
    expect(stats).toHaveProperty('recommendations')
    expect(Array.isArray(stats.recommendations)).toBe(true)
  })

  test('should get account statistics', () => {
    const sampleAccount: AccountData = {
      accountNumber: 'ACC-STATS-TEST',
      accountName: 'Stats Test Account',
      summary: 'Account for testing statistics.',
    }

    const stats = chunkingService.getAccountStats(sampleAccount)
    
    expect(stats).toHaveProperty('hasBasicInfo')
    expect(stats).toHaveProperty('estimatedChunks')
    expect(stats).toHaveProperty('isGEM')
  })
})

describe('Error Handling', () => {
  test('should handle empty documents gracefully', async () => {
    const emptyDoc: TParserResult = {
      blocks: [],
      metadata: {
        fileName: 'empty.pdf',
        fileSize: 0,
        fileType: 'application/pdf',
        totalBlocks: 0,
        processingTime: 0,
        errors: [],
        warnings: [],
      },
    }

    const documentChunker = getDocumentChunker()
    const result = await documentChunker.chunkDocument(emptyDoc)
    
    expect(result.chunks).toHaveLength(0)
    expect(result.totalChunks).toBe(0)
  })

  test('should handle invalid account data', async () => {
    const invalidAccount = {
      accountNumber: '',
      accountName: '',
    } as AccountData

    const accountChunker = getAccountChunker()
    
    await expect(async () => {
      await accountChunker.chunkAccountData(invalidAccount)
    }).rejects.toThrow()
  })

  test('should validate chunk integrity', async () => {
    const textSplitter = getTextSplitter()
    const chunks = await textSplitter.splitText('Test content for validation.')
    
    chunks.forEach(chunk => {
      const isValid = textSplitter.validateChunk(chunk)
      expect(isValid).toBe(true)
    })
  })
})