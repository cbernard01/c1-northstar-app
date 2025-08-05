import { DocumentStatus, DocumentScope } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getChunkingService } from '@/lib/services/chunking';
import { QuickParse } from '@/lib/services/parsers';
import { TParserResult } from '@/lib/services/parsers/file-parser.interface';

export interface AssetImportData {
  fileName: string;
  originalName: string;
  buffer: Buffer;
  fileSize: number;
  mimeType: string;
  title?: string;
  category?: string;
  scope?: DocumentScope;
  accountId?: string;
  accountNumber?: string;
  metadata?: any;
}

export interface AssetImportOptions {
  batchSize?: number;
  generateChunks?: boolean;
  storeVectors?: boolean;
  vectorScope?: 'sales-assets' | 'account-summary' | 'general';
  detectCategory?: boolean;
  extractMetadata?: boolean;
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  chunkingOptions?: {
    chunkSize?: number;
    chunkOverlap?: number;
    preserveStructure?: boolean;
  };
}

export interface AssetImportResult {
  total: number;
  imported: number;
  failed: number;
  skipped: number;
  chunksGenerated: number;
  vectorsStored: number;
  errors: Array<{
    file: string;
    error: string;
  }>;
  warnings: Array<{
    file: string;
    warning: string;
  }>;
  documentIds: string[];
  processingTime: number;
}

export interface AssetImportProgress {
  stage: 'uploading' | 'parsing' | 'processing' | 'chunking' | 'vectorizing' | 'completed';
  processed: number;
  total: number;
  currentFile?: string;
  currentStage?: string;
  errors: number;
  warnings: number;
}

