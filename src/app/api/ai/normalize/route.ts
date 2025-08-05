/**
 * AI Data Normalization API Route
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { aiService } from '@/lib/ai/ai-service'
import { logger } from '@/lib/logger'
import { withAuth, getUserId } from '@/lib/middleware/auth'
import { withErrorHandler } from '@/lib/middleware/error-handler'

// Validation schemas
const normalizeCompanySchema = z.object({
  data: z.record(z.any()),
  strictMode: z.boolean().optional().default(false),
  useCache: z.boolean().optional().default(true),
})

const normalizeContactsSchema = z.object({
  contacts: z.array(z.record(z.any())),
  deduplication: z.boolean().optional().default(true),
  useCache: z.boolean().optional().default(true),
})

const normalizeTechnologiesSchema = z.object({
  technologies: z.array(z.object({
    name: z.string(),
    category: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
  })),
  standardizeNames: z.boolean().optional().default(true),
  categorize: z.boolean().optional().default(true),
})

const normalizeCustomSchema = z.object({
  data: z.record(z.any()),
  schema: z.record(z.any()).optional(),
  rules: z.array(z.object({
    field: z.string(),
    rule: z.string(),
    options: z.record(z.any()).optional(),
  })).optional(),
  useCache: z.boolean().optional().default(true),
})

// POST /api/ai/normalize/company - Normalize company data
export const POST = withErrorHandler(
  withAuth(async (req) => {
    const userId = getUserId(req)
    const body = await req.json()

    const { data, strictMode, useCache } = normalizeCompanySchema.parse(body)

    logger.info('Normalizing company data', {
      userId,
      fieldsCount: Object.keys(data).length,
      strictMode,
    })

    try {
      const result = await aiService.normalizeCompanyData(data, {
        strictMode,
        useCache,
        userId,
      })

      logger.info('Company data normalized', {
        userId,
        confidence: result.confidence,
        issuesCount: result.issues?.length || 0,
      })

      return NextResponse.json({
        success: true,
        data: result,
      })

    } catch (error) {
      logger.error('Company normalization error', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      if (error instanceof Error && error.message.includes('Rate limit exceeded')) {
        return NextResponse.json(
          { success: false, error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        )
      }

      return NextResponse.json(
        { success: false, error: 'Failed to normalize company data.' },
        { status: 500 }
      )
    }
  })
)

// POST /api/ai/normalize/contacts - Normalize contact data
export const PUT = withErrorHandler(
  withAuth(async (req) => {
    const userId = getUserId(req)
    const body = await req.json()

    const { contacts, deduplication, useCache } = normalizeContactsSchema.parse(body)

    logger.info('Normalizing contacts', {
      userId,
      contactCount: contacts.length,
      deduplication,
    })

    try {
      const result = await aiService.normalizeContactData(contacts, {
        deduplication,
        useCache,
        userId,
      })

      logger.info('Contacts normalized', {
        userId,
        originalCount: contacts.length,
        normalizedCount: result.normalized.length,
        duplicatesFound: result.duplicates.length,
        issuesCount: result.issues.length,
      })

      return NextResponse.json({
        success: true,
        data: result,
      })

    } catch (error) {
      logger.error('Contacts normalization error', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { success: false, error: 'Failed to normalize contact data.' },
        { status: 500 }
      )
    }
  })
)

// PATCH /api/ai/normalize/technologies - Normalize technology data
export const PATCH = withErrorHandler(
  withAuth(async (req) => {
    const userId = getUserId(req)
    const body = await req.json()

    const { technologies, standardizeNames, categorize } = normalizeTechnologiesSchema.parse(body)

    logger.info('Normalizing technologies', {
      userId,
      technologyCount: technologies.length,
      standardizeNames,
      categorize,
    })

    try {
      const result = await aiService.normalizeTechnologyData(technologies, {
        standardizeNames,
        categorize,
        userId,
      })

      logger.info('Technologies normalized', {
        userId,
        originalCount: technologies.length,
        normalizedCount: result.normalized.length,
        suggestionsCount: result.suggestions.length,
      })

      return NextResponse.json({
        success: true,
        data: result,
      })

    } catch (error) {
      logger.error('Technologies normalization error', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { success: false, error: 'Failed to normalize technology data.' },
        { status: 500 }
      )
    }
  })
)

// POST /api/ai/normalize/custom - Normalize custom data with schema
export const DELETE = withErrorHandler(
  withAuth(async (req) => {
    const userId = getUserId(req)
    const body = await req.json()

    const { data, schema, rules, useCache } = normalizeCustomSchema.parse(body)

    logger.info('Normalizing custom data', {
      userId,
      fieldsCount: Object.keys(data).length,
      hasSchema: !!schema,
      rulesCount: rules?.length || 0,
    })

    try {
      const request = {
        data,
        schema,
        rules,
      }

      const result = await aiService.normalizeWithSchema(request, {
        useCache,
        userId,
      })

      logger.info('Custom data normalized', {
        userId,
        confidence: result.confidence,
        issuesCount: result.issues?.length || 0,
      })

      return NextResponse.json({
        success: true,
        data: result,
      })

    } catch (error) {
      logger.error('Custom normalization error', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { success: false, error: 'Failed to normalize custom data.' },
        { status: 500 }
      )
    }
  })
)

// GET /api/ai/normalize - Get normalization examples and documentation
export const GET = withErrorHandler(
  withAuth(async (req) => {
    const url = new URL(req.url)
    const type = url.searchParams.get('type')

    const examples = {
      company: {
        description: 'Normalize company information including name, industry, size, location, etc.',
        input: {
          name: 'acme corp.',
          industry: 'tech',
          size: '200-500 employees',
          location: 'sf, ca',
          website: 'acme.com',
        },
        output: {
          name: 'Acme Corp',
          industry: 'Technology',
          size: 'medium',
          location: 'San Francisco, CA',
          website: 'https://acme.com',
        },
        endpoint: 'POST /api/ai/normalize/company',
      },
      contacts: {
        description: 'Normalize contact information and detect duplicates',
        input: [
          { name: 'john doe', email: 'john@acme.com', title: 'cto' },
          { name: 'John D.', email: 'j.doe@acme.com', title: 'Chief Technology Officer' },
        ],
        output: {
          normalized: [
            { name: 'John Doe', email: 'john@acme.com', title: 'Chief Technology Officer' },
          ],
          duplicates: [{ indices: [0, 1], confidence: 0.95 }],
        },
        endpoint: 'PUT /api/ai/normalize/contacts',
      },
      technologies: {
        description: 'Normalize and categorize technology names',
        input: [
          { name: 'reactjs', category: 'frontend' },
          { name: 'node.js' },
          { name: 'postgres' },
        ],
        output: {
          normalized: [
            { name: 'reactjs', standardName: 'React', category: 'frontend', confidence: 0.98 },
            { name: 'node.js', standardName: 'Node.js', category: 'backend', confidence: 0.95 },
            { name: 'postgres', standardName: 'PostgreSQL', category: 'database', confidence: 0.97 },
          ],
        },
        endpoint: 'PATCH /api/ai/normalize/technologies',
      },
      custom: {
        description: 'Normalize custom data with provided schema and rules',
        input: {
          data: { phone: '415.555.1234', date: '2023-12-01' },
          schema: { phone: 'string', date: 'datetime' },
          rules: [{ field: 'phone', rule: 'format_phone_us' }],
        },
        output: {
          normalized: { phone: '+1 (415) 555-1234', date: '2023-12-01T00:00:00Z' },
          confidence: 0.92,
        },
        endpoint: 'DELETE /api/ai/normalize/custom',
      },
    }

    if (type && type in examples) {
      return NextResponse.json({
        success: true,
        data: examples[type as keyof typeof examples],
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        description: 'AI-powered data normalization service',
        availableTypes: Object.keys(examples),
        examples,
        rateLimits: {
          requestsPerMinute: 50,
          requestsPerHour: 1000,
          requestsPerDay: 5000,
        },
      },
    })
  })
)