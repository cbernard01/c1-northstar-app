import { NextRequest, NextResponse } from 'next/server';

import { withAuth, getUserId, checkResourceOwnership } from '@/lib/middleware/auth';
import { withErrorHandler, NotFoundError, ForbiddenError } from '@/lib/middleware/error-handler';
import { withJobsRateLimit } from '@/lib/middleware/rate-limit';
import { prisma } from '@/lib/prisma';
import { QueueManager } from '@/lib/queue';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/jobs/[id] - Get job details
export const GET = withErrorHandler(
  withJobsRateLimit(
    withAuth(async (req: NextRequest, context: RouteContext) => {
      const userId = getUserId(req);
      const { id } = await context.params;

      // Check if user owns this job
      const hasAccess = await checkResourceOwnership(userId, id, 'job');
      if (!hasAccess) {
        throw new ForbiddenError('You do not have access to this job');
      }

      const job = await prisma.job.findUnique({
        where: { id },
        include: {
          uploads: {
            select: {
              id: true,
              fileName: true,
              fileType: true,
              status: true,
              progress: true,
            },
          },
        },
      });

      if (!job) {
        throw new NotFoundError('Job');
      }

      return NextResponse.json(job);
    })
  )
);

// DELETE /api/jobs/[id] - Cancel job
export const DELETE = withErrorHandler(
  withJobsRateLimit(
    withAuth(async (req: NextRequest, context: RouteContext) => {
      const userId = getUserId(req);
      const { id } = await context.params;

      // Check if user owns this job
      const hasAccess = await checkResourceOwnership(userId, id, 'job');
      if (!hasAccess) {
        throw new ForbiddenError('You do not have access to this job');
      }

      const job = await prisma.job.findUnique({
        where: { id },
        select: { id: true, status: true, type: true },
      });

      if (!job) {
        throw new NotFoundError('Job');
      }

      // Can only cancel queued or running jobs
      if (!['QUEUED', 'RUNNING'].includes(job.status)) {
        return NextResponse.json(
          { error: 'Job cannot be cancelled', message: 'Only queued or running jobs can be cancelled' },
          { status: 400 }
        );
      }

      // Remove from queue based on job type
      try {
        const queueName = getQueueNameFromJobType(job.type);
        await QueueManager.removeJob(id, queueName);
      } catch (error) {
        console.error('Failed to remove job from queue:', error);
      }

      // Update job status
      await prisma.job.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({ message: 'Job cancelled successfully' });
    })
  )
);

// Helper function to get queue name from job type
function getQueueNameFromJobType(jobType: string): string {
  const { QUEUE_NAMES } = require('@/lib/queue');
  
  switch (jobType) {
    case 'FILE_PROCESSING':
      return QUEUE_NAMES.FILE_PROCESSING;
    case 'ACCOUNT_ANALYSIS':
      return QUEUE_NAMES.ACCOUNT_ANALYSIS;
    case 'INSIGHT_GENERATION':
      return QUEUE_NAMES.INSIGHT_GENERATION;
    case 'DATA_EXPORT':
      return QUEUE_NAMES.DATA_EXPORT;
    default:
      return QUEUE_NAMES.FILE_PROCESSING; // fallback
  }
}