/**
 * AI Services Health Check API Route
 */

import { NextRequest, NextResponse } from 'next/server'

import { aiService } from '@/lib/ai/ai-service'
import { logger } from '@/lib/logger'
import { withAuth, getUserId } from '@/lib/middleware/auth'
import { withErrorHandler } from '@/lib/middleware/error-handler'

// GET /api/ai/health - Get health status of all AI services
const getHandler = withErrorHandler(
  withAuth(async (req) => {
    const userId = getUserId(req)
    const url = new URL(req.url)
    const detailed = url.searchParams.get('detailed') === 'true'
    const service = url.searchParams.get('service')

    logger.info('AI health check requested', {
      userId,
      detailed,
      service,
    })

    try {
      const startTime = Date.now()
      
      // Get health status for all services
      const healthStatus = await aiService.getHealthStatus()
      
      // Get service metrics if detailed info requested
      let metrics = null
      if (detailed) {
        metrics = aiService.getServiceMetrics()
      }

      const totalLatency = Date.now() - startTime

      // Calculate overall health
      const services = Object.values(healthStatus)
      const healthyCount = services.filter(s => s.status === 'healthy').length
      const unhealthyCount = services.filter(s => s.status === 'unhealthy').length
      const degradedCount = services.filter(s => s.status === 'degraded').length

      const overallStatus = unhealthyCount > 0 
        ? 'unhealthy' 
        : degradedCount > 0 
        ? 'degraded' 
        : 'healthy'

      const response = {
        success: true,
        data: {
          overall: {
            status: overallStatus,
            totalLatency,
            checkTime: new Date().toISOString(),
            services: {
              total: services.length,
              healthy: healthyCount,
              degraded: degradedCount,
              unhealthy: unhealthyCount,
            },
          },
          services: service ? { [service]: healthStatus[service] } : healthStatus,
          ...(detailed && {
            metrics: {
              cache: {
                embeddings: metrics?.embeddings,
                insights: metrics?.insights,
                normalization: metrics?.normalization,
              },
              llm: typeof metrics?.llm === 'object' && 'size' in metrics.llm
                ? Object.fromEntries(metrics.llm.entries())
                : metrics?.llm,
            },
            systemInfo: {
              timestamp: new Date().toISOString(),
              environment: process.env.NODE_ENV,
              nodeVersion: process.version,
              uptime: process.uptime(),
              memoryUsage: process.memoryUsage(),
            },
          }),
        },
      }

      logger.info('AI health check completed', {
        userId,
        overallStatus,
        totalLatency,
        servicesChecked: services.length,
      })

      return NextResponse.json(response)

    } catch (error) {
      logger.error('AI health check error', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json({
        success: false,
        data: {
          overall: {
            status: 'unhealthy',
            error: 'Health check failed',
            checkTime: new Date().toISOString(),
          },
        },
        error: 'Failed to perform health check',
      }, { status: 500 })
    }
  })
)

export async function GET(req: NextRequest) {
  return getHandler(req)
}

// POST /api/ai/health/test - Test specific AI service functionality
const postHandler = withErrorHandler(
  withAuth(async (req) => {
    const userId = getUserId(req)
    const body = await req.json()

    const service = body.service as 'chat' | 'embeddings' | 'insights' | 'normalization'
    const testData = body.testData

    logger.info('AI service test requested', {
      userId,
      service,
      hasTestData: !!testData,
    })

    if (!service) {
      return NextResponse.json(
        { success: false, error: 'Service parameter is required' },
        { status: 400 }
      )
    }

    const startTime = Date.now()
    
    try {
      let testResult: any = null

      switch (service) {
        case 'chat':
          testResult = await aiService.sendChatMessage(
            testData?.message || 'Hello, this is a health check test.',
            {
              userId,
              sessionId: 'health-check',
            },
            { provider: 'direct' }
          )
          break

        case 'embeddings':
          testResult = await aiService.generateEmbedding(
            testData?.text || 'This is a test embedding.',
            { useCache: false }
          )
          break

        case 'insights':
          const testAccount = testData?.account || {
            id: 'test-account',
            name: 'Test Company',
            industry: 'Technology',
            size: 'medium',
            technologies: [
              { name: 'React', category: 'frontend', confidence: 0.9 },
              { name: 'Node.js', category: 'backend', confidence: 0.8 },
            ],
            contacts: [
              { name: 'John Doe', title: 'CTO', department: 'Engineering' },
            ],
          }

          testResult = await aiService.generateInsights(
            { accountData: testAccount },
            { maxInsights: 2, useCache: false, userId }
          )
          break

        case 'normalization':
          const testCompanyData = testData?.data || {
            name: 'acme corp.',
            industry: 'tech',
            size: '100-500',
            location: 'sf bay area',
          }

          testResult = await aiService.normalizeCompanyData(
            testCompanyData,
            { useCache: false, userId }
          )
          break

        default:
          return NextResponse.json(
            { success: false, error: 'Invalid service specified' },
            { status: 400 }
          )
      }

      const testLatency = Date.now() - startTime

      logger.info('AI service test completed', {
        userId,
        service,
        testLatency,
        success: true,
      })

      return NextResponse.json({
        success: true,
        data: {
          service,
          testLatency,
          result: testResult,
          testTime: new Date().toISOString(),
          status: 'passed',
        },
      })

    } catch (error) {
      const testLatency = Date.now() - startTime

      logger.error('AI service test failed', {
        userId,
        service,
        testLatency,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json({
        success: false,
        data: {
          service,
          testLatency,
          testTime: new Date().toISOString(),
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }, { status: 500 })
    }
  })
)

export async function POST(req: NextRequest) {
  return postHandler(req)
}

// PUT /api/ai/health/reset - Reset service metrics and caches
const putHandler = withErrorHandler(
  withAuth(async (req) => {
    const userId = getUserId(req)
    const body = await req.json()

    const resetMetrics = body.resetMetrics !== false
    const clearCaches = body.clearCaches !== false
    const service = body.service // Optional: specific service

    logger.info('AI service reset requested', {
      userId,
      resetMetrics,
      clearCaches,
      service,
    })

    try {
      if (resetMetrics) {
        aiService.resetMetrics(service)
        logger.info('AI service metrics reset', { userId, service })
      }

      if (clearCaches) {
        aiService.clearCaches(service as any)
        logger.info('AI service caches cleared', { userId, service })
      }

      return NextResponse.json({
        success: true,
        data: {
          resetMetrics,
          clearCaches,
          service: service || 'all',
          resetTime: new Date().toISOString(),
        },
      })

    } catch (error) {
      logger.error('AI service reset error', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { success: false, error: 'Failed to reset AI services' },
        { status: 500 }
      )
    }
  })
)

export async function PUT(req: NextRequest) {
  return putHandler(req)
}

// DELETE /api/ai/health/cache - Clear specific cache
const deleteHandler = withErrorHandler(
  withAuth(async (req) => {
    const userId = getUserId(req)
    const url = new URL(req.url)
    
    const cacheType = url.searchParams.get('type') as 'embeddings' | 'insights' | 'normalization'
    const pattern = url.searchParams.get('pattern')

    if (!cacheType) {
      return NextResponse.json(
        { success: false, error: 'Cache type parameter is required' },
        { status: 400 }
      )
    }

    logger.info('AI cache clear requested', {
      userId,
      cacheType,
      pattern,
    })

    try {
      aiService.clearCaches(cacheType)

      logger.info('AI cache cleared', {
        userId,
        cacheType,
        pattern,
      })

      return NextResponse.json({
        success: true,
        data: {
          cacheType,
          pattern,
          clearedAt: new Date().toISOString(),
        },
      })

    } catch (error) {
      logger.error('AI cache clear error', {
        userId,
        cacheType,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { success: false, error: 'Failed to clear cache' },
        { status: 500 }
      )
    }
  })
)

export async function DELETE(req: NextRequest) {
  return deleteHandler(req)
}