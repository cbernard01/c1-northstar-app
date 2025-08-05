import path from 'path';

import { JobStatus, UploadStatus } from '@prisma/client';
import { Worker } from 'bullmq';

import { prisma } from '../prisma';
import { QUEUE_NAMES, FileProcessingJobData, JobTracker } from '../queue';
import { redisConnection } from '../redis';
import { FileProcessor } from '../services/file-processor';
import { WebSocketEmitter } from '../websocket';

export class FileProcessorWorker {
  private worker: Worker;

  constructor() {
    this.worker = new Worker(
      QUEUE_NAMES.FILE_PROCESSING,
      this.processFile.bind(this),
      {
        connection: redisConnection,
        concurrency: 5, // Process up to 5 files concurrently
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 20 },
      }
    );

    this.worker.on('completed', (job) => {
      console.log(`File processing job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`File processing job ${job?.id} failed:`, err);
    });

    this.worker.on('progress', (job, progress) => {
      console.log(`File processing job ${job.id} progress: ${progress}%`);
    });
  }

  private async processFile(job: any) {
    const data: FileProcessingJobData = job.data;
    const { uploadId, userId, fileName, fileType, filePath } = data;
    
    try {
      // Update job status to running
      await JobTracker.updateJobStatus(job.id, JobStatus.RUNNING);
      await this.updateUploadStatus(uploadId, UploadStatus.PROCESSING, 0);
      
      // Emit real-time update
      WebSocketEmitter.emitJobUpdate(userId, {
        id: job.id,
        status: 'running',
        progress: 0,
        message: 'Starting file processing...',
      });

      // Check if file exists
      const fullPath = path.resolve(filePath);
      
      // Update progress
      await job.updateProgress(10);
      await this.updateUploadStatus(uploadId, UploadStatus.PROCESSING, 10);
      
      WebSocketEmitter.emitJobUpdate(userId, {
        id: job.id,
        status: 'running',
        progress: 10,
        message: 'Analyzing file structure...',
      });

      // Process the file
      const result = await FileProcessor.processFile(fullPath, fileType);
      
      // Update progress
      await job.updateProgress(50);
      await this.updateUploadStatus(uploadId, UploadStatus.PROCESSING, 50);
      
      WebSocketEmitter.emitJobUpdate(userId, {
        id: job.id,
        status: 'running',
        progress: 50,
        message: 'Extracting data from file...',
      });

      // Create accounts from extracted data
      const { accountsCreated, accountsUpdated } = await this.createAccountsFromData(
        result.extractedData,
        userId
      );
      
      // Update progress
      await job.updateProgress(75);
      await this.updateUploadStatus(uploadId, UploadStatus.PROCESSING, 75);
      
      WebSocketEmitter.emitJobUpdate(userId, {
        id: job.id,
        status: 'running',
        progress: 75,
        message: 'Creating account records...',
      });

      // Generate insights
      const insightsGenerated = await this.generateInsights(accountsCreated + accountsUpdated);
      
      // Update final result
      const finalResult = {
        ...result,
        accountsCreated,
        accountsUpdated,
        insightsGenerated,
      };

      // Update upload record with final results
      await prisma.upload.update({
        where: { id: uploadId },
        data: {
          status: UploadStatus.COMPLETED,
          progress: 100,
          accountsFound: result.accountsFound,
          accountsCreated,
          accountsUpdated,
          insightsGenerated,
          processingTime: result.processingTime,
          completedAt: new Date(),
        },
      });

      // Update job status to completed
      await JobTracker.updateJobStatus(job.id, JobStatus.COMPLETED, finalResult);
      
      // Emit completion update
      WebSocketEmitter.emitJobUpdate(userId, {
        id: job.id,
        status: 'completed',
        progress: 100,
        message: 'File processing completed successfully',
        result: finalResult,
      });

      // Emit notification
      WebSocketEmitter.emitNotification(userId, {
        id: `notification-${Date.now()}`,
        type: 'success',
        title: 'File Processed Successfully',
        message: `Processed ${fileName} - Created ${accountsCreated} accounts, updated ${accountsUpdated} accounts`,
        timestamp: Date.now(),
        read: false,
      });

      return finalResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update upload and job status to failed
      await prisma.upload.update({
        where: { id: uploadId },
        data: {
          status: UploadStatus.FAILED,
          errorMessage,
        },
      });
      
      await JobTracker.updateJobStatus(job.id, JobStatus.FAILED, null, errorMessage);
      
      // Emit failure update
      WebSocketEmitter.emitJobUpdate(userId, {
        id: job.id,
        status: 'failed',
        progress: 0,
        message: `File processing failed: ${errorMessage}`,
      });

      // Emit error notification
      WebSocketEmitter.emitNotification(userId, {
        id: `notification-${Date.now()}`,
        type: 'error',
        title: 'File Processing Failed',
        message: `Failed to process ${fileName}: ${errorMessage}`,
        timestamp: Date.now(),
        read: false,
      });

      throw error;
    }
  }

  private async updateUploadStatus(uploadId: string, status: UploadStatus, progress: number) {
    try {
      await prisma.upload.update({
        where: { id: uploadId },
        data: { status, progress },
      });
    } catch (error) {
      console.error('Failed to update upload status:', error);
    }
  }

  private async createAccountsFromData(data: any[], userId: string): Promise<{ accountsCreated: number; accountsUpdated: number }> {
    let accountsCreated = 0;
    let accountsUpdated = 0;

    // This is a simplified implementation - in production you'd have more sophisticated
    // logic to map extracted data to account fields
    for (const item of data) {
      try {
        // Look for company name and domain in the data
        const companyName = this.extractCompanyName(item);
        const domain = this.extractDomain(item);
        
        if (companyName) {
          // Check if account already exists
          const existing = domain 
            ? await prisma.companyAccount.findUnique({ where: { domain } })
            : await prisma.companyAccount.findFirst({ 
                where: { 
                  name: { equals: companyName, mode: 'insensitive' } 
                } 
              });

          if (existing) {
            // Update existing account
            await prisma.companyAccount.update({
              where: { id: existing.id },
              data: {
                description: this.extractDescription(item) || existing.description,
                industry: this.extractIndustry(item) || existing.industry,
                size: this.extractSize(item) || existing.size,
                location: this.extractLocation(item) || existing.location,
                updatedAt: new Date(),
              },
            });
            accountsUpdated++;
          } else {
            // Create new account
            await prisma.companyAccount.create({
              data: {
                name: companyName,
                domain,
                description: this.extractDescription(item),
                industry: this.extractIndustry(item),
                size: this.extractSize(item),
                location: this.extractLocation(item),
                website: domain ? `https://${domain}` : null,
                metadata: { source: 'file_upload', originalData: item },
              },
            });
            accountsCreated++;
          }
        }
      } catch (error) {
        console.error('Error processing account data:', error);
      }
    }

    return { accountsCreated, accountsUpdated };
  }

  private extractCompanyName(data: any): string | null {
    const fields = ['company', 'companyName', 'name', 'organization', 'business'];
    for (const field of fields) {
      if (data[field] && typeof data[field] === 'string') {
        return data[field].trim();
      }
    }
    return null;
  }

  private extractDomain(data: any): string | null {
    const fields = ['domain', 'website', 'url', 'email'];
    for (const field of fields) {
      if (data[field] && typeof data[field] === 'string') {
        const value = data[field].toLowerCase();
        // Extract domain from email or URL
        if (value.includes('@')) {
          return value.split('@')[1];
        }
        if (value.includes('://')) {
          try {
            return new URL(value).hostname;
          } catch (e) {
            continue;
          }
        }
        // Assume it's already a domain
        if (value.includes('.')) {
          return value;
        }
      }
    }
    return null;
  }

  private extractDescription(data: any): string | null {
    const fields = ['description', 'about', 'summary', 'overview'];
    for (const field of fields) {
      if (data[field] && typeof data[field] === 'string') {
        return data[field].trim();
      }
    }
    return null;
  }

  private extractIndustry(data: any): string | null {
    const fields = ['industry', 'sector', 'vertical', 'market'];
    for (const field of fields) {
      if (data[field] && typeof data[field] === 'string') {
        return data[field].trim();
      }
    }
    return null;
  }

  private extractSize(data: any): string | null {
    const fields = ['size', 'employees', 'companySize', 'headcount'];
    for (const field of fields) {
      if (data[field]) {
        const value = String(data[field]).toLowerCase();
        if (value.includes('startup') || value.includes('1-10')) return 'startup';
        if (value.includes('small') || value.includes('11-50')) return 'small';
        if (value.includes('medium') || value.includes('51-200')) return 'medium';
        if (value.includes('large') || value.includes('201-1000')) return 'large';
        if (value.includes('enterprise') || value.includes('1000+')) return 'enterprise';
      }
    }
    return null;
  }

  private extractLocation(data: any): string | null {
    const fields = ['location', 'address', 'city', 'country', 'headquarters'];
    for (const field of fields) {
      if (data[field] && typeof data[field] === 'string') {
        return data[field].trim();
      }
    }
    return null;
  }

  private async generateInsights(accountCount: number): Promise<number> {
    // Placeholder for insight generation - in production this would be more sophisticated
    return Math.floor(accountCount * 0.3); // Generate insights for 30% of accounts
  }

  public close() {
    return this.worker.close();
  }
}