import { ProcessingJobType, JobStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { QueueManager } from '@/lib/queue';
import { getAccountImportService, AccountImportOptions, AccountImportResult } from './account-import.service';
import { getProductImportService, ProductImportOptions, ProductImportResult } from './product-import.service';
import { getOpportunityImportService, OpportunityImportOptions, OpportunityImportResult } from './opportunity-import.service';
import { getAssetImportService, AssetImportOptions, AssetImportResult } from './asset-import.service';

export interface BatchImportData {
  accounts?: {
    buffer: Buffer;
    fileName: string;
    options?: AccountImportOptions;
  };
  products?: {
    buffer: Buffer;
    fileName: string;
    options?: ProductImportOptions;
  };
  opportunities?: {
    buffer: Buffer;
    fileName: string;
    options?: OpportunityImportOptions;
  };
  assets?: Array<{
    fileName: string;
    originalName: string;
    buffer: Buffer;
    fileSize: number;
    mimeType: string;
    title?: string;
    category?: string;
    accountNumber?: string;
  }>;
}

export interface BatchImportOptions {
  generateInsights?: boolean;
  createVectors?: boolean;
  linkRelatedData?: boolean;
  validateRelationships?: boolean;
  processOrder?: Array<'accounts' | 'products' | 'opportunities' | 'assets'>;
  onProgress?: (progress: BatchImportProgress) => void;
  rollbackOnError?: boolean;
  continueOnError?: boolean;
}

export interface BatchImportResult {
  jobId: string;
  accounts?: AccountImportResult;
  products?: ProductImportResult;
  opportunities?: OpportunityImportResult;
  assets?: AssetImportResult;
  totalProcessingTime: number;
  overallStatus: 'completed' | 'partial' | 'failed';
  errors: string[];
  warnings: string[];
  summary: {
    totalRecords: number;
    totalCreated: number;
    totalUpdated: number;
    totalFailed: number;
    totalSkipped: number;
  };
}

export interface BatchImportProgress {
  jobId: string;
  stage: 'initializing' | 'accounts' | 'products' | 'opportunities' | 'assets' | 'insights' | 'completed';
  overall: {
    processed: number;
    total: number;
    percentage: number;
  };
  current: {
    type: 'accounts' | 'products' | 'opportunities' | 'assets' | 'insights';
    processed: number;
    total: number;
    percentage: number;
    currentItem?: string;
  };
  results: {
    accounts?: Partial<AccountImportResult>;
    products?: Partial<ProductImportResult>;
    opportunities?: Partial<OpportunityImportResult>;
    assets?: Partial<AssetImportResult>;
  };
  errors: number;
  warnings: number;
  startTime: number;
  estimatedTimeRemaining?: number;
}

export interface ComplexImportJob {
  type: 'complex_import';
  data: BatchImportData;
  options: BatchImportOptions;
  userId: string;
  metadata?: any;
}

export class ImportOrchestratorService {
  private readonly accountImportService = getAccountImportService();
  private readonly productImportService = getProductImportService();
  private readonly opportunityImportService = getOpportunityImportService();
  private readonly assetImportService = getAssetImportService();

  /**
   * Execute complex batch import
   */
  async executeBatchImport(
    data: BatchImportData,
    userId: string,
    options: BatchImportOptions = {}
  ): Promise<BatchImportResult> {
    const startTime = Date.now();
    const jobId = uuidv4();

    // Create processing job
    const processingJob = await prisma.processingJob.create({
      data: {
        id: jobId,
        type: ProcessingJobType.IMPORT_ASSETS, // Generic import type
        title: 'Complex Batch Import',
        description: 'Multi-entity batch import with relationships',
        status: JobStatus.RUNNING,
        userId,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          importTypes: Object.keys(data),
          options,
        },
      },
    });

    const result: BatchImportResult = {
      jobId,
      totalProcessingTime: 0,
      overallStatus: 'completed',
      errors: [],
      warnings: [],
      summary: {
        totalRecords: 0,
        totalCreated: 0,
        totalUpdated: 0,
        totalFailed: 0,
        totalSkipped: 0,
      },
    };

    // Initialize progress tracking
    const progress: BatchImportProgress = {
      jobId,
      stage: 'initializing',
      overall: { processed: 0, total: 0, percentage: 0 },
      current: { type: 'accounts', processed: 0, total: 0, percentage: 0 },
      results: {},
      errors: 0,
      warnings: 0,
      startTime,
    };

    // Calculate total work
    const importTypes = Object.keys(data) as Array<keyof BatchImportData>;
    const totalSteps = importTypes.length + (options.generateInsights ? 1 : 0);
    progress.overall.total = totalSteps;

    try {
      // Update job with initial progress
      await this.updateJobProgress(jobId, 0, 'Initializing batch import');

      // Determine processing order
      const processOrder = options.processOrder || ['accounts', 'products', 'opportunities', 'assets'];
      
      // Process each import type in order
      let stepIndex = 0;
      for (const importType of processOrder) {
        if (!data[importType]) continue;

        progress.stage = importType;
        progress.current.type = importType;
        options.onProgress?.(progress);

        try {
          let importResult: any;

          switch (importType) {
            case 'accounts':
              progress.current = { type: 'accounts', processed: 0, total: 1, percentage: 0 };
              importResult = await this.accountImportService.importFromCsv(
                data.accounts!.buffer,
                data.accounts!.fileName,
                data.accounts!.options || {},
                (accountProgress) => {
                  progress.current.processed = accountProgress.processed;
                  progress.current.total = accountProgress.total;
                  progress.current.percentage = (accountProgress.processed / accountProgress.total) * 100;
                  progress.current.currentItem = accountProgress.currentAccount;
                  options.onProgress?.(progress);
                }
              );
              result.accounts = importResult;
              progress.results.accounts = importResult;
              break;

            case 'products':
              progress.current = { type: 'products', processed: 0, total: 1, percentage: 0 };
              importResult = await this.productImportService.importFromCsv(
                data.products!.buffer,
                data.products!.fileName,
                data.products!.options || {},
                (productProgress) => {
                  progress.current.processed = productProgress.processed;
                  progress.current.total = productProgress.total;
                  progress.current.percentage = (productProgress.processed / productProgress.total) * 100;
                  progress.current.currentItem = productProgress.currentProduct;
                  options.onProgress?.(progress);
                }
              );
              result.products = importResult;
              progress.results.products = importResult;
              break;

            case 'opportunities':
              progress.current = { type: 'opportunities', processed: 0, total: 1, percentage: 0 };
              importResult = await this.opportunityImportService.importFromCsv(
                data.opportunities!.buffer,
                data.opportunities!.fileName,
                data.opportunities!.options || {},
                (opportunityProgress) => {
                  progress.current.processed = opportunityProgress.processed;
                  progress.current.total = opportunityProgress.total;
                  progress.current.percentage = (opportunityProgress.processed / opportunityProgress.total) * 100;
                  progress.current.currentItem = opportunityProgress.currentOpportunity;
                  options.onProgress?.(progress);
                }
              );
              result.opportunities = importResult;
              progress.results.opportunities = importResult;
              break;

            case 'assets':
              if (data.assets && data.assets.length > 0) {
                progress.current = { type: 'assets', processed: 0, total: data.assets.length, percentage: 0 };
                
                const assetImportData = data.assets.map(asset => ({
                  ...asset,
                  scope: asset.category ? this.mapCategoryToScope(asset.category) : undefined,
                }));

                importResult = await this.assetImportService.importAssetBatch(
                  assetImportData,
                  userId,
                  options.createVectors ? { 
                    generateChunks: true, 
                    storeVectors: true,
                    vectorScope: 'sales-assets',
                  } : { generateChunks: false },
                  (assetProgress) => {
                    progress.current.processed = assetProgress.processed;
                    progress.current.total = assetProgress.total;
                    progress.current.percentage = (assetProgress.processed / assetProgress.total) * 100;
                    progress.current.currentItem = assetProgress.currentFile;
                    options.onProgress?.(progress);
                  }
                );
                result.assets = importResult;
                progress.results.assets = importResult;
              }
              break;
          }

          // Update overall progress
          stepIndex++;
          progress.overall.processed = stepIndex;
          progress.overall.percentage = (stepIndex / totalSteps) * 100;

          // Aggregate results
          if (importResult) {
            this.aggregateResults(result, importResult);
            result.errors.push(...(importResult.errors || []).map((e: any) => e.error || e));
            result.warnings.push(...(importResult.warnings || []).map((w: any) => w.warning || w));
            progress.errors = result.errors.length;
            progress.warnings = result.warnings.length;
          }

          await this.updateJobProgress(jobId, progress.overall.percentage, `Completed ${importType} import`);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown import error';
          result.errors.push(`${importType} import failed: ${errorMessage}`);
          
          logger.error(`ImportOrchestratorService: ${importType} import failed`, {
            jobId,
            error,
            importType,
          });

          if (!options.continueOnError) {
            result.overallStatus = 'failed';
            throw error;
          }

          result.overallStatus = 'partial';
        }
      }

      // Generate insights if requested
      if (options.generateInsights && result.summary.totalCreated > 0) {
        progress.stage = 'insights';
        progress.current = { type: 'insights', processed: 0, total: 1, percentage: 0 };
        options.onProgress?.(progress);

        try {
          await this.generateInsights(result, userId);
          progress.current.percentage = 100;
          stepIndex++;
          progress.overall.processed = stepIndex;
          progress.overall.percentage = 100;
          
          await this.updateJobProgress(jobId, 100, 'Insights generation completed');
        } catch (error) {
          result.warnings.push(`Insight generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Validate relationships if requested
      if (options.validateRelationships) {
        await this.validateImportedRelationships(result);
      }

      progress.stage = 'completed';
      progress.overall.percentage = 100;
      progress.estimatedTimeRemaining = 0;
      options.onProgress?.(progress);

      result.totalProcessingTime = Date.now() - startTime;

      // Update job as completed
      await prisma.processingJob.update({
        where: { id: jobId },
        data: {
          status: JobStatus.COMPLETED,
          progress: 100,
          completedAt: new Date(),
          updatedAt: new Date(),
          result: {
            summary: result.summary,
            processingTime: result.totalProcessingTime,
            overallStatus: result.overallStatus,
          },
        },
      });

      logger.info('ImportOrchestratorService: Complex import completed', {
        jobId,
        summary: result.summary,
        processingTime: result.totalProcessingTime,
        overallStatus: result.overallStatus,
      });

      return result;

    } catch (error) {
      result.overallStatus = 'failed';
      result.totalProcessingTime = Date.now() - startTime;
      
      // Update job as failed
      await prisma.processingJob.update({
        where: { id: jobId },
        data: {
          status: JobStatus.FAILED,
          failedAt: new Date(),
          updatedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      logger.error('ImportOrchestratorService: Complex import failed', {
        jobId,
        error,
        summary: result.summary,
      });

      if (options.rollbackOnError) {
        await this.rollbackImport(result);
      }

      throw error;
    }
  }

  /**
   * Queue complex import job for background processing
   */
  async queueComplexImport(
    data: BatchImportData,
    userId: string,
    options: BatchImportOptions = {}
  ): Promise<{ jobId: string }> {
    const jobId = uuidv4();

    // Create processing job
    const processingJob = await prisma.processingJob.create({
      data: {
        id: jobId,
        type: ProcessingJobType.IMPORT_ASSETS,
        title: 'Queued Complex Batch Import',
        description: 'Multi-entity batch import with relationships (queued)',
        status: JobStatus.QUEUED,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          importTypes: Object.keys(data),
          options,
        },
      },
    });

    // Queue the job
    const jobData: ComplexImportJob = {
      type: 'complex_import',
      data,
      options,
      userId,
      metadata: { jobId },
    };

    await QueueManager.addFileProcessingJob(
      {
        uploadId: jobId,
        userId,
        fileName: 'complex_import',
        fileType: 'batch',
        filePath: 'memory',
      },
      jobId
    );

    logger.info('ImportOrchestratorService: Complex import queued', {
      jobId,
      importTypes: Object.keys(data),
      userId,
    });

    return { jobId };
  }

  /**
   * Get import job status
   */
  async getImportJobStatus(jobId: string) {
    const job = await prisma.processingJob.findUnique({
      where: { id: jobId },
      include: {
        stages: true,
      },
    });

    if (!job) {
      throw new Error('Import job not found');
    }

    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      title: job.title,
      description: job.description,
      stages: job.stages,
      result: job.result,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      failedAt: job.failedAt,
      metadata: job.metadata,
    };
  }

  /**
   * Cancel import job
   */
  async cancelImportJob(jobId: string, userId: string) {
    const job = await prisma.processingJob.findFirst({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new Error('Import job not found or unauthorized');
    }

    if (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) {
      throw new Error('Cannot cancel completed or failed job');
    }

    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.CANCELLED,
        updatedAt: new Date(),
      },
    });

    // Try to remove from queue
    try {
      await QueueManager.removeJob(jobId, 'file-processing');
    } catch (error) {
      // Job might not be in queue anymore
      logger.warn('ImportOrchestratorService: Could not remove job from queue', { jobId, error });
    }

    logger.info('ImportOrchestratorService: Import job cancelled', { jobId, userId });

    return { success: true };
  }

  /**
   * Aggregate results from individual import services
   */
  private aggregateResults(batchResult: BatchImportResult, importResult: any) {
    if (importResult.total) batchResult.summary.totalRecords += importResult.total;
    if (importResult.created) batchResult.summary.totalCreated += importResult.created;
    if (importResult.updated) batchResult.summary.totalUpdated += importResult.updated;
    if (importResult.failed) batchResult.summary.totalFailed += importResult.failed;
    if (importResult.skipped) batchResult.summary.totalSkipped += importResult.skipped;
    if (importResult.imported) batchResult.summary.totalCreated += importResult.imported; // For assets
  }

  /**
   * Update job progress
   */
  private async updateJobProgress(jobId: string, progress: number, message?: string) {
    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        progress: Math.round(progress),
        updatedAt: new Date(),
        ...(message && {
          metadata: {
            lastMessage: message,
            updatedAt: new Date().toISOString(),
          },
        }),
      },
    });
  }

  /**
   * Generate insights from imported data
   */
  private async generateInsights(result: BatchImportResult, userId: string) {
    // Queue insight generation jobs for imported accounts
    if (result.accounts?.accountIds && result.accounts.accountIds.length > 0) {
      for (const accountId of result.accounts.accountIds.slice(0, 10)) { // Limit to first 10
        try {
          await QueueManager.addInsightGenerationJob(
            {
              accountId,
              userId,
              contextData: {
                source: 'import',
                jobId: result.jobId,
              },
            },
            uuidv4()
          );
        } catch (error) {
          logger.warn('ImportOrchestratorService: Failed to queue insight generation', {
            accountId,
            error,
          });
        }
      }
    }
  }

  /**
   * Validate imported relationships
   */
  private async validateImportedRelationships(result: BatchImportResult) {
    const validationResults = [];

    // Validate opportunity-account relationships
    if (result.opportunities?.opportunityIds && result.accounts?.accountIds) {
      const orphanedOpportunities = await prisma.opportunity.count({
        where: {
          id: { in: result.opportunities.opportunityIds },
          accountId: { notIn: result.accounts.accountIds },
        },
      });

      if (orphanedOpportunities > 0) {
        result.warnings.push(`${orphanedOpportunities} opportunities are not linked to imported accounts`);
      }
    }

    // Validate product-opportunity relationships
    if (result.opportunities?.opportunityIds && result.products?.productIds) {
      const linkedProducts = await prisma.purchaseProduct.count({
        where: {
          opportunityId: { in: result.opportunities.opportunityIds },
          productId: { in: result.products.productIds },
        },
      });

      validationResults.push(`${linkedProducts} product-opportunity relationships created`);
    }

    logger.info('ImportOrchestratorService: Relationship validation completed', {
      jobId: result.jobId,
      validationResults,
    });
  }

  /**
   * Rollback import changes
   */
  private async rollbackImport(result: BatchImportResult) {
    try {
      logger.info('ImportOrchestratorService: Starting import rollback', { jobId: result.jobId });

      // Rollback in reverse order of dependencies
      if (result.opportunities?.opportunityIds) {
        await prisma.opportunity.deleteMany({
          where: { id: { in: result.opportunities.opportunityIds } },
        });
      }

      if (result.products?.productIds) {
        await prisma.product.deleteMany({
          where: { id: { in: result.products.productIds } },
        });
      }

      if (result.accounts?.accountIds) {
        await prisma.companyAccount.deleteMany({
          where: { id: { in: result.accounts.accountIds } },
        });
      }

      if (result.assets?.documentIds) {
        await prisma.document.deleteMany({
          where: { id: { in: result.assets.documentIds } },
        });
      }

      logger.info('ImportOrchestratorService: Import rollback completed', { jobId: result.jobId });

    } catch (error) {
      logger.error('ImportOrchestratorService: Rollback failed', {
        jobId: result.jobId,
        error,
      });
      result.errors.push(`Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Map category to document scope
   */
  private mapCategoryToScope(category: string) {
    const categoryMap: Record<string, any> = {
      'case study': 'CASE_STUDIES',
      'data sheet': 'DATA_SHEETS',
      'proposal': 'PROPOSALS',
      'training': 'TRAINING',
      'technical': 'TECHNICAL_DOCS',
    };

    return categoryMap[category.toLowerCase()] || 'GENERAL';
  }

  /**
   * Get import statistics
   */
  async getImportStats(userId?: string, timeRange: 'day' | 'week' | 'month' = 'day') {
    const now = new Date();
    const startDate = new Date();
    
    switch (timeRange) {
      case 'day':
        startDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
    }

    const whereClause = {
      type: { in: [ProcessingJobType.IMPORT_ACCOUNTS, ProcessingJobType.IMPORT_PRODUCTS, ProcessingJobType.IMPORT_OPPORTUNITIES, ProcessingJobType.IMPORT_ASSETS] },
      createdAt: { gte: startDate },
      ...(userId && { userId }),
    };

    const [statusStats, typeStats, totalJobs] = await Promise.all([
      prisma.processingJob.groupBy({
        by: ['status'],
        where: whereClause,
        _count: { id: true },
      }),
      prisma.processingJob.groupBy({
        by: ['type'],
        where: whereClause,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.processingJob.count({ where: whereClause }),
    ]);

    return {
      totalJobs,
      statusDistribution: statusStats.map(stat => ({
        status: stat.status,
        count: stat._count.id,
      })),
      typeDistribution: typeStats.map(stat => ({
        type: stat.type,
        count: stat._count.id,
      })),
      timeRange,
    };
  }
}

// Singleton instance
let importOrchestratorService: ImportOrchestratorService | null = null;

export function getImportOrchestratorService(): ImportOrchestratorService {
  if (!importOrchestratorService) {
    importOrchestratorService = new ImportOrchestratorService();
  }
  return importOrchestratorService;
}