/**
 * Chunking Services Examples
 * Comprehensive examples showing how to use the chunking services
 */

import { 
  getChunkingService,
  getTextSplitter,
  getDocumentChunker,
  getAccountChunker,
  getAssetChunker,
  getChunkBuilder,
  type AccountData,
  type AssetMetadata,
  type ChunkProcessingOptions,
} from './index'
import { TParserResult } from '../parsers/file-parser.interface'

/**
 * Example 1: Basic text splitting
 */
export async function exampleTextSplitting() {
  const textSplitter = getTextSplitter()
  
  const sampleText = `
    The C1 Northstar Sales Intelligence Platform is a comprehensive solution designed to empower sales teams with AI-driven insights. 
    
    The platform integrates with existing CRM systems and provides real-time account intelligence, competitive analysis, and personalized recommendations. 
    
    Key features include automated account research, intelligent lead scoring, and dynamic sales asset recommendations based on account context and buyer personas.
    
    The system processes vast amounts of data from multiple sources including company websites, news articles, social media, and internal sales documents to generate actionable insights for sales representatives.
  `

  try {
    // Split with default settings
    const chunks = await textSplitter.splitText(sampleText)
    console.log('Basic splitting results:', {
      originalLength: sampleText.length,
      totalChunks: chunks.length,
      avgChunkSize: Math.round(chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / chunks.length),
      avgTokenCount: Math.round(chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0) / chunks.length),
    })

    // Split with custom settings for account summaries
    const accountChunks = await textSplitter.splitText(sampleText, {
      chunkSize: 300,
      chunkOverlap: 75,
      maxTokens: 400,
      preserveSentences: true,
    })
    
    console.log('Account-optimized splitting:', {
      totalChunks: accountChunks.length,
      chunks: accountChunks.map(chunk => ({
        text: chunk.text.substring(0, 100) + '...',
        tokens: chunk.tokenCount,
        sentences: chunk.sentenceCount,
      })),
    })

  } catch (error) {
    console.error('Text splitting example failed:', error)
  }
}

/**
 * Example 2: Document chunking with different file types
 */
export async function exampleDocumentChunking() {
  const documentChunker = getDocumentChunker()

  // Sample parser result (would come from actual file parser)
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
          lineNumber: 1,
        },
        rawText: 'Executive Summary',
      },
      {
        id: 'text_1',
        content: {
          type: 'text',
          text: 'This comprehensive analysis of the enterprise software market reveals significant opportunities for growth in the healthcare vertical. Our research indicates that healthcare organizations are increasingly adopting cloud-based solutions to improve operational efficiency and patient outcomes.',
        },
        metadata: {
          pageNumber: 1,
          lineNumber: 3,
        },
        rawText: 'This comprehensive analysis of the enterprise software market reveals significant opportunities for growth in the healthcare vertical. Our research indicates that healthcare organizations are increasingly adopting cloud-based solutions to improve operational efficiency and patient outcomes.',
      },
      {
        id: 'table_1',
        title: 'Market Size by Vertical',
        content: {
          type: 'table',
          headers: ['Vertical', '2023 Market Size', '2024 Projection', 'Growth Rate'],
          rows: [
            ['Healthcare', '$2.4B', '$3.1B', '29%'],
            ['Financial Services', '$1.8B', '$2.2B', '22%'],
            ['Manufacturing', '$1.2B', '$1.5B', '25%'],
          ],
        },
        metadata: {
          pageNumber: 2,
        },
        rawText: 'Vertical\t2023 Market Size\t2024 Projection\tGrowth Rate\nHealthcare\t$2.4B\t$3.1B\t29%\nFinancial Services\t$1.8B\t$2.2B\t22%\nManufacturing\t$1.2B\t$1.5B\t25%',
      },
    ],
    metadata: {
      fileName: 'market-analysis-2024.pdf',
      fileSize: 1024000,
      fileType: 'application/pdf',
      totalBlocks: 3,
      processingTime: 2500,
      errors: [],
      warnings: [],
    },
  }

  try {
    // Chunk document with structure preservation
    const result = await documentChunker.chunkDocument(sampleParserResult, {
      preserveStructure: true,
      includeHeaders: true,
      chunkSize: 400,
      chunkOverlap: 100,
    })

    console.log('Document chunking results:', {
      documentName: result.documentName,
      totalBlocks: result.totalBlocks,
      totalChunks: result.totalChunks,
      processingTime: result.processingTime,
      chunksByType: result.chunks.reduce((acc, chunk) => {
        acc[chunk.blockType] = (acc[chunk.blockType] || 0) + 1
        return acc
      }, {} as Record<string, number>),
    })

    // Show first few chunks
    result.chunks.slice(0, 3).forEach((chunk, index) => {
      console.log(`Chunk ${index + 1}:`, {
        type: chunk.blockType,
        title: chunk.title,
        textPreview: chunk.text.substring(0, 150) + '...',
        tokens: chunk.tokenCount,
        pageNumber: chunk.pageNumber,
      })
    })

  } catch (error) {
    console.error('Document chunking example failed:', error)
  }
}

