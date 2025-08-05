import { JobType, JobStatus } from '@prisma/client';
import { Queue, Worker, Job as BullJob } from 'bullmq';

import { prisma } from './prisma';
import { redisConnection } from './redis';

// Queue names
export const QUEUE_NAMES = {
  FILE_PROCESSING: 'file-processing',
  ACCOUNT_ANALYSIS: 'account-analysis',
  INSIGHT_GENERATION: 'insight-generation',
  DATA_EXPORT: 'data-export',
  IMPORT_PROCESSING: 'import-processing',
} as const;

// Job data interfaces
export interface FileProcessingJobData {
  uploadId: string;
  userId: string;
  fileName: string;
  fileType: string;
  filePath: string;
}

export interface AccountAnalysisJobData {
  accountId: string;
  userId: string;
  analysisType: string;
}

export interface InsightGenerationJobData {
  accountId: string;
  userId: string;
  contextData?: any;
}

export interface DataExportJobData {
  exportType: 'accounts' | 'insights' | 'jobs' | 'reports';
  filters: any;
  format: 'csv' | 'xlsx' | 'json';
  userId: string;
}

export interface ImportJobData {
  type: 'accounts' | 'products' | 'opportunities' | 'assets' | 'batch';
  userId: string;
  data: any; // BatchImportData or specific import data
  options: any; // Import options
  metadata?: any;
}

// Create queues
export const fileProcessingQueue = new Queue(QUEUE_NAMES.FILE_PROCESSING, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 20,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

export const accountAnalysisQueue = new Queue(QUEUE_NAMES.ACCOUNT_ANALYSIS, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export const insightGenerationQueue = new Queue(QUEUE_NAMES.INSIGHT_GENERATION, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
  },
});

export const dataExportQueue = new Queue(QUEUE_NAMES.DATA_EXPORT, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 30,
    removeOnFail: 10,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

export const importProcessingQueue = new Queue(QUEUE_NAMES.IMPORT_PROCESSING, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 20,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
  },
});

// Queue management utilities
export class QueueManager {
  static async addFileProcessingJob(data: FileProcessingJobData, jobId: string) {
    return await fileProcessingQueue.add('process-file', data, {
      jobId,
      priority: 1,
    });
  }

  static async addAccountAnalysisJob(data: AccountAnalysisJobData, jobId: string) {
    return await accountAnalysisQueue.add('analyze-account', data, {
      jobId,
      priority: 2,
    });
  }

  static async addInsightGenerationJob(data: InsightGenerationJobData, jobId: string) {
    return await insightGenerationQueue.add('generate-insights', data, {
      jobId,
      priority: 3,
    });
  }

  static async addDataExportJob(data: DataExportJobData, jobId: string) {
    return await dataExportQueue.add('export-data', data, {
      jobId,
      priority: 4,
    });
  }

  static async addImportJob(data: ImportJobData, jobId: string) {
    return await importProcessingQueue.add('process-import', data, {
      jobId,
      priority: 2,
    });
  }

  static async getJobStats() {
    const [fileStats, accountStats, insightStats, exportStats, importStats] = await Promise.all([
      fileProcessingQueue.getJobCounts(),
      accountAnalysisQueue.getJobCounts(),
      insightGenerationQueue.getJobCounts(),
      dataExportQueue.getJobCounts(),
      importProcessingQueue.getJobCounts(),
    ]);

    return {
      total: fileStats.waiting + fileStats.active + fileStats.completed + fileStats.failed +
             accountStats.waiting + accountStats.active + accountStats.completed + accountStats.failed +
             insightStats.waiting + insightStats.active + insightStats.completed + insightStats.failed +
             exportStats.waiting + exportStats.active + exportStats.completed + exportStats.failed +
             importStats.waiting + importStats.active + importStats.completed + importStats.failed,
      running: fileStats.active + accountStats.active + insightStats.active + exportStats.active + importStats.active,
      completed: fileStats.completed + accountStats.completed + insightStats.completed + exportStats.completed + importStats.completed,
      failed: fileStats.failed + accountStats.failed + insightStats.failed + exportStats.failed + importStats.failed,
      queued: fileStats.waiting + accountStats.waiting + insightStats.waiting + exportStats.waiting + importStats.waiting,
      pending: 0, // No delayed jobs for now
    };
  }

  static async removeJob(jobId: string, queueName: string) {
    let queue: Queue;
    switch (queueName) {
      case QUEUE_NAMES.FILE_PROCESSING:
        queue = fileProcessingQueue;
        break;
      case QUEUE_NAMES.ACCOUNT_ANALYSIS:
        queue = accountAnalysisQueue;
        break;
      case QUEUE_NAMES.INSIGHT_GENERATION:
        queue = insightGenerationQueue;
        break;
      case QUEUE_NAMES.DATA_EXPORT:
        queue = dataExportQueue;
        break;
      case QUEUE_NAMES.IMPORT_PROCESSING:
        queue = importProcessingQueue;
        break;
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }

    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
    }
  }

  static async retryJob(jobId: string, queueName: string) {
    let queue: Queue;
    switch (queueName) {
      case QUEUE_NAMES.FILE_PROCESSING:
        queue = fileProcessingQueue;
        break;
      case QUEUE_NAMES.ACCOUNT_ANALYSIS:
        queue = accountAnalysisQueue;
        break;
      case QUEUE_NAMES.INSIGHT_GENERATION:
        queue = insightGenerationQueue;
        break;
      case QUEUE_NAMES.DATA_EXPORT:
        queue = dataExportQueue;
        break;
      case QUEUE_NAMES.IMPORT_PROCESSING:
        queue = importProcessingQueue;
        break;
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }

    const job = await queue.getJob(jobId);
    if (job) {
      await job.retry();
    }
  }
}

// Job progress tracking utility
export class JobTracker {
  static async updateJobProgress(jobId: string, progress: number, message?: string) {
    try {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          progress,
          updatedAt: new Date(),
          ...(message && { metadata: { message } }),
        },
      });
    } catch (error) {
      console.error('Failed to update job progress:', error);
    }
  }

  static async updateJobStatus(jobId: string, status: JobStatus, result?: any, errorMessage?: string) {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date(),
      };

      if (status === JobStatus.RUNNING && !await this.getJobStartedAt(jobId)) {
        updateData.startedAt = new Date();
      } else if (status === JobStatus.COMPLETED) {
        updateData.completedAt = new Date();
        updateData.progress = 100;
        if (result) updateData.result = result;
      } else if (status === JobStatus.FAILED) {
        updateData.failedAt = new Date();
        if (errorMessage) updateData.errorMessage = errorMessage;
      }

      await prisma.job.update({
        where: { id: jobId },
        data: updateData,
      });
    } catch (error) {
      console.error('Failed to update job status:', error);
    }
  }

  private static async getJobStartedAt(jobId: string): Promise<Date | null> {
    try {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: { startedAt: true },
      });
      return job?.startedAt || null;
    } catch (error) {
      console.error('Failed to get job startedAt:', error);
      return null;
    }
  }
}