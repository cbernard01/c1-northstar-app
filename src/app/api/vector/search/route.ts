/**
 * Vector Search API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getVectorService } from '@/lib/services/vector'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// Request validation schema
const searchRequestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  accountNumber: z.string().optional(),
  scope: z.enum(['account', 'contact', 'technology', 'document', 'insight']).optional(),
  limit: z.number().min(1).max(100).default(10),
  scoreThreshold: z.number().min(0).max(1).default(0.7),
  provider: z.enum(['openai', 'anthropic', 'local']).default('openai'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = searchRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid request',
        details: validation.error.errors,
      }, { status: 400 })
    }

    const { query, accountNumber, scope, limit, scoreThreshold, provider } = validation.data

    const vectorService = getVectorService()
    
    const results = await vectorService.semanticSearch(query, {
      accountNumber,
      scope,
      limit,
      scoreThreshold,
      provider,
    })

    logger.info('Vector search completed', {
      query: query.substring(0, 100),
      accountNumber,
      scope,
      resultsCount: results.length,
      provider,
    })

    return NextResponse.json({
      query,
      results: results.map(result => ({
        id: result.id,
        score: result.score,
        metadata: result.payload,
      })),
      count: results.length,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    logger.error('Vector search API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json({
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}