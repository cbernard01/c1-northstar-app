/**
 * AI Embeddings API Route
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { aiService } from '@/lib/ai/ai-service'
import { logger } from '@/lib/logger'
import { withAuth, getUserId } from '@/lib/middleware/auth'
import { withErrorHandler } from '@/lib/middleware/error-handler'

// Validation schemas
const generateEmbeddingSchema = z.object({
  text: z.string().min(1).max(8000),
  useCache: z.boolean().optional().default(true),
  dimensions: z.number().min(256).max(3072).optional(),
})

const batchEmbeddingsSchema = z.object({
  texts: z.array(z.string().min(1).max(8000)).min(1).max(100),
  useCache: z.boolean().optional().default(true),
  batchSize: z.number().min(1).max(50).optional().default(20),
})

const embedDocumentSchema = z.object({
  text: z.string().min(1).max(50000),
  chunkSize: z.number().min(100).max(2000).optional().default(1000),
  chunkOverlap: z.number().min(0).max(500).optional().default(100),
  useCache: z.boolean().optional().default(true),
  metadata: z.record(z.any()).optional(),
})

const similaritySearchSchema = z.object({
  queryText: z.string().min(1).max(8000),
  embeddings: z.array(z.object({
    id: z.string(),
    embedding: z.array(z.number()),
    metadata: z.any().optional(),
  })).min(1).max(1000),
  topK: z.number().min(1).max(50).optional().default(5),
})

// POST /api/ai/embeddings - Generate single embedding
export const POST = withErrorHandler(
  withAuth(async (req) => {
    const userId = getUserId(req)
    const body = await req.json()

    const { text, useCache, dimensions } = generateEmbeddingSchema.parse(body)

    logger.info('Generating embedding', {
      userId,
      textLength: text.length,
      useCache,
      dimensions,
    })

    try {
      const result = await aiService.generateEmbedding(text, {
        useCache,
        dimensions,
      })

      logger.info('Embedding generated', {
        userId,
        dimensions: result.embedding.length,
        usage: result.usage,
      })

      return NextResponse.json({
        success: true,
        data: {
          embedding: result.embedding,
          dimensions: result.embedding.length,
          usage: result.usage,
        },
      })

    } catch (error) {
      logger.error('Embedding generation error', {
        userId,
        textLength: text.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { success: false, error: 'Failed to generate embedding.' },
        { status: 500 }
      )
    }
  })
)

// POST /api/ai/embeddings/batch - Generate batch embeddings
export const PUT = withErrorHandler(
  withAuth(async (req) => {
    const userId = getUserId(req)
    const body = await req.json()

    const { texts, useCache, batchSize } = batchEmbeddingsSchema.parse(body)

    logger.info('Generating batch embeddings', {
      userId,
      textCount: texts.length,
      totalLength: texts.reduce((sum, text) => sum + text.length, 0),
      batchSize,
    })

    try {
      const results = await aiService.generateBatchEmbeddings(texts, {
        useCache,
        batchSize,
      })

      const totalUsage = results.reduce((sum, result) => ({
        promptTokens: sum.promptTokens + (result.usage?.promptTokens || 0),
        totalTokens: sum.totalTokens + (result.usage?.totalTokens || 0),
      }), { promptTokens: 0, totalTokens: 0 })

      logger.info('Batch embeddings generated', {
        userId,
        embeddingCount: results.length,
        totalUsage,
      })

      return NextResponse.json({
        success: true,
        data: {
          embeddings: results.map((result, index) => ({
            index,
            embedding: result.embedding,
            dimensions: result.embedding.length,
            usage: result.usage,
          })),
          totalUsage,
          metadata: {
            textCount: texts.length,
            batchSize,
          },
        },
      })

    } catch (error) {
      logger.error('Batch embeddings error', {
        userId,
        textCount: texts.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { success: false, error: 'Failed to generate batch embeddings.' },
        { status: 500 }
      )
    }
  })
)

// POST /api/ai/embeddings/document - Embed document with chunking
export const PATCH = withErrorHandler(
  withAuth(async (req) => {
    const userId = getUserId(req)
    const body = await req.json()

    const { text, chunkSize, chunkOverlap, useCache, metadata } = embedDocumentSchema.parse(body)

    logger.info('Embedding document', {
      userId,
      textLength: text.length,
      chunkSize,
      chunkOverlap,
      useCache,
    })

    try {
      const results = await aiService.embedDocument(text, {
        chunkSize,
        chunkOverlap,
        useCache,
        metadata,
      })

      logger.info('Document embedded', {
        userId,
        originalLength: text.length,
        chunkCount: results.length,
      })

      return NextResponse.json({
        success: true,
        data: {
          chunks: results.map(result => ({
            chunkIndex: result.chunkIndex,
            chunk: result.chunk,
            embedding: result.embedding,
            dimensions: result.embedding.length,
            metadata: result.metadata,
          })),
          metadata: {
            originalLength: text.length,
            chunkCount: results.length,
            chunkSize,
            chunkOverlap,
          },
        },
      })

    } catch (error) {
      logger.error('Document embedding error', {
        userId,
        textLength: text.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { success: false, error: 'Failed to embed document.' },
        { status: 500 }
      )
    }
  })
)

// POST /api/ai/embeddings/similarity - Calculate similarity and search
export const DELETE = withErrorHandler(
  withAuth(async (req) => {
    const userId = getUserId(req)
    const body = await req.json()

    const { queryText, embeddings, topK } = similaritySearchSchema.parse(body)

    logger.info('Performing similarity search', {
      userId,
      queryLength: queryText.length,
      embeddingCount: embeddings.length,
      topK,
    })

    try {
      // Generate embedding for query text
      const queryEmbedding = await aiService.generateEmbedding(queryText, {
        useCache: true,
      })

      // Find most similar embeddings
      const results = aiService.findMostSimilar(
        queryEmbedding.embedding,
        embeddings,
        topK
      )

      logger.info('Similarity search completed', {
        userId,
        resultsFound: results.length,
        topSimilarity: results[0]?.similarity || 0,
      })

      return NextResponse.json({
        success: true,
        data: {
          query: {
            text: queryText,
            embedding: queryEmbedding.embedding,
            dimensions: queryEmbedding.embedding.length,
          },
          results: results.map(result => ({
            id: result.id,
            similarity: result.similarity,
            metadata: result.metadata,
          })),
          metadata: {
            searchCount: embeddings.length,
            topK,
            queryUsage: queryEmbedding.usage,
          },
        },
      })

    } catch (error) {
      logger.error('Similarity search error', {
        userId,
        queryLength: queryText.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { success: false, error: 'Failed to perform similarity search.' },
        { status: 500 }
      )
    }
  })
)

// GET /api/ai/embeddings - Get embedding service info and examples
export const GET = withErrorHandler(
  withAuth(async (req) => {
    const url = new URL(req.url)
    const info = url.searchParams.get('info')

    if (info === 'models') {
      return NextResponse.json({
        success: true,
        data: {
          availableModels: {
            openai: {
              'text-embedding-3-large': {
                dimensions: [256, 1024, 3072],
                maxTokens: 8191,
                description: 'Most capable embedding model',
              },
              'text-embedding-3-small': {
                dimensions: [512, 1536],
                maxTokens: 8191,
                description: 'Smaller, faster embedding model',
              },
            },
            azure: {
              'text-embedding-ada-002': {
                dimensions: [1536],
                maxTokens: 8191,
                description: 'Azure OpenAI embedding model',
              },
            },
          },
          currentProvider: 'openai', // This should come from config
          pricing: {
            openai: {
              'text-embedding-3-large': 0.00013, // per 1K tokens
              'text-embedding-3-small': 0.00002,
            },
          },
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        description: 'AI Embeddings Service - Generate vector embeddings for semantic search',
        endpoints: {
          'POST /api/ai/embeddings': 'Generate single embedding',
          'PUT /api/ai/embeddings/batch': 'Generate batch embeddings',
          'PATCH /api/ai/embeddings/document': 'Embed document with chunking',
          'DELETE /api/ai/embeddings/similarity': 'Perform similarity search',
        },
        examples: {
          single: {
            input: { text: 'OpenAI GPT-4 is a large language model' },
            output: { embedding: '[0.1, -0.2, 0.3, ...]', dimensions: 1536 },
          },
          batch: {
            input: { texts: ['First text', 'Second text', 'Third text'] },
            output: { embeddings: [{ embedding: '[...]' }, { embedding: '[...]' }] },
          },
          similarity: {
            input: { 
              queryText: 'machine learning models',
              embeddings: [{ id: '1', embedding: '[...]' }],
              topK: 3 
            },
            output: { results: [{ id: '1', similarity: 0.85 }] },
          },
        },
        limits: {
          singleText: { maxLength: 8000 },
          batchTexts: { maxCount: 100, maxBatchSize: 50 },
          document: { maxLength: 50000 },
          similarity: { maxEmbeddings: 1000, maxTopK: 50 },
        },
      },
    })
  })
)