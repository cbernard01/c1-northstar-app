/**
 * Embeddings Generation API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getEmbeddingService } from '@/lib/services/vector'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// Request validation schema
const embeddingRequestSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  provider: z.enum(['openai', 'anthropic', 'local']).default('openai'),
  model: z.string().optional(),
  dimensions: z.number().min(128).max(4096).optional(),
  useCache: z.boolean().default(true),
})

const batchEmbeddingRequestSchema = z.object({
  texts: z.array(z.string()).min(1, 'At least one text is required').max(100, 'Maximum 100 texts allowed'),
  provider: z.enum(['openai', 'anthropic', 'local']).default('openai'),
  model: z.string().optional(),
  dimensions: z.number().min(128).max(4096).optional(),
  useCache: z.boolean().default(true),
  batchSize: z.number().min(1).max(50).default(25),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const embeddingService = getEmbeddingService()

    // Check if this is a batch request
    if (Array.isArray(body.texts)) {
      const validation = batchEmbeddingRequestSchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json({
          error: 'Invalid batch request',
          details: validation.error.errors,
        }, { status: 400 })
      }

      const { texts, provider, model, dimensions, useCache, batchSize } = validation.data

      const startTime = Date.now()
      const result = await embeddingService.generateBatchEmbeddings(texts, {
        provider,
        model,
        dimensions,
        useCache,
        batchSize,
      })

      const duration = Date.now() - startTime

      logger.info('Batch embeddings generated', {
        textsCount: texts.length,
        successful: result.successful,
        failed: result.failed,
        totalTokens: result.totalTokens,
        duration,
        provider,
      })

      return NextResponse.json({
        embeddings: result.embeddings.map(emb => ({
          embedding: emb.embedding,
          dimensions: emb.dimensions,
          tokensUsed: emb.tokensUsed,
          provider: emb.provider,
          model: emb.model,
        })),
        summary: {
          total: texts.length,
          successful: result.successful,
          failed: result.failed,
          totalTokens: result.totalTokens,
          duration,
        },
        errors: result.errors,
        timestamp: new Date().toISOString(),
      })

    } else {
      // Single embedding request
      const validation = embeddingRequestSchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json({
          error: 'Invalid request',
          details: validation.error.errors,
        }, { status: 400 })
      }

      const { text, provider, model, dimensions, useCache } = validation.data

      const startTime = Date.now()
      const result = await embeddingService.generateEmbedding(text, {
        provider,
        model,
        dimensions,
        useCache,
      })

      const duration = Date.now() - startTime

      logger.info('Embedding generated', {
        textLength: text.length,
        dimensions: result.dimensions,
        tokensUsed: result.tokensUsed,
        duration,
        provider: result.provider,
      })

      return NextResponse.json({
        embedding: result.embedding,
        dimensions: result.dimensions,
        tokensUsed: result.tokensUsed,
        provider: result.provider,
        model: result.model,
        duration,
        timestamp: new Date().toISOString(),
      })
    }

  } catch (error) {
    logger.error('Embeddings API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json({
      error: 'Embedding generation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}