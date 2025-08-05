import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth, getUserId } from '@/lib/middleware/auth';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { withChatRateLimit } from '@/lib/middleware/rate-limit';
import { prisma } from '@/lib/prisma';

// Validation schemas
const createChatSessionSchema = z.object({
  title: z.string().max(200).optional(),
  context: z.object({
    accountId: z.string().cuid().optional(),
    accountName: z.string().optional(),
  }).optional(),
});

// GET /api/chat/sessions - List chat sessions
export const GET = withErrorHandler(
  withChatRateLimit(
    withAuth(async (req) => {
      const userId = getUserId(req);

      const sessions = await prisma.chatSession.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        include: {
          messages: {
            select: {
              id: true,
              role: true,
              content: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1, // Only get the last message for preview
          },
          _count: {
            select: { messages: true },
          },
        },
      });

      return NextResponse.json(sessions);
    })
  )
);

// POST /api/chat/sessions - Create new chat session
export const POST = withErrorHandler(
  withChatRateLimit(
    withAuth(async (req) => {
      const userId = getUserId(req);
      const body = await req.json();
      
      const { title, context } = createChatSessionSchema.parse(body);

      // Generate title if not provided
      const sessionTitle = title || `Chat Session ${new Date().toLocaleDateString()}`;

      const session = await prisma.chatSession.create({
        data: {
          title: sessionTitle,
          context: context || {},
          userId,
        },
        include: {
          messages: true,
          _count: {
            select: { messages: true },
          },
        },
      });

      return NextResponse.json(session, { status: 201 });
    })
  )
);