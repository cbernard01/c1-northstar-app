import { 
  IFileParser, 
  IParserConfig, 
  TParserResult, 
  TParserError,
  parserErrorSchema 
} from './file-parser.interface';
import { CsvParser, ICsvParserConfig } from './csv-parser';
import { PdfParser, IPdfParserConfig } from './pdf-parser';
import { DocxParser, IDocxParserConfig } from './docx-parser';
import { PptxParser, IPptxParserConfig } from './pptx-parser';

export interface IFileParserServiceConfig {
  maxFileSize?: number; // Global max file size in bytes
  timeout?: number; // Global timeout in milliseconds
  enabledParsers?: string[]; // Array of parser names to enable
  defaultConfigs?: {
    csv?: ICsvParserConfig;
    pdf?: IPdfParserConfig;
    docx?: IDocxParserConfig;
    pptx?: IPptxParserConfig;
  };
}

export interface IParsingTask {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  result?: TParserResult;
  error?: TParserError;
  progress?: number;
}

export class FileParserService {
  private parsers: Map<string, IFileParser> = new Map();
  private activeTasks: Map<string, IParsingTask> = new Map();
  private config: IFileParserServiceConfig;

  constructor(config: IFileParserServiceConfig = {}) {
    this.config = {
      maxFileSize: 50 * 1024 * 1024, // 50MB default
      timeout: 5 * 60 * 1000, // 5 minutes default
      enabledParsers: ['csv', 'pdf', 'docx', 'pptx'],
      ...config,
    };

    this.initializeParsers();
  }

  private initializeParsers(): void {
    const { enabledParsers } = this.config;

    if (!enabledParsers || enabledParsers.includes('csv')) {
      this.parsers.set('csv', new CsvParser());
    }

    if (!enabledParsers || enabledParsers.includes('pdf')) {
      this.parsers.set('pdf', new PdfParser());
    }

    if (!enabledParsers || enabledParsers.includes('docx')) {
      this.parsers.set('docx', new DocxParser());
    }

    if (!enabledParsers || enabledParsers.includes('pptx')) {
      this.parsers.set('pptx', new PptxParser());
    }
  }

  /**
   * Get all supported MIME types from registered parsers
   */
  getSupportedMimeTypes(): string[] {
    const mimeTypes = new Set<string>();
    
    this.parsers.forEach(parser => {
      parser.supportedMimeTypes.forEach(type => mimeTypes.add(type));
    });

    return Array.from(mimeTypes);
  }

  /**
   * Check if a file type is supported
   */
  isSupported(mimeType: string): boolean {
    return Array.from(this.parsers.values()).some(parser => parser.canParse(mimeType));
  }

  /**
   * Get the appropriate parser for a MIME type
   */
  getParserForMimeType(mimeType: string): IFileParser | null {
    for (const parser of this.parsers.values()) {
      if (parser.canParse(mimeType)) {
        return parser;
      }
    }
    return null;
  }

