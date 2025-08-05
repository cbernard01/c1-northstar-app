import { NextRequest, NextResponse } from 'next/server';

import { withAuth, getUserId, checkResourceOwnership } from '@/lib/middleware/auth';
import { withErrorHandler, NotFoundError, ForbiddenError } from '@/lib/middleware/error-handler';
import { withUploadRateLimit } from '@/lib/middleware/rate-limit';
import { prisma } from '@/lib/prisma';

interface RouteContext {
  params: Promise<{ fileId: string }>;
}

// GET /api/upload/[fileId]/status - Get upload/processing status
export const GET = withErrorHandler(
  withUploadRateLimit(
    withAuth(async (req: NextRequest, context: RouteContext) => {
      const userId = getUserId(req);
      const { fileId } = await context.params;

      // Check if user owns this upload
      const hasAccess = await checkResourceOwnership(userId, fileId, 'upload');
      if (!hasAccess) {
        throw new ForbiddenError('You do not have access to this upload');
      }

      const upload = await prisma.upload.findUnique({
        where: { id: fileId },
        include: {
          job: {
            select: {
              id: true,
              status: true,
              progress: true,
              errorMessage: true,
              result: true,
            },
          },
        },
      });

      if (!upload) {
        throw new NotFoundError('Upload');
      }

      // Map upload and job status to API response format
      let status: 'uploading' | 'processing' | 'completed' | 'failed';
      let progress = upload.progress;
      let error: string | undefined;
      let result: any;

      if (upload.status === 'UPLOADING') {
        status = 'uploading';
      } else if (upload.status === 'PROCESSING') {
        status = 'processing';
      } else if (upload.status === 'COMPLETED') {
        status = 'completed';
        progress = 100;
      } else if (upload.status === 'FAILED') {
        status = 'failed';
        error = upload.errorMessage || 'Upload failed';
      } else {
        // Fallback to job status if upload status is unclear
        if (upload.job) {
          switch (upload.job.status) {
            case 'QUEUED':
            case 'RUNNING':
              status = 'processing';
              progress = upload.job.progress;
              break;
            case 'COMPLETED':
              status = 'completed';
              progress = 100;
              result = {
                accountsFound: upload.accountsFound || 0,
                accountsCreated: upload.accountsCreated || 0,
                accountsUpdated: upload.accountsUpdated || 0,
                insightsGenerated: upload.insightsGenerated || 0,
                processingTime: upload.processingTime || 0,
              };
              break;
            case 'FAILED':
              status = 'failed';
              error = upload.job.errorMessage || 'Processing failed';
              break;
            default:
              status = 'processing';
          }
        } else {
          status = 'processing';
        }
      }

      return NextResponse.json({
        status,
        progress,
        ...(error && { error }),
        ...(result && { result }),
      });
    })
  )
);