/**
 * Example 3: Account data chunking for CRM integration
 */
export async function exampleAccountChunking() {
  const accountChunker = getAccountChunker()

  // Sample account data (would come from CRM system)
  const sampleAccount: AccountData = {
    accountNumber: 'ACC-001234',
    accountName: 'TechCorp Solutions Inc.',
    industry: 'Healthcare Technology',
    companySize: 'Enterprise (1000+ employees)',
    gemStatus: 'GEM',
    vendors: ['Salesforce', 'Microsoft', 'ServiceNow', 'Workday'],
    technologies: [
      { name: 'Salesforce CRM', category: 'Customer Relationship Management', confidence: 0.95 },
      { name: 'Microsoft Azure', category: 'Cloud Infrastructure', confidence: 0.88 },
      { name: 'Tableau', category: 'Business Intelligence', confidence: 0.82 },
      { name: 'ServiceNow ITSM', category: 'IT Service Management', confidence: 0.91 },
    ],
    contacts: [
      { name: 'Sarah Johnson', title: 'Chief Technology Officer', department: 'IT', email: 'sarah.johnson@techcorp.com' },
      { name: 'Michael Chen', title: 'VP of Operations', department: 'Operations', email: 'michael.chen@techcorp.com' },
      { name: 'Emily Rodriguez', title: 'Director of IT', department: 'IT', email: 'emily.rodriguez@techcorp.com' },
    ],
    opportunities: [
      { name: 'Digital Transformation Initiative', value: 850000, stage: 'Proposal', probability: 75 },
      { name: 'Cloud Migration Project', value: 320000, stage: 'Discovery', probability: 45 },
    ],
    summary: `TechCorp Solutions is a leading healthcare technology company that provides innovative software solutions to hospitals and healthcare networks across North America. The company has been experiencing rapid growth and is currently undergoing a digital transformation initiative to modernize their technology stack. They are particularly interested in cloud-based solutions that can scale with their expanding customer base and provide better integration capabilities.`,
    notes: `Recent discussions with the CTO indicate strong interest in our platform's AI capabilities. They are currently evaluating multiple vendors for their digital transformation project. Key decision makers are focused on ROI and integration capabilities. The company has a strong preference for solutions that can integrate with their existing Salesforce environment.`,
    lastUpdated: new Date('2024-08-01'),
    source: 'CRM_SYNC',
  }

  try {
    // Chunk account data with all components
    const result = await accountChunker.chunkAccountData(sampleAccount, {
      includeContacts: true,
      includeTechnologies: true,
      includeOpportunities: true,
      chunkSize: 350,
      chunkOverlap: 75,
      preserveContext: true,
    })

    console.log('Account chunking results:', {
      accountName: result.accountName,
      gemStatus: sampleAccount.gemStatus,
      totalChunks: result.totalChunks,
      chunkTypes: result.chunkTypes,
      processingTime: result.processingTime,
    })

    // Show chunks by type
    Object.entries(result.chunkTypes).forEach(([type, count]) => {
      console.log(`\n${type.toUpperCase()} chunks (${count}):`)
      const typeChunks = result.chunks.filter(chunk => chunk.chunkType === type)
      typeChunks.slice(0, 2).forEach((chunk, index) => {
        console.log(`  Chunk ${index + 1}:`, {
          priority: chunk.priority,
          tokens: chunk.tokenCount,
          contextKeys: chunk.contextKeys,
          textPreview: chunk.text.substring(0, 200) + '...',
        })
      })
    })

  } catch (error) {
    console.error('Account chunking example failed:', error)
  }
}

