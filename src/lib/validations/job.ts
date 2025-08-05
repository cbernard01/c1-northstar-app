import { JobType, JobStatus } from '@prisma/client';
import { z } from 'zod';

// Job type enum validation
export const jobTypeSchema = z.nativeEnum(JobType);
export const jobStatusSchema = z.nativeEnum(JobStatus);

// Create job request validation
export const createJobSchema = z.object({
  type: jobTypeSchema,
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  metadata: z.record(z.any()).optional(),
});

// Update job request validation
export const updateJobSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  metadata: z.record(z.any()).optional(),
});

// Job query parameters validation
export const jobQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: jobStatusSchema.optional(),
  type: jobTypeSchema.optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Bulk operations validation
export const bulkJobIdsSchema = z.object({
  ids: z.array(z.string().cuid()).min(1, 'At least one job ID is required'),
});

// Job stats query validation
export const jobStatsQuerySchema = z.object({
  dateRange: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
  }).optional(),
});

// Type exports
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type JobQueryParams = z.infer<typeof jobQuerySchema>;
export type BulkJobIds = z.infer<typeof bulkJobIdsSchema>;
export type JobStatsQuery = z.infer<typeof jobStatsQuerySchema>;