import { NextRequest, NextResponse } from 'next/server';

import { withAuth, getUserId } from '@/lib/middleware/auth';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { withAccountsRateLimit } from '@/lib/middleware/rate-limit';
import { getImportService } from '@/lib/services/import';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: {
    jobId: string;
  };
}

// GET /api/import/jobs/[jobId] - Get specific import job details
const getHandler = withErrorHandler(
  withAccountsRateLimit(
    withAuth(async (req: NextRequest, { params }: RouteParams) => {
      const userId = getUserId(req);
      const { jobId } = params;
      
      try {
        const importService = getImportService();
        const jobStatus = await importService.getJobStatus(jobId);

        // Verify user owns this job
        if (jobStatus.userId !== userId) {
          return NextResponse.json(
            { error: 'Forbidden', message: 'Job not found or access denied' },
            { status: 403 }
          );
        }

        // Calculate additional metrics
        const now = new Date();
        const elapsedTime = jobStatus.startedAt 
          ? now.getTime() - jobStatus.startedAt.getTime()
          : 0;

        let estimatedTimeRemaining = null;
        if (jobStatus.status === 'RUNNING' && jobStatus.progress > 0) {
          const estimatedTotal = (elapsedTime / jobStatus.progress) * 100;
          estimatedTimeRemaining = Math.max(0, estimatedTotal - elapsedTime);
        }

        const response = {
          ...jobStatus,
          metrics: {
            elapsedTime,
            estimatedTimeRemaining,
            averageProgressRate: jobStatus.progress > 0 && elapsedTime > 0 
              ? jobStatus.progress / (elapsedTime / 1000) // progress per second
              : null,
          },
        };

        return NextResponse.json(response);

      } catch (error) {
        logger.error('Import job status failed', { error, userId, jobId });
        
        if (error instanceof Error && error.message.includes('not found')) {
          return NextResponse.json(
            { error: 'Not Found', message: 'Import job not found' },
            { status: 404 }
          );
        }
        
        return NextResponse.json(
          { error: 'Internal Server Error', message: 'Failed to get job status' },
          { status: 500 }
        );
      }
    })
  )
);

// DELETE /api/import/jobs/[jobId] - Cancel import job
const deleteHandler = withErrorHandler(
  withAccountsRateLimit(
    withAuth(async (req: NextRequest, { params }: RouteParams) => {
      const userId = getUserId(req);
      const { jobId } = params;
      
      try {
        const importService = getImportService();
        const result = await importService.cancelJob(jobId, userId);

        logger.info('Import job cancelled', { jobId, userId });

        return NextResponse.json({
          success: true,
          message: 'Import job cancelled successfully',
          jobId,
        });

      } catch (error) {
        logger.error('Import job cancellation failed', { error, userId, jobId });
        
        if (error instanceof Error) {
          if (error.message.includes('not found') || error.message.includes('unauthorized')) {
            return NextResponse.json(
              { error: 'Not Found', message: 'Import job not found or access denied' },
              { status: 404 }
            );
          }
          
          if (error.message.includes('Cannot cancel')) {
            return NextResponse.json(
              { error: 'Bad Request', message: error.message },
              { status: 400 }
            );
          }
        }
        
        return NextResponse.json(
          { error: 'Internal Server Error', message: 'Failed to cancel job' },
          { status: 500 }
        );
      }
    })
  )
);

export async function GET(req: NextRequest, context: RouteParams) {
  return getHandler(req, context);
}

export async function DELETE(req: NextRequest, context: RouteParams) {
  return deleteHandler(req, context);
}