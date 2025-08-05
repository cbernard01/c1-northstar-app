import { JobType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

import { withAuth, getUserId, checkResourceOwnership } from '@/lib/middleware/auth';
import { withErrorHandler, NotFoundError, ForbiddenError } from '@/lib/middleware/error-handler';
import { withJobsRateLimit } from '@/lib/middleware/rate-limit';
import { prisma } from '@/lib/prisma';
import { QueueManager } from '@/lib/queue';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/jobs/[id]/retry - Retry failed job
export const POST = withErrorHandler(
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
        select: {
          id: true,
          type: true,
          status: true,
          metadata: true,
        },
      });

      if (!job) {
        throw new NotFoundError('Job');
      }

      // Can only retry failed jobs
      if (job.status !== 'FAILED') {
        return NextResponse.json(
          { error: 'Job cannot be retried', message: 'Only failed jobs can be retried' },
          { status: 400 }
        );
      }

      // Reset job status
      await prisma.job.update({
        where: { id },
        data: {
          status: 'QUEUED',
          progress: 0,
          errorMessage: null,
          updatedAt: new Date(),
        },
      });

      // Add job back to appropriate queue
      try {
        switch (job.type) {
          case JobType.ACCOUNT_ANALYSIS:
            if (job.metadata?.accountId) {
              await QueueManager.addAccountAnalysisJob(
                {
                  accountId: job.metadata.accountId,
                  userId,
                  analysisType: job.metadata.analysisType || 'full',
                },
                job.id
              );
            }
            break;
          case JobType.DATA_EXPORT:
            if (job.metadata?.exportConfig) {
              await QueueManager.addDataExportJob(
                {
                  exportType: job.metadata.exportConfig.type || 'accounts',
                  filters: job.metadata.exportConfig.filters || {},
                  format: job.metadata.exportConfig.format || 'csv',
                  userId,
                },
                job.id
              );
            }
            break;
          case JobType.INSIGHT_GENERATION:
            if (job.metadata?.accountId) {
              await QueueManager.addInsightGenerationJob(
                {
                  accountId: job.metadata.accountId,
                  userId,
                  contextData: job.metadata.contextData,
                },
                job.id
              );
            }
            break;
          case JobType.FILE_PROCESSING:
            if (job.metadata?.uploadId) {
              await QueueManager.addFileProcessingJob(
                {
                  uploadId: job.metadata.uploadId,
                  userId,
                  fileName: job.metadata.fileName || 'unknown',
                  fileType: job.metadata.fileType || 'unknown',
                  filePath: job.metadata.filePath || '',
                },
                job.id
              );
            }
            break;
        }
      } catch (queueError) {
        console.error('Failed to add retried job to queue:', queueError);
        // Update job status back to failed
        await prisma.job.update({
          where: { id },
          data: {
            status: 'FAILED',
            errorMessage: 'Failed to queue job for retry',
          },
        });
        
        return NextResponse.json(
          { error: 'Retry failed', message: 'Failed to queue job for retry' },
          { status: 500 }
        );
      }

      // Fetch updated job
      const updatedJob = await prisma.job.findUnique({
        where: { id },
        include: {
          uploads: {
            select: {
              id: true,
              fileName: true,
              fileType: true,
              status: true,
            },
          },
        },
      });

      return NextResponse.json(updatedJob);
    })
  )
);