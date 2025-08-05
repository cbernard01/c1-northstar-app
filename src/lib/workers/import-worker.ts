import { Worker, Job as BullJob } from 'bullmq';
import { ProcessingJobType, JobStatus } from '@prisma/client';

import { redisConnection } from '@/lib/redis';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { QUEUE_NAMES, ImportJobData } from '@/lib/queue';
import { getImportService, BatchImportData, BatchImportOptions } from '@/lib/services/import';
import { JobTracker } from '@/lib/queue';

export class ImportWorker {
  private worker: Worker;
  private importService = getImportService();

  constructor() {
    this.worker = new Worker(
      QUEUE_NAMES.IMPORT_PROCESSING,
      this.processImportJob.bind(this),
      {
        connection: redisConnection,
        concurrency: 3, // Process up to 3 import jobs concurrently
        limiter: {
          max: 10, // Maximum 10 jobs per...
          duration: 60000, // ...1 minute
        },
      }
    );

    this.setupEventHandlers();
  }

  private async processImportJob(job: BullJob<ImportJobData>) {
    const { type, userId, data, options, metadata } = job.data;
    const jobId = metadata?.jobId || job.id;

    logger.info('ImportWorker: Starting import job', {
      jobId,
      type,
      userId,
      queueJobId: job.id,
    });

    try {
      // Update job status to running
      await JobTracker.updateJobStatus(jobId, JobStatus.RUNNING);
      await this.updateJobProgress(job, 0, 'Starting import process');

      let result;

      switch (type) {
        case 'accounts':
          result = await this.processAccountsImport(job, data, options);
          break;
        case 'products':
          result = await this.processProductsImport(job, data, options);
          break;
        case 'opportunities':
          result = await this.processOpportunitiesImport(job, data, options);
          break;
        case 'assets':
          result = await this.processAssetsImport(job, data, options, userId);
          break;
        case 'batch':
          result = await this.processBatchImport(job, data, options, userId);
          break;
        default:
          throw new Error(`Unsupported import type: ${type}`);
      }

      // Update job as completed
      await JobTracker.updateJobStatus(jobId, JobStatus.COMPLETED, result);
      await this.updateJobProgress(job, 100, 'Import completed successfully');

      logger.info('ImportWorker: Import job completed', {
        jobId,
        type,
        userId,
        result: result.summary || result,
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update job as failed
      await JobTracker.updateJobStatus(jobId, JobStatus.FAILED, null, errorMessage);

      logger.error('ImportWorker: Import job failed', {
        jobId,
        type,
        userId,
        error: errorMessage,
      });

      throw error;
    }
  }

  private async processAccountsImport(
    job: BullJob<ImportJobData>,
    data: { buffer: Buffer; fileName: string },
    options: any
  ) {
    return await this.importService.importAccounts(
      data.buffer,
      data.fileName,
      options,
      (progress) => {
        this.updateJobProgress(
          job,
          (progress.processed / progress.total) * 100,
          `Processing accounts: ${progress.processed}/${progress.total} - ${progress.currentAccount || ''}`
        );
      }
    );
  }

  private async processProductsImport(
    job: BullJob<ImportJobData>,
    data: { buffer: Buffer; fileName: string },
    options: any
  ) {
    return await this.importService.importProducts(
      data.buffer,
      data.fileName,
      options,
      (progress) => {
        this.updateJobProgress(
          job,
          (progress.processed / progress.total) * 100,
          `Processing products: ${progress.processed}/${progress.total} - ${progress.currentProduct || ''}`
        );
      }
    );
  }

  private async processOpportunitiesImport(
    job: BullJob<ImportJobData>,
    data: { buffer: Buffer; fileName: string },
    options: any
  ) {
    return await this.importService.importOpportunities(
      data.buffer,
      data.fileName,
      options,
      (progress) => {
        this.updateJobProgress(
          job,
          (progress.processed / progress.total) * 100,
          `Processing opportunities: ${progress.processed}/${progress.total} - ${progress.currentOpportunity || ''}`
        );
      }
    );
  }

  private async processAssetsImport(
    job: BullJob<ImportJobData>,
    data: any[], // Array of AssetImportData
    options: any,
    userId: string
  ) {
    if (Array.isArray(data) && data.length > 1) {
      // Batch asset import
      return await this.importService.importAssetBatch(
        data,
        userId,
        options,
        (progress) => {
          this.updateJobProgress(
            job,
            (progress.processed / progress.total) * 100,
            `Processing assets: ${progress.processed}/${progress.total} - ${progress.currentFile || ''}`
          );
        }
      );
    } else {
      // Single asset import
      const assetData = Array.isArray(data) ? data[0] : data;
      return await this.importService.importAsset(
        assetData,
        userId,
        options,
        (progress) => {
          this.updateJobProgress(
            job,
            progress.stage === 'completed' ? 100 : 50,
            `Processing asset: ${progress.currentFile} - ${progress.stage}`
          );
        }
      );
    }
  }

  private async processBatchImport(
    job: BullJob<ImportJobData>,
    data: BatchImportData,
    options: BatchImportOptions,
    userId: string
  ) {
    // Enhanced options with progress callback
    const enhancedOptions = {
      ...options,
      onProgress: (progress: any) => {
        const overallProgress = progress.overall.percentage;
        const currentStage = progress.stage;
        const currentItem = progress.current.currentItem || '';
        
        this.updateJobProgress(
          job,
          overallProgress,
          `${currentStage}: ${progress.current.processed}/${progress.current.total} - ${currentItem}`
        );
      },
    };

    return await this.importService.orchestrator.executeBatchImport(
      data,
      userId,
      enhancedOptions
    );
  }

  private async updateJobProgress(job: BullJob<ImportJobData>, progress: number, message?: string) {
    try {
      await job.updateProgress(Math.round(progress));
      
      // Also update the database job record
      const jobId = job.data.metadata?.jobId || job.id;
      await JobTracker.updateJobProgress(jobId, Math.round(progress), message);
      
      if (message) {
        logger.debug('ImportWorker: Job progress update', {
          jobId,
          progress: Math.round(progress),
          message,
        });
      }
    } catch (error) {
      logger.warn('ImportWorker: Failed to update job progress', {
        jobId: job.id,
        error,
      });
    }
  }

  private setupEventHandlers() {
    this.worker.on('ready', () => {
      logger.info('ImportWorker: Worker is ready and waiting for jobs');
    });

    this.worker.on('active', (job) => {
      logger.info('ImportWorker: Job started', {
        jobId: job.id,
        type: job.data.type,
        userId: job.data.userId,
      });
    });

    this.worker.on('completed', (job, result) => {
      logger.info('ImportWorker: Job completed', {
        jobId: job.id,
        type: job.data.type,
        userId: job.data.userId,
        processingTime: Date.now() - job.processedOn!,
      });
    });

    this.worker.on('failed', (job, err) => {
      logger.error('ImportWorker: Job failed', {
        jobId: job?.id,
        type: job?.data?.type,
        userId: job?.data?.userId,
        error: err.message,
        attempts: job?.attemptsMade,
      });
    });

    this.worker.on('stalled', (jobId) => {
      logger.warn('ImportWorker: Job stalled', { jobId });
    });

    this.worker.on('error', (err) => {
      logger.error('ImportWorker: Worker error', { error: err.message });
    });

    // Graceful shutdown
    process.on('SIGINT', () => this.close());
    process.on('SIGTERM', () => this.close());
  }

  async close() {
    logger.info('ImportWorker: Shutting down worker...');
    await this.worker.close();
    logger.info('ImportWorker: Worker shut down complete');
  }

  getWorkerStatus() {
    return {
      name: 'ImportWorker',
      isRunning: !this.worker.closing,
      concurrency: 3,
      queue: QUEUE_NAMES.IMPORT_PROCESSING,
    };
  }
}

// Singleton instance
let importWorker: ImportWorker | null = null;

export function getImportWorker(): ImportWorker {
  if (!importWorker) {
    importWorker = new ImportWorker();
  }
  return importWorker;
}

export function startImportWorker(): ImportWorker {
  const worker = getImportWorker();
  logger.info('ImportWorker: Started import processing worker');
  return worker;
}