export class AssetImportService {
  private readonly chunkingService = getChunkingService();
  private readonly SUPPORTED_TYPES = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  };

  /**
   * Import single asset
   */
  async importAsset(
    data: AssetImportData,
    userId: string,
    options: AssetImportOptions = {},
    onProgress?: (progress: AssetImportProgress) => void
  ): Promise<AssetImportResult> {
    const startTime = Date.now();
    const result: AssetImportResult = {
      total: 1,
      imported: 0,
      failed: 0,
      skipped: 0,
      chunksGenerated: 0,
      vectorsStored: 0,
      errors: [],
      warnings: [],
      documentIds: [],
      processingTime: 0,
    };

    try {
      // Validate file
      const validation = this.validateAsset(data, options);
      if (validation.errors.length > 0) {
        result.errors.push(...validation.errors);
        result.failed = 1;
        return result;
      }

      if (validation.warnings.length > 0) {
        result.warnings.push(...validation.warnings);
      }

      // Stage 1: Upload and create document record
      onProgress?.({
        stage: 'uploading',
        processed: 0,
        total: 1,
        currentFile: data.fileName,
        errors: result.errors.length,
        warnings: result.warnings.length,
      });

      const document = await this.createDocumentRecord(data, userId);
      result.documentIds.push(document.id);

      // Stage 2: Parse the file
      onProgress?.({
        stage: 'parsing',
        processed: 0,
        total: 1,
        currentFile: data.fileName,
        currentStage: 'Parsing document content',
        errors: result.errors.length,
        warnings: result.warnings.length,
      });

      let parserResult: TParserResult;
      try {
        parserResult = await this.parseAsset(data);
      } catch (error) {
        await this.updateDocumentStatus(document.id, DocumentStatus.FAILED, error.message);
        result.errors.push({
          file: data.fileName,
          error: `Parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        result.failed = 1;
        return result;
      }

      // Update document with parsing results
      await this.updateDocumentWithParserResult(document.id, parserResult, data, options);

      // Stage 3: Process metadata and categorization
      onProgress?.({
        stage: 'processing',
        processed: 0,
        total: 1,
        currentFile: data.fileName,
        currentStage: 'Processing metadata',
        errors: result.errors.length,
        warnings: result.warnings.length,
      });

      if (options.detectCategory || options.extractMetadata) {
        await this.processDocumentMetadata(document.id, parserResult, options);
      }

      // Stage 4: Generate chunks if requested
      if (options.generateChunks || options.storeVectors) {
        onProgress?.({
          stage: 'chunking',
          processed: 0,
          total: 1,
          currentFile: data.fileName,
          currentStage: 'Generating chunks',
          errors: result.errors.length,
          warnings: result.warnings.length,
        });

        const chunkingResult = await this.generateChunks(
          document.id,
          parserResult,
          data,
          options
        );

        result.chunksGenerated = chunkingResult.chunksGenerated;
        result.vectorsStored = chunkingResult.vectorsStored;

        if (chunkingResult.errors.length > 0) {
          result.warnings.push(...chunkingResult.errors.map(error => ({
            file: data.fileName,
            warning: `Chunking warning: ${error}`,
          })));
        }
      }

      // Stage 5: Store vectors if requested
      if (options.storeVectors) {
        onProgress?.({
          stage: 'vectorizing',
          processed: 0,
          total: 1,
          currentFile: data.fileName,
          currentStage: 'Storing vectors',
          errors: result.errors.length,
          warnings: result.warnings.length,
        });

        // Vector storage is handled in the chunking process
        await this.updateDocumentStatus(document.id, DocumentStatus.PROCESSED);
      } else {
        await this.updateDocumentStatus(document.id, DocumentStatus.CHUNKING);
      }

      result.imported = 1;

      onProgress?.({
        stage: 'completed',
        processed: 1,
        total: 1,
        currentFile: data.fileName,
        errors: result.errors.length,
        warnings: result.warnings.length,
      });

      result.processingTime = Date.now() - startTime;

      logger.info('AssetImportService: Asset imported successfully', {
        fileName: data.fileName,
        documentId: document.id,
        processingTime: result.processingTime,
      });

      return result;

    } catch (error) {
      result.errors.push({
        file: data.fileName,
        error: error instanceof Error ? error.message : 'Unknown import error',
      });
      result.failed = 1;
      result.processingTime = Date.now() - startTime;

      logger.error('AssetImportService: Asset import failed', {
        fileName: data.fileName,
        error,
      });

      return result;
    }
  }

  /**
   * Import multiple assets in batch
   */
  async importAssetBatch(
    assets: AssetImportData[],
    userId: string,
    options: AssetImportOptions = {},
    onProgress?: (progress: AssetImportProgress) => void
  ): Promise<AssetImportResult> {
    const startTime = Date.now();
    const result: AssetImportResult = {
      total: assets.length,
      imported: 0,
      failed: 0,
      skipped: 0,
      chunksGenerated: 0,
      vectorsStored: 0,
      errors: [],
      warnings: [],
      documentIds: [],
      processingTime: 0,
    };

    const batchSize = options.batchSize || 5;

    for (let i = 0; i < assets.length; i += batchSize) {
      const batch = assets.slice(i, i + batchSize);
      
      // Process batch concurrently
      const batchPromises = batch.map(async (asset, batchIndex) => {
        const globalIndex = i + batchIndex;
        
        try {
          const assetResult = await this.importAsset(asset, userId, options, (assetProgress) => {
            onProgress?.({
              ...assetProgress,
              processed: globalIndex,
              total: assets.length,
              currentFile: asset.fileName,
            });
          });

          return assetResult;
        } catch (error) {
          return {
            total: 1,
            imported: 0,
            failed: 1,
            skipped: 0,
            chunksGenerated: 0,
            vectorsStored: 0,
            errors: [{
              file: asset.fileName,
              error: error instanceof Error ? error.message : 'Unknown batch error',
            }],
            warnings: [],
            documentIds: [],
            processingTime: 0,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Aggregate batch results
      for (const batchResult of batchResults) {
        result.imported += batchResult.imported;
        result.failed += batchResult.failed;
        result.skipped += batchResult.skipped;
        result.chunksGenerated += batchResult.chunksGenerated;
        result.vectorsStored += batchResult.vectorsStored;
        result.errors.push(...batchResult.errors);
        result.warnings.push(...batchResult.warnings);
        result.documentIds.push(...batchResult.documentIds);
      }

      onProgress?.({
        stage: 'processing',
        processed: Math.min(i + batchSize, assets.length),
        total: assets.length,
        errors: result.errors.length,
        warnings: result.warnings.length,
      });
    }

    result.processingTime = Date.now() - startTime;

    logger.info('AssetImportService: Batch import completed', {
      total: result.total,
      imported: result.imported,
      failed: result.failed,
      processingTime: result.processingTime,
    });

    return result;
  }

  /**
   * Validate asset before import
   */
  private validateAsset(
    data: AssetImportData,
    options: AssetImportOptions
  ): {
    errors: Array<{ file: string; error: string }>;
    warnings: Array<{ file: string; warning: string }>;
  } {
    const errors: Array<{ file: string; error: string }> = [];
    const warnings: Array<{ file: string; warning: string }> = [];

    // Check file size
    const maxSize = options.maxFileSize || 50 * 1024 * 1024; // 50MB default
    if (data.fileSize > maxSize) {
      errors.push({
        file: data.fileName,
        error: `File size (${Math.round(data.fileSize / 1024 / 1024)}MB) exceeds limit (${Math.round(maxSize / 1024 / 1024)}MB)`,
      });
    }

    // Check MIME type
    const allowedTypes = options.allowedMimeTypes || Object.keys(this.SUPPORTED_TYPES);
    if (!allowedTypes.includes(data.mimeType)) {
      errors.push({
        file: data.fileName,
        error: `Unsupported file type: ${data.mimeType}`,
      });
    }

    // Check file name
    if (!data.fileName || data.fileName.trim().length === 0) {
      errors.push({
        file: data.fileName || 'Unknown',
        error: 'File name is required',
      });
    }

    // Warnings for large files
    if (data.fileSize > 10 * 1024 * 1024) { // 10MB
      warnings.push({
        file: data.fileName,
        warning: 'Large file may take longer to process',
      });
    }

    return { errors, warnings };
  }

  /**
   * Create document record in database
   */
  private async createDocumentRecord(data: AssetImportData, userId: string) {
    // Find account if specified
    let accountId = data.accountId;
    if (!accountId && data.accountNumber) {
      const account = await prisma.companyAccount.findUnique({
        where: { accountNumber: data.accountNumber },
      });
      accountId = account?.id;
    }

    const document = await prisma.document.create({
      data: {
        fileName: data.fileName,
        originalName: data.originalName,
        fileSize: data.fileSize,
        fileType: this.SUPPORTED_TYPES[data.mimeType as keyof typeof this.SUPPORTED_TYPES] || 'unknown',
        mimeType: data.mimeType,
        status: DocumentStatus.UPLOADED,
        title: data.title,
        category: data.category,
        scope: data.scope || DocumentScope.GENERAL,
        userId,
        uploadedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return document;
  }

  /**
   * Parse asset using appropriate parser
   */
  private async parseAsset(data: AssetImportData): Promise<TParserResult> {
    switch (data.mimeType) {
      case 'application/pdf':
        return await QuickParse.pdf(data.buffer, data.fileName);
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await QuickParse.docx(data.buffer, data.fileName);
      case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        return await QuickParse.pptx(data.buffer, data.fileName);
      case 'text/csv':
      case 'application/vnd.ms-excel':
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        return await QuickParse.csv(data.buffer, data.fileName);
      default:
        // For text files and others, create a basic parser result
        const content = data.buffer.toString('utf-8');
        return {
          blocks: [{
            id: uuidv4(),
            content: {
              type: 'text',
              text: content,
            },
            metadata: {
              blockType: 'text',
              lineNumber: 1,
            },
            rawText: content,
          }],
          metadata: {
            fileName: data.fileName,
            fileSize: data.fileSize,
            fileType: data.mimeType,
            totalBlocks: 1,
            processingTime: 0,
            errors: [],
            warnings: [],
          },
        };
    }
  }

  /**
   * Update document with parser result
   */
  private async updateDocumentWithParserResult(
    documentId: string,
    parserResult: TParserResult,
    data: AssetImportData,
    options: AssetImportOptions
  ) {
    const updateData: any = {
      status: DocumentStatus.PARSING,
      totalBlocks: parserResult.blocks.length,
      updatedAt: new Date(),
    };

    // Extract title from content if not provided
    if (!data.title && parserResult.blocks.length > 0) {
      const firstBlock = parserResult.blocks[0];
      if (firstBlock.content.type === 'text' && firstBlock.content.text) {
        const firstLine = firstBlock.content.text.split('\n')[0];
        if (firstLine.length > 5 && firstLine.length < 100) {
          updateData.title = firstLine.trim();
        }
      }
    }

    await prisma.document.update({
      where: { id: documentId },
      data: updateData,
    });
  }

  /**
   * Process document metadata and categorization
   */
  private async processDocumentMetadata(
    documentId: string,
    parserResult: TParserResult,
    options: AssetImportOptions
  ) {
    const updateData: any = {};

    if (options.detectCategory) {
      // Simple category detection based on content
      const content = parserResult.blocks
        .map(block => block.rawText || '')
        .join('\n')
        .toLowerCase();

      if (content.includes('case study') || content.includes('customer story')) {
        updateData.category = 'Case Study';
        updateData.scope = DocumentScope.CASE_STUDIES;
      } else if (content.includes('data sheet') || content.includes('specification')) {
        updateData.category = 'Data Sheet';
        updateData.scope = DocumentScope.DATA_SHEETS;
      } else if (content.includes('proposal') || content.includes('quotation')) {
        updateData.category = 'Proposal';
        updateData.scope = DocumentScope.PROPOSALS;
      } else if (content.includes('training') || content.includes('tutorial')) {
        updateData.category = 'Training Material';
        updateData.scope = DocumentScope.TRAINING;
      } else if (content.includes('technical') || content.includes('manual')) {
        updateData.category = 'Technical Documentation';
        updateData.scope = DocumentScope.TECHNICAL_DOCS;
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.document.update({
        where: { id: documentId },
        data: updateData,
      });
    }
  }

  /**
   * Generate chunks from parsed content
   */
  private async generateChunks(
    documentId: string,
    parserResult: TParserResult,
    data: AssetImportData,
    options: AssetImportOptions
  ): Promise<{
    chunksGenerated: number;
    vectorsStored: number;
    errors: string[];
  }> {
    const result = {
      chunksGenerated: 0,
      vectorsStored: 0,
      errors: [],
    };

    try {
      // Use chunking service to process the document
      const chunkingOptions = {
        generateEmbeddings: options.storeVectors,
        storeVectors: options.storeVectors,
        scope: options.vectorScope,
        accountNumber: data.accountNumber,
        assetMetadata: {
          documentId,
          fileName: data.fileName,
          category: data.category,
          scope: data.scope,
        },
      };

      const chunkingResult = await this.chunkingService.processDocument(
        parserResult,
        chunkingOptions
      );

      if (chunkingResult.chunks) {
        result.chunksGenerated = chunkingResult.chunks.length;
        
        // Update document with chunk count
        await prisma.document.update({
          where: { id: documentId },
          data: {
            totalChunks: result.chunksGenerated,
            status: DocumentStatus.CHUNKING,
            updatedAt: new Date(),
          },
        });

        if (options.storeVectors) {
          result.vectorsStored = result.chunksGenerated;
          await this.updateDocumentStatus(documentId, DocumentStatus.VECTORIZING);
        }
      }

      if (chunkingResult.errors) {
        result.errors = chunkingResult.errors;
      }

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown chunking error');
      await this.updateDocumentStatus(documentId, DocumentStatus.FAILED, result.errors.join(', '));
    }

    return result;
  }

  /**
   * Update document status
   */
  private async updateDocumentStatus(
    documentId: string,
    status: DocumentStatus,
    errorMessage?: string
  ) {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === DocumentStatus.PROCESSED) {
      updateData.processedAt = new Date();
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    await prisma.document.update({
      where: { id: documentId },
      data: updateData,
    });
  }

  /**
   * Get asset import statistics
   */
  async getImportStats(timeRange: 'day' | 'week' | 'month' = 'day') {
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

    const [statusStats, typeStats, scopeStats, totalSize] = await Promise.all([
      prisma.document.groupBy({
        by: ['status'],
        where: {
          createdAt: { gte: startDate },
        },
        _count: { id: true },
      }),
      prisma.document.groupBy({
        by: ['fileType'],
        where: {
          createdAt: { gte: startDate },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.document.groupBy({
        by: ['scope'],
        where: {
          createdAt: { gte: startDate },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.document.aggregate({
        where: {
          createdAt: { gte: startDate },
        },
        _sum: { fileSize: true },
      }),
    ]);

    return {
      statusDistribution: statusStats.map(stat => ({
        status: stat.status,
        count: stat._count.id,
      })),
      typeDistribution: typeStats.map(stat => ({
        type: stat.fileType,
        count: stat._count.id,
      })),
      scopeDistribution: scopeStats.map(stat => ({
        scope: stat.scope,
        count: stat._count.id,
      })),
      totalSizeBytes: totalSize._sum.fileSize || 0,
      timeRange,
    };
  }

  /**
   * Get supported file types
   */
  getSupportedTypes(): Record<string, string> {
    return { ...this.SUPPORTED_TYPES };
  }

  /**
   * Check if file type is supported
   */
  isSupported(mimeType: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.SUPPORTED_TYPES, mimeType);
  }

  /**
   * Get file extension from MIME type
   */
  getFileExtension(mimeType: string): string {
    return this.SUPPORTED_TYPES[mimeType as keyof typeof this.SUPPORTED_TYPES] || 'unknown';
  }
}

// Singleton instance
let assetImportService: AssetImportService | null = null;

export function getAssetImportService(): AssetImportService {
  if (!assetImportService) {
    assetImportService = new AssetImportService();
  }
  return assetImportService;
}