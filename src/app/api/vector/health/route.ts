/**
 * Vector Services Health Check API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getVectorService } from '@/lib/services/vector'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const vectorService = getVectorService()
    const health = await vectorService.healthCheck()

    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 206 : 503

    return NextResponse.json({
      status: health.status,
      timestamp: new Date().toISOString(),
      services: health.services,
      version: '1.0.0',
    }, { status: statusCode })

  } catch (error) {
    logger.error('Vector health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 503 })
  }
}