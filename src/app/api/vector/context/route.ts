/**
 * Vector Context Retrieval API
 * Get context chunks for a query within a specific account
 */

import { NextRequest, NextResponse } from 'next/server'
import { getVectorService } from '@/lib/services/vector'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// Request validation schema
const contextRequestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  accountNumber: z.string().min(1, 'Account number is required'),
  maxChunks: z.number().min(1).max(20).default(5),
  scoreThreshold: z.number().min(0).max(1).default(0.75),
  documentTypes: z.array(z.string()).optional(),
  provider: z.enum(['openai', 'anthropic', 'local']).default('openai'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = contextRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid request',
        details: validation.error.errors,
      }, { status: 400 })
    }

    const { 
      query, 
      accountNumber, 
      maxChunks, 
      scoreThreshold, 
      documentTypes, 
      provider 
    } = validation.data

    const vectorService = getVectorService()
    
    const contextChunks = await vectorService.getContextForAccount(query, accountNumber, {
      maxChunks,
      scoreThreshold,
      documentTypes,
      provider,
    })

    // Format response with chunk content
    const formattedChunks = contextChunks.map(chunk => ({
      id: chunk.id,
      score: chunk.score,
      content: chunk.payload.sourceType === 'document' ? 
        `Chunk ${chunk.payload.chunkIndex + 1}/${chunk.payload.totalChunks}` : 
        'Content chunk',
      metadata: {
        documentName: chunk.payload.documentName,
        documentType: chunk.payload.documentType,
        chunkIndex: chunk.payload.chunkIndex,
        totalChunks: chunk.payload.totalChunks,
        sourceType: chunk.payload.sourceType,
        createdAt: chunk.payload.createdAt,
      },
    }))

    logger.info('Context retrieval completed', {
      query: query.substring(0, 100),
      accountNumber,
      chunksFound: contextChunks.length,
      provider,
    })

    return NextResponse.json({
      query,
      accountNumber,
      context: formattedChunks,
      totalChunks: contextChunks.length,
      parameters: {
        maxChunks,
        scoreThreshold,
        documentTypes,
        provider,
      },
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    logger.error('Context retrieval API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json({
      error: 'Context retrieval failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}