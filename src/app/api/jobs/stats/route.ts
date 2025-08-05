import { NextRequest, NextResponse } from 'next/server';

import { withAuth, getUserId } from '@/lib/middleware/auth';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { withJobsRateLimit } from '@/lib/middleware/rate-limit';
import { prisma } from '@/lib/prisma';
import { QueueManager } from '@/lib/queue';

// GET /api/jobs/stats - Get job statistics
export const GET = withErrorHandler(
  withJobsRateLimit(
    withAuth(async (req) => {
      const userId = getUserId(req);

      // Get database stats for user's jobs
      const [
        totalJobs,
        runningJobs,
        completedJobs,
        failedJobs,
        queuedJobs,
        pendingJobs,
      ] = await Promise.all([
        prisma.job.count({ where: { userId } }),
        prisma.job.count({ where: { userId, status: 'RUNNING' } }),
        prisma.job.count({ where: { userId, status: 'COMPLETED' } }),
        prisma.job.count({ where: { userId, status: 'FAILED' } }),
        prisma.job.count({ where: { userId, status: 'QUEUED' } }),
        prisma.job.count({ where: { userId, status: 'PENDING' } }),
      ]);

      // Get queue stats (system-wide)
      let queueStats;
      try {
        queueStats = await QueueManager.getJobStats();
      } catch (error) {
        console.error('Failed to get queue stats:', error);
        queueStats = {
          total: 0,
          running: 0,
          completed: 0,
          failed: 0,
          queued: 0,
          pending: 0,
        };
      }

      return NextResponse.json({
        user: {
          total: totalJobs,
          running: runningJobs,
          completed: completedJobs,
          failed: failedJobs,
          queued: queuedJobs,
          pending: pendingJobs,
        },
        system: queueStats,
      });
    })
  )
);