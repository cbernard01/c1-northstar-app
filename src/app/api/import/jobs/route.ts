import { NextRequest, NextResponse } from 'next/server';

import { withAuth, getUserId } from '@/lib/middleware/auth';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { withAccountsRateLimit } from '@/lib/middleware/rate-limit';
import { getImportService } from '@/lib/services/import';
import { jobQuerySchema } from '@/lib/validations/import';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

// GET /api/import/jobs - List import jobs with filtering and pagination
const getHandler = withErrorHandler(
  withAccountsRateLimit(
    withAuth(async (req) => {
      const userId = getUserId(req);
      
      try {
        const url = new URL(req.url);
        const params = Object.fromEntries(url.searchParams.entries());
        
        const {
          page,
          pageSize,
          status,
          type,
          sortBy,
          sortOrder,
        } = jobQuerySchema.parse(params);

        const skip = (page - 1) * pageSize;

        // Build where clause
        const where: any = {
          userId, // Only show user's own jobs
          type: {
            in: ['IMPORT_ACCOUNTS', 'IMPORT_PRODUCTS', 'IMPORT_OPPORTUNITIES', 'IMPORT_ASSETS'],
          },
        };
        
        if (status) {
          where.status = status;
        }
        
        if (type) {
          where.type = type;
        }

        // Build order by clause
        const orderBy = { [sortBy]: sortOrder };

        // Get jobs and total count
        const [jobs, total] = await Promise.all([
          prisma.processingJob.findMany({
            where,
            orderBy,
            skip,
            take: pageSize,
            include: {
              stages: {
                orderBy: { startedAt: 'asc' },
              },
            },
          }),
          prisma.processingJob.count({ where }),
        ]);

        const totalPages = Math.ceil(total / pageSize);

        // Transform jobs for response
        const transformedJobs = jobs.map(job => ({
          id: job.id,
          type: job.type,
          title: job.title,
          description: job.description,
          status: job.status,
          progress: job.progress,
          totalItems: job.totalItems,
          processedItems: job.processedItems,
          failedItems: job.failedItems,
          stages: job.stages.map(stage => ({
            id: stage.id,
            name: stage.name,
            status: stage.status,
            progress: stage.progress,
            startedAt: stage.startedAt,
            completedAt: stage.completedAt,
            errorMessage: stage.errorMessage,
          })),
          result: job.result,
          errorMessage: job.errorMessage,
          metadata: job.metadata,
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          failedAt: job.failedAt,
          updatedAt: job.updatedAt,
        }));

        return NextResponse.json({
          jobs: transformedJobs,
          total,
          page,
          pageSize,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        });

      } catch (error) {
        logger.error('Import jobs list failed', { error, userId });
        return NextResponse.json(
          { error: 'Internal Server Error', message: 'Failed to get import jobs' },
          { status: 500 }
        );
      }
    })
  )
);

export async function GET(req: NextRequest) {
  return getHandler(req);
}