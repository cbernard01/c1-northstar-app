import { z } from 'zod';

// Base metadata for all parsed blocks
export const baseMetadataSchema = z.object({
  pageNumber: z.number().optional(),
  lineNumber: z.number().optional(),
  slideNumber: z.number().optional(),
  paragraphNumber: z.number().optional(),
  confidence: z.number().min(0).max(1).optional(),
  source: z.string().optional(),
  timestamp: z.date().optional(),
});

// Parsed block content types
export const parsedBlockContentSchema = z.union([
  z.object({
    type: z.literal('text'),
    text: z.string(),
  }),
  z.object({
    type: z.literal('table'),
    headers: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  }),
  z.object({
    type: z.literal('list'),
    items: z.array(z.string()),
    ordered: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('heading'),
    text: z.string(),
    level: z.number().min(1).max(6),
  }),
]);

// Main parsed block schema
export const parsedBlockSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  content: parsedBlockContentSchema,
  metadata: baseMetadataSchema,
  rawText: z.string().optional(), // Original text for reference
});

// Parser result schema
export const parserResultSchema = z.object({
  blocks: z.array(parsedBlockSchema),
  metadata: z.object({
    fileName: z.string(),
    fileSize: z.number(),
    fileType: z.string(),
    totalBlocks: z.number(),
    processingTime: z.number(),
    errors: z.array(z.string()).default([]),
    warnings: z.array(z.string()).default([]),
  }),
});

// Error handling schema
export const parserErrorSchema = z.object({
  code: z.enum(['UNSUPPORTED_FILE', 'CORRUPTED_FILE', 'PARSING_ERROR', 'IO_ERROR']),
  message: z.string(),
  details: z.record(z.any()).optional(),
});

// Type exports
export type TBaseMetadata = z.infer<typeof baseMetadataSchema>;
export type TParsedBlockContent = z.infer<typeof parsedBlockContentSchema>;
export type TParsedBlock = z.infer<typeof parsedBlockSchema>;
export type TParserResult = z.infer<typeof parserResultSchema>;
export type TParserError = z.infer<typeof parserErrorSchema>;

// Parser configuration interface
export interface IParserConfig {
  maxFileSize?: number; // in bytes
  timeout?: number; // in milliseconds
  encoding?: string;
  preserveFormatting?: boolean;
  extractImages?: boolean;
  extractTables?: boolean;
}

// Base file parser interface
export interface IFileParser {
  readonly supportedMimeTypes: string[];
  readonly name: string;
  readonly version: string;

  /**
   * Check if the parser supports the given file type
   */
  canParse(mimeType: string): boolean;

  /**
   * Parse a file from buffer
   */
  parseFromBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    config?: IParserConfig
  ): Promise<TParserResult>;

  /**
   * Parse a file from file path
   */
  parseFromPath(
    filePath: string,
    config?: IParserConfig
  ): Promise<TParserResult>;

  /**
   * Validate file before parsing
   */
  validateFile(buffer: Buffer, mimeType: string): Promise<void>;

  /**
   * Get parser-specific metadata
   */
  getMetadata(): {
    name: string;
    version: string;
    supportedMimeTypes: string[];
    features: string[];
  };
}

// Abstract base parser class
export abstract class BaseFileParser implements IFileParser {
  abstract readonly supportedMimeTypes: string[];
  abstract readonly name: string;
  abstract readonly version: string;

  canParse(mimeType: string): boolean {
    return this.supportedMimeTypes.includes(mimeType);
  }

  abstract parseFromBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    config?: IParserConfig
  ): Promise<TParserResult>;

  async parseFromPath(
    filePath: string,
    config?: IParserConfig
  ): Promise<TParserResult> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
      const buffer = await fs.readFile(filePath);
      const fileName = path.basename(filePath);
      const stats = await fs.stat(filePath);
      
      // Determine MIME type from extension (simplified)
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = this.getMimeTypeFromExtension(ext);
      
      if (!this.canParse(mimeType)) {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }

      // Validate file size
      if (config?.maxFileSize && stats.size > config.maxFileSize) {
        throw new Error(`File size ${stats.size} exceeds maximum ${config.maxFileSize}`);
      }

      return this.parseFromBuffer(buffer, fileName, mimeType, config);
    } catch (error) {
      throw new Error(`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async validateFile(buffer: Buffer, mimeType: string): Promise<void> {
    if (!this.canParse(mimeType)) {
      throw new Error(`Unsupported MIME type: ${mimeType}`);
    }

    if (buffer.length === 0) {
      throw new Error('Empty file');
    }
  }

  getMetadata() {
    return {
      name: this.name,
      version: this.version,
      supportedMimeTypes: this.supportedMimeTypes,
      features: this.getFeatures(),
    };
  }

  protected abstract getFeatures(): string[];

  protected getMimeTypeFromExtension(ext: string): string {
    const mimeTypes: Record<string, string> = {
      '.csv': 'text/csv',
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  protected generateBlockId(): string {
    return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected createParserResult(
    blocks: TParsedBlock[],
    fileName: string,
    fileSize: number,
    fileType: string,
    processingTime: number,
    errors: string[] = [],
    warnings: string[] = []
  ): TParserResult {
    return {
      blocks,
      metadata: {
        fileName,
        fileSize,
        fileType,
        totalBlocks: blocks.length,
        processingTime,
        errors,
        warnings,
      },
    };
  }

  protected createTextBlock(
    text: string,
    title?: string,
    metadata: Partial<TBaseMetadata> = {}
  ): TParsedBlock {
    return {
      id: this.generateBlockId(),
      title,
      content: {
        type: 'text',
        text,
      },
      metadata: {
        ...metadata,
        timestamp: new Date(),
      },
      rawText: text,
    };
  }

  protected createTableBlock(
    headers: string[],
    rows: string[][],
    title?: string,
    metadata: Partial<TBaseMetadata> = {}
  ): TParsedBlock {
    return {
      id: this.generateBlockId(),
      title,
      content: {
        type: 'table',
        headers,
        rows,
      },
      metadata: {
        ...metadata,
        timestamp: new Date(),
      },
      rawText: [headers.join('\t'), ...rows.map(row => row.join('\t'))].join('\n'),
    };
  }

  protected createListBlock(
    items: string[],
    ordered: boolean = false,
    title?: string,
    metadata: Partial<TBaseMetadata> = {}
  ): TParsedBlock {
    return {
      id: this.generateBlockId(),
      title,
      content: {
        type: 'list',
        items,
        ordered,
      },
      metadata: {
        ...metadata,
        timestamp: new Date(),
      },
      rawText: items.join('\n'),
    };
  }

  protected createHeadingBlock(
    text: string,
    level: number,
    metadata: Partial<TBaseMetadata> = {}
  ): TParsedBlock {
    return {
      id: this.generateBlockId(),
      title: text,
      content: {
        type: 'heading',
        text,
        level,
      },
      metadata: {
        ...metadata,
        timestamp: new Date(),
      },
      rawText: text,
    };
  }
}