/**
 * Chat Streaming API Route - Dedicated streaming endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { aiService } from '@/lib/ai/ai-service'
import { logger } from '@/lib/logger'
import { withAuth, getUserId } from '@/lib/middleware/auth'
import { withErrorHandler } from '@/lib/middleware/error-handler'
import { withChatRateLimit } from '@/lib/middleware/rate-limit'
import { prisma } from '@/lib/prisma'

// Validation schema
const streamChatSchema = z.object({
  message: z.string().min(1).max(4000),
  sessionId: z.string().cuid(),
  context: z.object({
    accountId: z.string().cuid().optional(),
    accountName: z.string().optional(),
  }).optional(),
  provider: z.enum(['flowise', 'direct']).optional().default('flowise'),
})

// POST /api/chat/stream - Stream chat responses
const postHandler = withErrorHandler(
  withChatRateLimit(
    withAuth(async (req) => {
      const userId = getUserId(req)
      const body = await req.json()
      
      const { message, sessionId, context, provider } = streamChatSchema.parse(body)

      logger.info('Chat streaming started', {
        userId,
        sessionId,
        messageLength: message.length,
        provider,
      })

      try {
        // Verify session exists and belongs to user
        const session = await prisma.chatSession.findFirst({
          where: {
            id: sessionId,
            userId,
          },
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              take: 20, // Last 20 messages for context
            },
          },
        })

        if (!session) {
          return NextResponse.json(
            { success: false, error: 'Chat session not found' },
            { status: 404 }
          )
        }

        // Save user message
        const userMessage = await prisma.chatMessage.create({
          data: {
            sessionId: session.id,
            role: 'USER',
            content: message,
            metadata: context || {},
          },
        })

        // Prepare context for AI service
        const chatContext = {
          userId,
          sessionId: session.id,
          accountId: context?.accountId,
          accountName: context?.accountName,
          previousMessages: session.messages.map(msg => ({
            role: msg.role.toLowerCase() as 'system' | 'user' | 'assistant',
            content: msg.content,
            metadata: msg.metadata,
          })),
        }

        // Create streaming response
        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder()
            let fullResponse = ''
            let messageId: string | null = null

            const sendData = (data: any) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
            }

            const sendError = (error: string) => {
              sendData({ type: 'error', error })
              controller.close()
            }

            const sendComplete = () => {
              sendData({ type: 'done' })
              controller.close()
            }

            try {
              // Send initial acknowledgment
              sendData({ 
                type: 'start', 
                sessionId: session.id,
                userMessageId: userMessage.id
              })

              await aiService.streamChatMessage(
                message,
                chatContext,
                {
                  onToken: (token: string) => {
                    fullResponse += token
                    sendData({
                      type: 'token',
                      content: token,
                      fullContent: fullResponse,
                    })
                  },
                  onComplete: async (response: string) => {
                    try {
                      // Save assistant message
                      const assistantMessage = await prisma.chatMessage.create({
                        data: {
                          sessionId: session.id,
                          role: 'ASSISTANT',
                          content: response,
                          metadata: {
                            provider,
                            model: provider === 'flowise' ? 'flowise' : 'direct',
                            timestamp: new Date().toISOString(),
                            streaming: true,
                          },
                        },
                      })

                      messageId = assistantMessage.id

                      // Update session timestamp
                      await prisma.chatSession.update({
                        where: { id: session.id },
                        data: { updatedAt: new Date() },
                      })

                      sendData({
                        type: 'complete',
                        content: response,
                        messageId: assistantMessage.id,
                        sessionId: session.id,
                      })

                      logger.info('Chat streaming completed', {
                        userId,
                        sessionId: session.id,
                        messageId: assistantMessage.id,
                        responseLength: response.length,
                      })

                      sendComplete()

                    } catch (dbError) {
                      logger.error('Database error during streaming completion', {
                        userId,
                        sessionId: session.id,
                        error: dbError instanceof Error ? dbError.message : 'Unknown error',
                      })
                      sendError('Failed to save response')
                    }
                  },
                  onError: (error: Error) => {
                    logger.error('Chat streaming error', {
                      userId,
                      sessionId: session.id,
                      error: error.message,
                    })
                    sendError(error.message || 'Unknown streaming error')
                  },
                },
                { sessionId: session.id, provider }
              )

            } catch (error) {
              logger.error('Chat streaming setup error', {
                userId,
                sessionId: session.id,
                error: error instanceof Error ? error.message : 'Unknown error',
              })
              sendError('Failed to initialize streaming')
            }
          },

          cancel() {
            logger.info('Chat streaming cancelled', {
              userId,
              sessionId,
            })
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control, Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          },
        })

      } catch (error) {
        logger.error('Chat streaming API error', {
          userId,
          sessionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })

        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Invalid request data',
              details: error.errors,
            },
            { status: 400 }
          )
        }

        if (error instanceof Error && error.message.includes('Rate limit exceeded')) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Rate limit exceeded. Please try again later.' 
            },
            { status: 429 }
          )
        }

        return NextResponse.json(
          { 
            success: false, 
            error: 'Failed to initialize streaming. Please try again.' 
          },
          { status: 500 }
        )
      }
    })
  )
)

export async function POST(req: NextRequest) {
  return postHandler(req)
}

// GET /api/chat/stream - Get streaming status or test endpoint
const getHandler = withAuth(async (req) => {
  const userId = getUserId(req)
  const url = new URL(req.url)
  const sessionId = url.searchParams.get('sessionId')

  if (!sessionId) {
    return NextResponse.json({
      success: true,
      message: 'Chat streaming endpoint is available',
      timestamp: new Date().toISOString(),
    })
  }

  try {
    // Check if session exists and belongs to user
    const session = await prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        _count: {
          select: { messages: true },
        },
      },
    })

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        title: session.title,
        messageCount: session._count.messages,
        lastActivity: session.updatedAt,
      },
    })

  } catch (error) {
    logger.error('Chat streaming status error', {
      userId,
      sessionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      { success: false, error: 'Failed to get session status' },
      { status: 500 }
    )
  }
})

export async function GET(req: NextRequest) {
  return getHandler(req)
}

// OPTIONS - Handle CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}