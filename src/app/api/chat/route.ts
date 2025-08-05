/**
 * Chat API Route - Main chat endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { aiService } from '@/lib/ai/ai-service'
import { logger } from '@/lib/logger'
import { withAuth, getUserId } from '@/lib/middleware/auth'
import { withErrorHandler } from '@/lib/middleware/error-handler'
import { withChatRateLimit } from '@/lib/middleware/rate-limit'
import { prisma } from '@/lib/prisma'

// Validation schemas
const chatMessageSchema = z.object({
  message: z.string().min(1).max(4000),
  sessionId: z.string().cuid().optional(),
  context: z.object({
    accountId: z.string().cuid().optional(),
    accountName: z.string().optional(),
  }).optional(),
  streaming: z.boolean().optional().default(false),
  provider: z.enum(['flowise', 'direct']).optional(),
})

// POST /api/chat - Send chat message
export const POST = withErrorHandler(
  withChatRateLimit(
    withAuth(async (req) => {
      const userId = getUserId(req)
      const body = await req.json()
      
      const { message, sessionId, context, streaming, provider } = chatMessageSchema.parse(body)

      logger.info('Chat message received', {
        userId,
        sessionId,
        messageLength: message.length,
        hasContext: !!context,
        streaming,
        provider,
      })

      try {
        // Get or create chat session
        let session
        if (sessionId) {
          session = await prisma.chatSession.findFirst({
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
            throw new Error('Chat session not found')
          }
        } else {
          // Create new session
          const title = context?.accountName 
            ? `Chat about ${context.accountName}`
            : `Chat Session ${new Date().toLocaleDateString()}`

          session = await prisma.chatSession.create({
            data: {
              title,
              context: context || {},
              userId,
            },
            include: {
              messages: true,
            },
          })
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

        // Handle streaming vs non-streaming
        if (streaming) {
          // For streaming, we'll use Server-Sent Events
          return new Response(
            new ReadableStream({
              async start(controller) {
                const encoder = new TextEncoder()
                let fullResponse = ''

                try {
                  await aiService.streamChatMessage(
                    message,
                    chatContext,
                    {
                      onToken: (token: string) => {
                        fullResponse += token
                        controller.enqueue(
                          encoder.encode(`data: ${JSON.stringify({ 
                            type: 'token', 
                            content: token,
                            fullContent: fullResponse
                          })}\n\n`)
                        )
                      },
                      onComplete: async (response: string) => {
                        // Save assistant message
                        await prisma.chatMessage.create({
                          data: {
                            sessionId: session.id,
                            role: 'ASSISTANT',
                            content: response,
                            metadata: {
                              provider,
                              model: 'flowise',
                              timestamp: new Date().toISOString(),
                            },
                          },
                        })

                        controller.enqueue(
                          encoder.encode(`data: ${JSON.stringify({ 
                            type: 'complete', 
                            content: response,
                            sessionId: session.id,
                            messageId: userMessage.id
                          })}\n\n`)
                        )
                        controller.close()
                      },
                      onError: (error: Error) => {
                        logger.error('Chat streaming error', { 
                          userId, 
                          sessionId: session.id, 
                          error: error.message 
                        })
                        controller.enqueue(
                          encoder.encode(`data: ${JSON.stringify({ 
                            type: 'error', 
                            error: error.message 
                          })}\n\n`)
                        )
                        controller.close()
                      },
                    },
                    { sessionId: session.id, provider }
                  )
                } catch (error) {
                  logger.error('Chat streaming setup error', { 
                    userId, 
                    sessionId: session.id, 
                    error: error instanceof Error ? error.message : 'Unknown error'
                  })
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ 
                      type: 'error', 
                      error: 'Failed to start streaming' 
                    })}\n\n`)
                  )
                  controller.close()
                }
              },
            }),
            {
              headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control',
              },
            }
          )
        } else {
          // Non-streaming response
          const response = await aiService.sendChatMessage(
            message,
            chatContext,
            { sessionId: session.id, provider }
          )

          // Save assistant message
          const assistantMessage = await prisma.chatMessage.create({
            data: {
              sessionId: session.id,
              role: 'ASSISTANT',
              content: response.content,
              metadata: {
                provider,
                model: response.model,
                usage: response.usage,
                finishReason: response.finishReason,
                ...response.metadata,
              },
            },
          })

          // Update session
          await prisma.chatSession.update({
            where: { id: session.id },
            data: { updatedAt: new Date() },
          })

          logger.info('Chat message processed', {
            userId,
            sessionId: session.id,
            messageId: userMessage.id,
            assistantMessageId: assistantMessage.id,
            responseLength: response.content.length,
            provider,
          })

          return NextResponse.json({
            success: true,
            data: {
              sessionId: session.id,
              messageId: userMessage.id,
              response: {
                id: assistantMessage.id,
                content: response.content,
                metadata: response.metadata,
                usage: response.usage,
              },
              suggestions: generateSuggestions(message, context),
            },
          })
        }

      } catch (error) {
        logger.error('Chat API error', {
          userId,
          sessionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })

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
            error: 'Failed to process chat message. Please try again.' 
          },
          { status: 500 }
        )
      }
    })
  )
)

/**
 * Generate contextual suggestions based on the message and context
 */
function generateSuggestions(
  message: string,
  context?: { accountId?: string; accountName?: string }
): string[] {
  const lowerMessage = message.toLowerCase()

  if (context?.accountName) {
    // Account-specific suggestions
    if (lowerMessage.includes('technology') || lowerMessage.includes('tech')) {
      return [
        `What are the key decision makers at ${context.accountName}?`,
        `Show me competitors to ${context.accountName}`,
        `What are the main challenges for ${context.accountName}?`,
        `Create an outreach strategy for ${context.accountName}`,
      ]
    }

    if (lowerMessage.includes('contact') || lowerMessage.includes('decision')) {
      return [
        `What's the best time to reach out to ${context.accountName}?`,
        `Show me similar companies to ${context.accountName}`,
        `What's the technology stack at ${context.accountName}?`,
        `Generate talking points for ${context.accountName}`,
      ]
    }

    return [
      `Tell me more about ${context.accountName}'s industry`,
      `What are the growth indicators for ${context.accountName}?`,
      `Show me recent news about ${context.accountName}`,
      `Help me prioritize ${context.accountName} in my pipeline`,
    ]
  }

  // General suggestions
  if (lowerMessage.includes('account') || lowerMessage.includes('company')) {
    return [
      'Show me accounts with the highest potential',
      'What are the trending technologies this quarter?',
      'Help me identify warm leads',
      'Generate a market intelligence report',
    ]
  }

  if (lowerMessage.includes('insight') || lowerMessage.includes('analysis')) {
    return [
      'Show me accounts ready for outreach',
      'What industries should I focus on?',
      'Find accounts with recent funding',
      'Identify accounts with technology gaps',
    ]
  }

  return [
    'Analyze my top accounts',
    'Show me market trends',
    'Help me prioritize my pipeline',
    'Generate prospecting insights',
  ]
}