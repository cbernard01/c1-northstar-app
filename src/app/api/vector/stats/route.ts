/**
 * Vector Services Statistics API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getVectorService } from '@/lib/services/vector'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const vectorService = getVectorService()
    const stats = await vectorService.getStats()

    logger.debug('Vector stats retrieved')

    return NextResponse.json({
      statistics: stats,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    logger.error('Vector stats API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json({
      error: 'Failed to retrieve statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const vectorService = getVectorService()
    vectorService.clearCaches()

    logger.info('Vector caches cleared')

    return NextResponse.json({
      message: 'Caches cleared successfully',
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    logger.error('Clear caches API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json({
      error: 'Failed to clear caches',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}