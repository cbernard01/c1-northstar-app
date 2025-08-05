import { NextRequest, NextResponse } from 'next/server';

import { withAuth, getUserId } from '@/lib/middleware/auth';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { prisma } from '@/lib/prisma';

// GET /api/jobs/stream - Server-Sent Events for job updates
export const GET = withErrorHandler(
  withAuth(async (req) => {
    const userId = getUserId(req);

    // Set up Server-Sent Events
    const encoder = new TextEncoder();
    
    const customReadable = new ReadableStream({
      start(controller) {
        // Send initial connection message
        const data = `data: ${JSON.stringify({
          type: 'connected',
          message: 'Job updates stream connected',
          timestamp: new Date().toISOString(),
        })}\n\n`;
        
        controller.enqueue(encoder.encode(data));

        // Set up polling for job updates
        const pollInterval = setInterval(async () => {
          try {
            // Get recent job updates for this user
            const recentJobs = await prisma.job.findMany({
              where: {
                userId,
                updatedAt: {
                  gte: new Date(Date.now() - 30000), // Last 30 seconds
                },
              },
              orderBy: { updatedAt: 'desc' },
              take: 10,
              select: {
                id: true,
                status: true,
                progress: true,
                updatedAt: true,
                errorMessage: true,
                result: true,
              },
            });

            // Send updates if any
            for (const job of recentJobs) {
              const updateData = `data: ${JSON.stringify({
                type: 'job-update',
                data: {
                  id: job.id,
                  status: job.status.toLowerCase(),
                  progress: job.progress,
                  message: job.errorMessage || undefined,
                  result: job.result || undefined,
                },
                timestamp: job.updatedAt.toISOString(),
              })}\n\n`;
              
              controller.enqueue(encoder.encode(updateData));
            }

            // Send heartbeat every 30 seconds
            const heartbeat = `data: ${JSON.stringify({
              type: 'heartbeat',
              timestamp: new Date().toISOString(),
            })}\n\n`;
            
            controller.enqueue(encoder.encode(heartbeat));
          } catch (error) {
            console.error('Job stream polling error:', error);
            const errorData = `data: ${JSON.stringify({
              type: 'error',
              message: 'Failed to fetch job updates',
              timestamp: new Date().toISOString(),
            })}\n\n`;
            
            controller.enqueue(encoder.encode(errorData));
          }
        }, 5000); // Poll every 5 seconds

        // Clean up on close
        req.signal.addEventListener('abort', () => {
          clearInterval(pollInterval);
          controller.close();
        });
      },
    });

    return new Response(customReadable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });
  })
);