/**
 * Example 4: Sales asset chunking with specialized handling
 */
export async function exampleAssetChunking() {
  const assetChunker = getAssetChunker()

  // Sample asset metadata
  const assetMetadata: AssetMetadata = {
    assetId: 'asset_case_study_techcorp_2024',
    assetName: 'TechCorp Digital Transformation Case Study',
    assetType: 'case-study',
    category: 'Customer Success',
    tags: ['healthcare', 'digital-transformation', 'cloud-migration', 'enterprise'],
    targetAudience: ['CTO', 'VP Engineering', 'IT Director'],
    industry: ['Healthcare', 'Technology'],
    technologies: ['Cloud Infrastructure', 'Data Analytics', 'AI/ML'],
    products: ['Northstar Platform', 'Analytics Suite', 'Integration Hub'],
    version: '2.1',
    createdDate: new Date('2024-06-15'),
    author: 'Sales Engineering Team',
    language: 'en',
    confidenceLevel: 'high',
    reviewStatus: 'approved',
    accessLevel: 'internal',
  }

  // Sample parser result for case study
  const caseStudyResult: TParserResult = {
    blocks: [
      {
        id: 'title',
        title: 'Case Study Title',
        content: {
          type: 'heading',
          text: 'TechCorp Digital Transformation: 40% Efficiency Gain with Northstar Platform',
          level: 1,
        },
        metadata: { pageNumber: 1 },
        rawText: 'TechCorp Digital Transformation: 40% Efficiency Gain with Northstar Platform',
      },
      {
        id: 'overview',
        title: 'Company Overview',
        content: {
          type: 'text',
          text: 'TechCorp Solutions, a leading healthcare technology provider serving over 200 hospitals across North America, faced significant challenges in managing their rapidly growing data infrastructure. With customer data spread across multiple systems and manual processes slowing down critical operations, the company needed a comprehensive digital transformation solution.',
        },
        metadata: { pageNumber: 1 },
        rawText: 'TechCorp Solutions, a leading healthcare technology provider serving over 200 hospitals across North America, faced significant challenges in managing their rapidly growing data infrastructure. With customer data spread across multiple systems and manual processes slowing down critical operations, the company needed a comprehensive digital transformation solution.',
      },
      {
        id: 'challenge',
        title: 'The Challenge',
        content: {
          type: 'text',
          text: 'Legacy systems created data silos that prevented real-time decision making. Manual reporting processes took weeks to complete, and the lack of integration between systems resulted in inconsistent customer experiences. TechCorp needed to modernize their infrastructure while maintaining compliance with healthcare regulations.',
        },
        metadata: { pageNumber: 1 },
        rawText: 'Legacy systems created data silos that prevented real-time decision making. Manual reporting processes took weeks to complete, and the lack of integration between systems resulted in inconsistent customer experiences. TechCorp needed to modernize their infrastructure while maintaining compliance with healthcare regulations.',
      },
      {
        id: 'solution',
        title: 'The Solution',
        content: {
          type: 'text',
          text: 'TechCorp implemented the Northstar Platform to create a unified data ecosystem. The platform provided real-time analytics, automated reporting, and seamless integration with existing healthcare systems. Key components included the Analytics Suite for data visualization and the Integration Hub for connecting disparate systems.',
        },
        metadata: { pageNumber: 2 },
        rawText: 'TechCorp implemented the Northstar Platform to create a unified data ecosystem. The platform provided real-time analytics, automated reporting, and seamless integration with existing healthcare systems. Key components included the Analytics Suite for data visualization and the Integration Hub for connecting disparate systems.',
      },
      {
        id: 'results',
        title: 'Results',
        content: {
          type: 'text',
          text: 'Within six months of implementation, TechCorp achieved a 40% improvement in operational efficiency. Reporting time was reduced from weeks to hours, and customer satisfaction scores increased by 25%. The company also achieved full compliance with healthcare regulations while reducing IT maintenance costs by 30%.',
        },
        metadata: { pageNumber: 2 },
        rawText: 'Within six months of implementation, TechCorp achieved a 40% improvement in operational efficiency. Reporting time was reduced from weeks to hours, and customer satisfaction scores increased by 25%. The company also achieved full compliance with healthcare regulations while reducing IT maintenance costs by 30%.',
      },
    ],
    metadata: {
      fileName: 'techcorp-case-study-2024.pdf',
      fileSize: 2048000,
      fileType: 'application/pdf',
      totalBlocks: 5,
      processingTime: 3200,
      errors: [],
      warnings: [],
    },
  }

  try {
    // Chunk sales asset with enhanced processing
    const result = await assetChunker.chunkAsset(caseStudyResult, assetMetadata, {
      extractKeyPoints: true,
      categorizeContent: true,
      enhanceWithContext: true,
      includeMetadataContext: true,
      targetAudience: ['CTO', 'VP Engineering'],
      filterByIndustry: ['Healthcare'],
      minRelevanceScore: 0.3,
    })

    console.log('Asset chunking results:', {
      assetName: result.assetName,
      assetType: result.assetType,
      totalChunks: result.totalChunks,
      contentCategories: result.contentCategories,
      keyPointsCount: result.keyPoints.length,
      processingTime: result.processingTime,
    })

    // Show content categories and their chunks
    Object.entries(result.contentCategories).forEach(([category, count]) => {
      console.log(`\n${category.toUpperCase()} content (${count} chunks):`)
      const categoryChunks = result.chunks.filter(chunk => chunk.contentCategory === category)
      categoryChunks.slice(0, 2).forEach((chunk, index) => {
        console.log(`  Chunk ${index + 1}:`, {
          relevanceScore: Math.round(chunk.relevanceScore * 100) + '%',
          keyPoints: chunk.keyPoints.length,
          tokens: chunk.tokenCount,
          tags: chunk.tags,
          textPreview: chunk.text.substring(0, 200) + '...',
        })
      })
    })

    // Show extracted key points
    console.log('\nExtracted Key Points:')
    result.keyPoints.slice(0, 10).forEach((point, index) => {
      console.log(`  ${index + 1}. ${point}`)
    })

  } catch (error) {
    console.error('Asset chunking example failed:', error)
  }
}