  /**
   * Parse a file from buffer
   */
  async parseFromBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    config?: IParserConfig
  ): Promise<TParserResult> {
    const taskId = this.generateTaskId();
    const task: IParsingTask = {
      id: taskId,
      fileName,
      fileSize: buffer.length,
      mimeType,
      status: 'pending',
      progress: 0,
    };

    this.activeTasks.set(taskId, task);
    
    try {
      // Validate file size
      const maxSize = config?.maxFileSize || this.config.maxFileSize || 50 * 1024 * 1024;
      if (buffer.length > maxSize) {
        throw this.createError(
          'IO_ERROR',
          `File size ${buffer.length} exceeds maximum allowed size ${maxSize}`,
          { fileSize: buffer.length, maxSize }
        );
      }

      // Get appropriate parser
      const parser = this.getParserForMimeType(mimeType);
      if (!parser) {
        throw this.createError(
          'UNSUPPORTED_FILE',
          `No parser available for MIME type: ${mimeType}`,
          { mimeType, supportedTypes: this.getSupportedMimeTypes() }
        );
      }

      // Update task status
      task.status = 'processing';
      task.startTime = new Date();
      task.progress = 10;

      // Get parser-specific config
      const parserConfig = this.getParserConfig(parser.name, config);

      // Set up timeout
      const timeout = parserConfig?.timeout || this.config.timeout || 5 * 60 * 1000;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(this.createError(
            'PARSING_ERROR',
            `Parsing timeout after ${timeout}ms`,
            { timeout, fileName }
          ));
        }, timeout);
      });

      // Parse with timeout
      const parsePromise = parser.parseFromBuffer(buffer, fileName, mimeType, parserConfig);
      const result = await Promise.race([parsePromise, timeoutPromise]);

      // Update task completion
      task.status = 'completed';
      task.endTime = new Date();
      task.progress = 100;
      task.result = result;

      return result;

    } catch (error) {
      // Update task error
      task.status = 'failed';
      task.endTime = new Date();
      task.error = this.normalizeError(error);

      throw task.error;
    } finally {
      // Clean up task after some time
      setTimeout(() => {
        this.activeTasks.delete(taskId);
      }, 5 * 60 * 1000); // Keep for 5 minutes
    }
  }

  /**
   * Parse a file from file path
   */
  async parseFromPath(
    filePath: string,
    config?: IParserConfig
  ): Promise<TParserResult> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
      const stats = await fs.stat(filePath);
      const fileName = path.basename(filePath);
      const buffer = await fs.readFile(filePath);
      const mimeType = this.getMimeTypeFromPath(filePath);

      return this.parseFromBuffer(buffer, fileName, mimeType, {
        ...config,
        maxFileSize: config?.maxFileSize || stats.size + 1000, // Add buffer
      });
    } catch (error) {
      throw this.createError(
        'IO_ERROR',
        `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { filePath }
      );
    }
  }

  /**
   * Parse multiple files concurrently
   */
  async parseMultiple(
    files: Array<{ buffer: Buffer; fileName: string; mimeType: string }>,
    config?: IParserConfig & { maxConcurrency?: number }
  ): Promise<Array<{ fileName: string; result?: TParserResult; error?: TParserError }>> {
    const maxConcurrency = config?.maxConcurrency || 3;
    const results: Array<{ fileName: string; result?: TParserResult; error?: TParserError }> = [];
    
    // Process files in batches
    for (let i = 0; i < files.length; i += maxConcurrency) {
      const batch = files.slice(i, i + maxConcurrency);
      
      const batchPromises = batch.map(async file => {
        try {
          const result = await this.parseFromBuffer(
            file.buffer,
            file.fileName,
            file.mimeType,
            config
          );
          return { fileName: file.fileName, result };
        } catch (error) {
          return { 
            fileName: file.fileName, 
            error: this.normalizeError(error) 
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Get parsing task status
   */
  getTaskStatus(taskId: string): IParsingTask | null {
    return this.activeTasks.get(taskId) || null;
  }

  /**
   * Get all active tasks
   */
  getActiveTasks(): IParsingTask[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Cancel a parsing task (if possible)
   */
  cancelTask(taskId: string): boolean {
    const task = this.activeTasks.get(taskId);
    if (task && task.status === 'processing') {
      task.status = 'failed';
      task.error = this.createError('PARSING_ERROR', 'Task cancelled by user');
      task.endTime = new Date();
      return true;
    }
    return false;
  }

  /**
   * Get service statistics
   */
  getStatistics(): {
    registeredParsers: number;
    supportedMimeTypes: number;
    activeTasks: number;
    parsers: Array<{ name: string; version: string; supportedTypes: string[] }>;
  } {
    return {
      registeredParsers: this.parsers.size,
      supportedMimeTypes: this.getSupportedMimeTypes().length,
      activeTasks: this.activeTasks.size,
      parsers: Array.from(this.parsers.values()).map(parser => ({
        name: parser.name,
        version: parser.version,
        supportedTypes: parser.supportedMimeTypes,
      })),
    };
  }

  /**
   * Register a custom parser
   */
  registerParser(name: string, parser: IFileParser): void {
    this.parsers.set(name, parser);
  }

  /**
   * Unregister a parser
   */
  unregisterParser(name: string): boolean {
    return this.parsers.delete(name);
  }

  /**
   * Clear all parsing history and active tasks
   */
  clearTasks(): void {
    this.activeTasks.clear();
  }

  private getParserConfig(parserName: string, globalConfig?: IParserConfig): IParserConfig | undefined {
    const baseConfig = globalConfig || {};
    const defaultConfigs = this.config.defaultConfigs || {};
    
    switch (parserName.toLowerCase()) {
      case 'csv parser':
        return { ...baseConfig, ...defaultConfigs.csv };
      case 'pdf parser':
        return { ...baseConfig, ...defaultConfigs.pdf };
      case 'docx parser':
        return { ...baseConfig, ...defaultConfigs.docx };
      case 'pptx parser':
        return { ...baseConfig, ...defaultConfigs.pptx };
      default:
        return baseConfig;
    }
  }

  private getMimeTypeFromPath(filePath: string): string {
    const path = require('path');
    const ext = path.extname(filePath).toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      '.csv': 'text/csv',
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.doc': 'application/msword',
      '.ppt': 'application/vnd.ms-powerpoint',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createError(code: TParserError['code'], message: string, details?: Record<string, any>): TParserError {
    return {
      code,
      message,
      details,
    };
  }

  private normalizeError(error: unknown): TParserError {
    if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
      // Already a parser error
      const result = parserErrorSchema.safeParse(error);
      if (result.success) {
        return result.data;
      }
    }

    // Convert to parser error
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // Determine error code based on message content
    let code: TParserError['code'] = 'PARSING_ERROR';
    if (message.includes('timeout')) {
      code = 'PARSING_ERROR';
    } else if (message.includes('Unsupported') || message.includes('MIME type')) {
      code = 'UNSUPPORTED_FILE';
    } else if (message.includes('signature') || message.includes('corrupted')) {
      code = 'CORRUPTED_FILE';
    } else if (message.includes('file') || message.includes('read')) {
      code = 'IO_ERROR';
    }

    return this.createError(code, message);
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      parsersLoaded: number;
      activeTasks: number;
      memoryUsage?: NodeJS.MemoryUsage;
    };
  }> {
    try {
      const parsersLoaded = this.parsers.size;
      const activeTasks = this.activeTasks.size;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (parsersLoaded === 0) {
        status = 'unhealthy';
      } else if (activeTasks > 10) {
        status = 'degraded';
      }

      return {
        status,
        details: {
          parsersLoaded,
          activeTasks,
          memoryUsage: process.memoryUsage(),
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          parsersLoaded: 0,
          activeTasks: 0,
        },
      };
    }
  }
}

// Export singleton instance
export const fileParserService = new FileParserService();

// Export utility functions
export const FileParserUtils = {
  /**
   * Detect file type from buffer content
   */
  detectMimeType(buffer: Buffer, fileName?: string): string {
    // Check magic numbers/signatures
    if (buffer.length >= 4) {
      const signature = buffer.slice(0, 4);
      
      // PDF
      if (buffer.slice(0, 5).toString() === '%PDF-') {
        return 'application/pdf';
      }
      
      // ZIP-based formats (DOCX, PPTX, XLSX)
      if (signature.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
        // Need to check internal structure to determine exact type
        const content = buffer.toString('utf-8', 0, Math.min(2000, buffer.length));
        if (content.includes('word/')) {
          return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        } else if (content.includes('ppt/')) {
          return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        } else if (content.includes('xl/')) {
          return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        }
      }
    }

    // Fall back to file extension if available
    if (fileName) {
      const ext = fileName.toLowerCase().split('.').pop();
      const mimeTypes: Record<string, string> = {
        'csv': 'text/csv',
        'pdf': 'application/pdf',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'xls': 'application/vnd.ms-excel',
        'doc': 'application/msword',
        'ppt': 'application/vnd.ms-powerpoint',
      };
      
      if (ext && mimeTypes[ext]) {
        return mimeTypes[ext];
      }
    }

    // Default to CSV if it looks like text
    const preview = buffer.slice(0, 1000).toString('utf-8');
    if (/^[a-zA-Z0-9\s,;|\t\n\r"'-]+$/.test(preview)) {
      return 'text/csv';
    }

    return 'application/octet-stream';
  },

  /**
   * Validate file before parsing
   */
  async validateFile(buffer: Buffer, mimeType: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const parser = fileParserService.getParserForMimeType(mimeType);
      if (!parser) {
        errors.push(`Unsupported file type: ${mimeType}`);
        return { valid: false, errors };
      }

      await parser.validateFile(buffer, mimeType);
      return { valid: true, errors: [] };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Validation failed');
      return { valid: false, errors };
    }
  },

  /**
   * Get file information without parsing
   */
  getFileInfo(buffer: Buffer, fileName: string, mimeType?: string): {
    fileName: string;
    fileSize: number;
    detectedMimeType: string;
    isSupported: boolean;
    estimatedParsingTime: number; // in seconds
  } {
    const detectedMimeType = mimeType || this.detectMimeType(buffer, fileName);
    const isSupported = fileParserService.isSupported(detectedMimeType);
    
    // Rough estimation based on file size and type
    let estimatedParsingTime = 1; // Base 1 second
    const sizeMB = buffer.length / (1024 * 1024);
    
    if (detectedMimeType.includes('pdf')) {
      estimatedParsingTime = Math.max(1, sizeMB * 2); // 2 seconds per MB for PDF
    } else if (detectedMimeType.includes('docx') || detectedMimeType.includes('pptx')) {
      estimatedParsingTime = Math.max(1, sizeMB * 1.5); // 1.5 seconds per MB for Office docs
    } else if (detectedMimeType.includes('csv')) {
      estimatedParsingTime = Math.max(0.5, sizeMB * 0.5); // 0.5 seconds per MB for CSV
    }

    return {
      fileName,
      fileSize: buffer.length,
      detectedMimeType,
      isSupported,
      estimatedParsingTime: Math.ceil(estimatedParsingTime),
    };
  },
};