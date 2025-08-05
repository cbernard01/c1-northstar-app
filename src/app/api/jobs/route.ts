import { JobType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

import { withAuth, getUserId } from '@/lib/middleware/auth';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { withJobsRateLimit } from '@/lib/middleware/rate-limit';
import { prisma } from '@/lib/prisma';
import { QueueManager } from '@/lib/queue';
import { createJobSchema, jobQuerySchema } from '@/lib/validations/job';

// GET /api/jobs - List jobs with pagination and filtering
export const GET = withErrorHandler(
  withJobsRateLimit(
    withAuth(async (req) => {
      const userId = getUserId(req);
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
      const where: any = { userId };
      if (status) where.status = status;
      if (type) where.type = type;

      // Build order by clause
      const orderBy = { [sortBy]: sortOrder };

      // Get jobs and total count
      const [jobs, total] = await Promise.all([
        prisma.job.findMany({
          where,
          orderBy,
          skip,
          take: pageSize,
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
        }),
        prisma.job.count({ where }),
      ]);

      const totalPages = Math.ceil(total / pageSize);

      return NextResponse.json({
        jobs,
        total,
        page,
        pageSize,
        totalPages,
      });
    })
  )
);

// POST /api/jobs - Create a new job
export const POST = withErrorHandler(
  withJobsRateLimit(
    withAuth(async (req) => {
      const userId = getUserId(req);
      const body = await req.json();
      
      const { type, title, description, metadata } = createJobSchema.parse(body);

      // Create job in database
      const job = await prisma.job.create({
        data: {
          type,
          title,
          description,
          metadata,
          userId,
        },
      });

      // Add job to appropriate queue based on type
      try {
        switch (type) {
          case JobType.ACCOUNT_ANALYSIS:
            if (metadata?.accountId) {
              await QueueManager.addAccountAnalysisJob(
                {
                  accountId: metadata.accountId,
                  userId,
                  analysisType: metadata.analysisType || 'full',
                },
                job.id
              );
            }
            break;
          case JobType.DATA_EXPORT:
            if (metadata?.exportConfig) {
              await QueueManager.addDataExportJob(
                {
                  exportType: metadata.exportConfig.type || 'accounts',
                  filters: metadata.exportConfig.filters || {},
                  format: metadata.exportConfig.format || 'csv',
                  userId,
                },
                job.id
              );
            }
            break;
          case JobType.INSIGHT_GENERATION:
            if (metadata?.accountId) {
              await QueueManager.addInsightGenerationJob(
                {
                  accountId: metadata.accountId,
                  userId,
                  contextData: metadata.contextData,
                },
                job.id
              );
            }
            break;
        }
      } catch (queueError) {
        console.error('Failed to add job to queue:', queueError);
        // Update job status to failed
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            errorMessage: 'Failed to queue job for processing',
          },
        });
      }

      return NextResponse.json(job, { status: 201 });
    })
  )
);