/**
 * Example 5: End-to-end processing with embeddings and vector storage
 */
export async function exampleEndToEndProcessing() {
  const chunkBuilder = getChunkBuilder()

  // Sample document for processing
  const sampleDocument: TParserResult = {
    blocks: [
      {
        id: 'summary',
        content: {
          type: 'text',
          text: 'Our AI-powered sales intelligence platform helps enterprise sales teams identify high-value opportunities and accelerate deal closure through data-driven insights and personalized recommendations.',
        },
        metadata: {},
        rawText: 'Our AI-powered sales intelligence platform helps enterprise sales teams identify high-value opportunities and accelerate deal closure through data-driven insights and personalized recommendations.',
      },
    ],
    metadata: {
      fileName: 'product-overview.pdf',
      fileSize: 512000,
      fileType: 'application/pdf',
      totalBlocks: 1,
      processingTime: 1000,
      errors: [],
      warnings: [],
    },
  }

  const options: ChunkProcessingOptions = {
    scope: 'sales-assets',
    accountNumber: 'ACC-001234',
    batchSize: 10,
    embeddingProvider: 'openai',
    skipDuplicates: true,
    generateProgress: true,
    onProgress: (progress) => {
      console.log(`Processing progress: ${progress.stage} - ${progress.percentage}% (${progress.processed}/${progress.total})`)
    },
    onError: (error) => {
      console.error(`Processing error in ${error.stage}:`, error.error)
    },
  }

  try {
    console.log('Starting end-to-end document processing...')
    
    const result = await chunkBuilder.processDocument(sampleDocument, options)
    
    console.log('End-to-end processing completed:', {
      processedItems: result.processedItems,
      totalChunks: result.totalChunks,
      successfulChunks: result.successfulChunks,
      failedChunks: result.failedChunks,
      duplicateChunks: result.duplicateChunks,
      totalTokens: result.totalTokens,
      processingTime: result.processingTime,
      vectorIds: result.vectorIds.slice(0, 5), // Show first 5 vector IDs
      errorsCount: result.errors.length,
      warningsCount: result.warnings.length,
    })

    if (result.errors.length > 0) {
      console.log('Processing errors:')
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.stage}: ${error.error}`)
      })
    }

  } catch (error) {
    console.error('End-to-end processing example failed:', error)
  }
}

/**
 * Example 6: Batch processing multiple accounts
 */
export async function exampleBatchProcessing() {
  const chunkingService = getChunkingService()

  // Sample accounts for batch processing
  const accounts: AccountData[] = [
    {
      accountNumber: 'ACC-001',
      accountName: 'Healthcare Corp',
      industry: 'Healthcare',
      gemStatus: 'GEM',
      summary: 'Leading healthcare provider focusing on patient care optimization.',
    },
    {
      accountNumber: 'ACC-002',
      accountName: 'FinTech Solutions',
      industry: 'Financial Services',
      gemStatus: 'Non-GEM',
      summary: 'Innovative financial technology company specializing in digital payments.',
    },
    {
      accountNumber: 'ACC-003',
      accountName: 'Manufacturing Plus',
      industry: 'Manufacturing',
      gemStatus: 'GEM',
      summary: 'Advanced manufacturing company leveraging IoT and automation.',
    },
  ]

  const batchItems = accounts.map(account => ({
    type: 'account' as const,
    data: account,
    options: {
      includeContacts: true,
      includeTechnologies: true,
      includeOpportunities: false,
    },
  }))

  try {
    console.log('Starting batch processing of accounts...')
    
    const { jobId, job } = await chunkingService.processBatch(batchItems, {
      concurrency: 2,
      batchSize: 5,
      embeddingProvider: 'openai',
      onProgress: (progress) => {
        console.log(`Batch progress: ${progress.stage} - ${progress.percentage}% (${progress.processed}/${progress.total})`)
        if (progress.estimatedTimeRemaining) {
          console.log(`  Estimated time remaining: ${Math.round(progress.estimatedTimeRemaining / 1000)}s`)
        }
      },
    })

    console.log('Batch job started:', {
      jobId,
      status: job.status,
      totalItems: job.progress.total,
    })

    // Monitor job progress (in real implementation, you'd poll this)
    const checkJobStatus = () => {
      const chunkBuilder = getChunkBuilder()
      const currentJob = chunkBuilder.getJob(jobId)
      
      if (currentJob) {
        console.log(`Job ${jobId} status: ${currentJob.status}`)
        
        if (currentJob.status === 'completed' && currentJob.result) {
          console.log('Batch processing completed:', {
            processedItems: currentJob.result.processedItems,
            totalChunks: currentJob.result.totalChunks,
            successfulChunks: currentJob.result.successfulChunks,
            failedChunks: currentJob.result.failedChunks,
            totalTokens: currentJob.result.totalTokens,
            processingTime: currentJob.result.processingTime,
          })
        }
      }
    }

    // Check status after a delay (simulating polling)
    setTimeout(checkJobStatus, 5000)

  } catch (error) {
    console.error('Batch processing example failed:', error)
  }
}

/**
 * Example 7: Service health check and validation
 */
export async function exampleServiceValidation() {
  const chunkingService = getChunkingService()

  try {
    console.log('Validating chunking services setup...')
    
    const validation = await chunkingService.validateSetup()
    
    console.log('Validation results:', {
      valid: validation.valid,
      issuesCount: validation.issues.length,
      warningsCount: validation.warnings.length,
    })

    if (validation.issues.length > 0) {
      console.log('Issues found:')
      validation.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`)
      })
    }

    if (validation.warnings.length > 0) {
      console.log('Warnings:')
      validation.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`)
      })
    }

    // Check service health
    const health = await chunkingService.getServiceHealth()
    
    console.log('Service health:', {
      status: health.status,
      activeJobs: health.activeJobs,
      embeddingService: health.services.embedding.status,
      vectorStore: health.services.vectorStore.status,
    })

  } catch (error) {
    console.error('Service validation example failed:', error)
  }
}

/**
 * Example 8: Using the unified chunking service
 */
export async function exampleUnifiedService() {
  const chunkingService = getChunkingService()

  // Sample document
  const sampleDoc: TParserResult = {
    blocks: [
      {
        id: 'intro',
        content: {
          type: 'text',
          text: 'This whitepaper explores the latest trends in artificial intelligence and their impact on enterprise sales processes.',
        },
        metadata: {},
        rawText: 'This whitepaper explores the latest trends in artificial intelligence and their impact on enterprise sales processes.',
      },
    ],
    metadata: {
      fileName: 'ai-trends-whitepaper.pdf',
      fileSize: 1024000,
      fileType: 'application/pdf',
      totalBlocks: 1,
      processingTime: 1500,
      errors: [],
      warnings: [],
    },
  }

  // Sample account
  const sampleAccount: AccountData = {
    accountNumber: 'ACC-UNIFIED',
    accountName: 'Unified Test Account',
    summary: 'Test account for unified service demonstration.',
  }

  try {
    console.log('Testing unified chunking service...')

    // Process document as sales asset
    const docResult = await chunkingService.processDocument(sampleDoc, {
      scope: 'sales-assets',
      accountNumber: 'ACC-UNIFIED',
      generateEmbeddings: false, // Just chunking for this example
    })

    console.log('Document processing result:', {
      totalChunks: docResult.totalChunks || docResult.chunks?.length,
      processingTime: docResult.processingTime,
    })

    // Process account
    const accountResult = await chunkingService.processAccount(sampleAccount, {
      generateEmbeddings: false, // Just chunking for this example
    })

    console.log('Account processing result:', {
      totalChunks: accountResult.totalChunks || accountResult.chunks?.length,
      processingTime: accountResult.processingTime,
    })

    // Get document statistics
    const docStats = await chunkingService.getDocumentStats(sampleDoc)
    console.log('Document statistics:', {
      estimatedChunks: docStats.chunking.estimatedChunks,
      complexity: docStats.asset.complexity,
      recommendations: docStats.recommendations,
    })

    // Get account statistics
    const accountStats = chunkingService.getAccountStats(sampleAccount)
    console.log('Account statistics:', accountStats)

  } catch (error) {
    console.error('Unified service example failed:', error)
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('🚀 Running chunking services examples...\n')

  const examples = [
    { name: 'Text Splitting', fn: exampleTextSplitting },
    { name: 'Document Chunking', fn: exampleDocumentChunking },
    { name: 'Account Chunking', fn: exampleAccountChunking },
    { name: 'Asset Chunking', fn: exampleAssetChunking },
    { name: 'End-to-End Processing', fn: exampleEndToEndProcessing },
    { name: 'Batch Processing', fn: exampleBatchProcessing },
    { name: 'Service Validation', fn: exampleServiceValidation },
    { name: 'Unified Service', fn: exampleUnifiedService },
  ]

  for (const example of examples) {
    console.log(`\n📋 Running ${example.name} example...`)
    console.log('='.repeat(50))
    
    try {
      await example.fn()
      console.log(`✅ ${example.name} completed successfully`)
    } catch (error) {
      console.error(`❌ ${example.name} failed:`, error)
    }
    
    console.log('\n')
  }

  console.log('🎉 All examples completed!')
}

// Export for CLI usage
if (require.main === module) {
  runAllExamples().catch(console.error)
}