/**
 * AI Insights API Route
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { aiService } from '@/lib/ai/ai-service'
import { logger } from '@/lib/logger'
import { withAuth, getUserId } from '@/lib/middleware/auth'
import { withErrorHandler } from '@/lib/middleware/error-handler'
import { prisma } from '@/lib/prisma'

// Validation schemas
const generateInsightsSchema = z.object({
  accountId: z.string().cuid(),
  analysisType: z.enum(['technical', 'business', 'competitive', 'all']).optional().default('all'),
  focusAreas: z.array(z.string()).optional(),
  maxInsights: z.number().min(1).max(10).optional().default(5),
  useCache: z.boolean().optional().default(true),
})

const realtimeInsightsSchema = z.object({
  accountId: z.string().cuid(),
  changes: z.array(z.object({
    type: z.enum(['technology', 'contact', 'funding', 'news']),
    description: z.string(),
    timestamp: z.string().datetime(),
    source: z.string(),
  })),
})

// POST /api/ai/insights - Generate insights for an account
export const POST = withErrorHandler(
  withAuth(async (req) => {
    const userId = getUserId(req)
    const body = await req.json()

    const { accountId, analysisType, focusAreas, maxInsights, useCache } = generateInsightsSchema.parse(body)

    logger.info('Generating insights', {
      userId,
      accountId,
      analysisType,
      focusAreas,
      maxInsights,
    })

    try {
      // Get account data
      const account = await prisma.companyAccount.findUnique({
        where: { id: accountId },
        include: {
          technologies: true,
          contacts: true,
          insights: {
            where: {
              createdAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
              },
            },
            orderBy: { confidence: 'desc' },
            take: 3,
          },
        },
      })

      if (!account) {
        return NextResponse.json(
          { success: false, error: 'Account not found' },
          { status: 404 }
        )
      }

      // Prepare insight generation request
      const request = {
        accountData: {
          id: account.id,
          name: account.name,
          domain: account.domain,
          industry: account.industry,
          size: account.size,
          technologies: account.technologies.map(tech => ({
            name: tech.name,
            category: tech.category,
            confidence: tech.confidence,
          })),
          contacts: account.contacts.map(contact => ({
            name: contact.name,
            title: contact.title,
            department: contact.department,
          })),
        },
        context: {
          analysisType,
          focusAreas,
        },
      }

      // Generate insights
      const insights = await aiService.generateInsights(request, {
        maxInsights,
        useCache,
        userId,
      })

      // Save insights to database
      const savedInsights = await Promise.all(
        insights.map(insight => 
          prisma.insight.create({
            data: {
              accountId: account.id,
              type: insight.type,
              title: insight.title,
              description: insight.description,
              confidence: insight.confidence,
              category: insight.category,
              tags: insight.tags,
              metadata: {
                ...insight.metadata,
                suggestedActions: insight.suggestedActions,
                generatedBy: 'ai',
                userId,
              },
            },
          })
        )
      )

      logger.info('Insights generated and saved', {
        userId,
        accountId,
        insightCount: savedInsights.length,
      })

      return NextResponse.json({
        success: true,
        data: {
          accountId,
          insights: savedInsights.map(insight => ({
            id: insight.id,
            type: insight.type,
            title: insight.title,
            description: insight.description,
            confidence: insight.confidence,
            category: insight.category,
            tags: insight.tags,
            suggestedActions: insight.metadata?.suggestedActions || [],
            createdAt: insight.createdAt,
          })),
          metadata: {
            analysisType,
            totalGenerated: insights.length,
            totalSaved: savedInsights.length,
          },
        },
      })

    } catch (error) {
      logger.error('Insights generation error', {
        userId,
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      if (error instanceof Error && error.message.includes('Rate limit exceeded')) {
        return NextResponse.json(
          { success: false, error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        )
      }

      return NextResponse.json(
        { success: false, error: 'Failed to generate insights. Please try again.' },
        { status: 500 }
      )
    }
  })
)

// POST /api/ai/insights/realtime - Generate real-time insights
export const PUT = withErrorHandler(
  withAuth(async (req) => {
    const userId = getUserId(req)
    const body = await req.json()

    const { accountId, changes } = realtimeInsightsSchema.parse(body)

    logger.info('Generating real-time insights', {
      userId,
      accountId,
      changeCount: changes.length,
    })

    try {
      // Verify account exists
      const account = await prisma.companyAccount.findUnique({
        where: { id: accountId },
        select: { id: true, name: true },
      })

      if (!account) {
        return NextResponse.json(
          { success: false, error: 'Account not found' },
          { status: 404 }
        )
      }

      // Convert changes to expected format
      const recentChanges = changes.map(change => ({
        type: change.type as 'technology' | 'contact' | 'funding' | 'news',
        description: change.description,
        timestamp: new Date(change.timestamp),
        source: change.source,
      }))

      // Generate real-time insights
      const insights = await aiService.generateRealtimeInsights(
        accountId,
        recentChanges,
        { userId }
      )

      // Save insights to database
      const savedInsights = await Promise.all(
        insights.map(insight => 
          prisma.insight.create({
            data: {
              accountId: account.id,
              type: insight.type,
              title: insight.title,
              description: insight.description,
              confidence: insight.confidence,
              category: insight.category,
              tags: [...insight.tags, 'real-time', 'time-sensitive'],
              metadata: {
                ...insight.metadata,
                suggestedActions: insight.suggestedActions,
                generatedBy: 'ai-realtime',
                userId,
                recentChanges: changes,
              },
            },
          })
        )
      )

      logger.info('Real-time insights generated', {
        userId,
        accountId,
        insightCount: savedInsights.length,
      })

      return NextResponse.json({
        success: true,
        data: {
          accountId,
          insights: savedInsights.map(insight => ({
            id: insight.id,
            type: insight.type,
            title: insight.title,
            description: insight.description,
            confidence: insight.confidence,
            category: insight.category,
            tags: insight.tags,
            suggestedActions: insight.metadata?.suggestedActions || [],
            timeSensitive: true,
            expiresAt: insight.metadata?.expiresAt,
            createdAt: insight.createdAt,
          })),
          metadata: {
            changeCount: changes.length,
            totalGenerated: insights.length,
            totalSaved: savedInsights.length,
          },
        },
      })

    } catch (error) {
      logger.error('Real-time insights error', {
        userId,
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { success: false, error: 'Failed to generate real-time insights.' },
        { status: 500 }
      )
    }
  })
)

// GET /api/ai/insights - Get recent insights for accounts
export const GET = withErrorHandler(
  withAuth(async (req) => {
    const userId = getUserId(req)
    const url = new URL(req.url)
    
    const accountId = url.searchParams.get('accountId')
    const category = url.searchParams.get('category') as 'technical' | 'business' | 'competitive' | null
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50)
    const timeSensitive = url.searchParams.get('timeSensitive') === 'true'

    try {
      const where: any = {}
      
      if (accountId) {
        where.accountId = accountId
      }
      
      if (category) {
        where.category = category
      }

      if (timeSensitive) {
        where.tags = {
          hasEvery: ['time-sensitive'],
        }
        where.createdAt = {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        }
      }

      const insights = await prisma.insight.findMany({
        where,
        include: {
          account: {
            select: {
              id: true,
              name: true,
              domain: true,
              industry: true,
            },
          },
        },
        orderBy: [
          { confidence: 'desc' },
          { createdAt: 'desc' },
        ],
        take: limit,
      })

      return NextResponse.json({
        success: true,
        data: {
          insights: insights.map(insight => ({
            id: insight.id,
            type: insight.type,
            title: insight.title,
            description: insight.description,
            confidence: insight.confidence,
            category: insight.category,
            tags: insight.tags,
            isBookmarked: insight.isBookmarked,
            account: insight.account,
            suggestedActions: insight.metadata?.suggestedActions || [],
            timeSensitive: insight.tags.includes('time-sensitive'),
            expiresAt: insight.metadata?.expiresAt,
            createdAt: insight.createdAt,
          })),
          metadata: {
            total: insights.length,
            filters: {
              accountId,
              category,
              timeSensitive,
              limit,
            },
          },
        },
      })

    } catch (error) {
      logger.error('Get insights error', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { success: false, error: 'Failed to retrieve insights.' },
        { status: 500 }
      )
    }
  })
)