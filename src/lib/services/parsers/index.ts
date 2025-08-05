// Main service export
export { 
  FileParserService, 
  fileParserService, 
  FileParserUtils,
  type IFileParserServiceConfig,
  type IParsingTask,
} from './file-parser.service';

// Base interfaces and types
export {
  type IFileParser,
  type IParserConfig,
  type TParsedBlock,
  type TParsedBlockContent,
  type TParserResult,
  type TParserError,
  type TBaseMetadata,
  BaseFileParser,
  parsedBlockSchema,
  parserResultSchema,
  parserErrorSchema,
} from './file-parser.interface';

// Individual parsers
export { 
  CsvParser,
  type ICsvParserConfig,
} from './csv-parser';

export { 
  PdfParser,
  type IPdfParserConfig,
} from './pdf-parser';

export { 
  DocxParser,
  type IDocxParserConfig,
} from './docx-parser';

export { 
  PptxParser,
  type IPptxParserConfig,
} from './pptx-parser';

// Utility functions for quick access
export const ParserFactory = {
  /**
   * Create a CSV parser with default config
   */
  createCsvParser: (config?: ICsvParserConfig) => {
    const parser = new CsvParser();
    return parser;
  },

  /**
   * Create a PDF parser with default config
   */
  createPdfParser: (config?: IPdfParserConfig) => {
    const parser = new PdfParser();
    return parser;
  },

  /**
   * Create a DOCX parser with default config
   */
  createDocxParser: (config?: IDocxParserConfig) => {
    const parser = new DocxParser();
    return parser;
  },

  /**
   * Create a PPTX parser with default config
   */
  createPptxParser: (config?: IPptxParserConfig) => {
    const parser = new PptxParser();
    return parser;
  },

  /**
   * Create the main file parser service with custom config
   */
  createFileParserService: (config?: IFileParserServiceConfig) => {
    return new FileParserService(config);
  },
} as const;

// Quick parsing functions
export const QuickParse = {
  /**
   * Parse CSV from buffer
   */
  csv: async (buffer: Buffer, fileName: string, config?: ICsvParserConfig): Promise<TParserResult> => {
    const parser = new CsvParser();
    return parser.parseFromBuffer(buffer, fileName, 'text/csv', config);
  },

  /**
   * Parse PDF from buffer
   */
  pdf: async (buffer: Buffer, fileName: string, config?: IPdfParserConfig): Promise<TParserResult> => {
    const parser = new PdfParser();
    return parser.parseFromBuffer(buffer, fileName, 'application/pdf', config);
  },

  /**
   * Parse DOCX from buffer
   */
  docx: async (buffer: Buffer, fileName: string, config?: IDocxParserConfig): Promise<TParserResult> => {
    const parser = new DocxParser();
    return parser.parseFromBuffer(buffer, fileName, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', config);
  },

  /**
   * Parse PPTX from buffer
   */
  pptx: async (buffer: Buffer, fileName: string, config?: IPptxParserConfig): Promise<TParserResult> => {
    const parser = new PptxParser();
    return parser.parseFromBuffer(buffer, fileName, 'application/vnd.openxmlformats-officedocument.presentationml.presentation', config);
  },

  /**
   * Auto-detect and parse any supported file
   */
  auto: async (buffer: Buffer, fileName: string, config?: IParserConfig): Promise<TParserResult> => {
    const mimeType = FileParserUtils.detectMimeType(buffer, fileName);
    return fileParserService.parseFromBuffer(buffer, fileName, mimeType, config);
  },
} as const;

// Constants
export const SUPPORTED_MIME_TYPES = [
  'text/csv',
  'application/csv',
  'text/comma-separated-values',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/msword',
  'application/vnd.ms-powerpoint',
] as const;

export const SUPPORTED_EXTENSIONS = [
  '.csv',
  '.pdf',
  '.docx',
  '.pptx',
  '.xlsx',
  '.xls',
  '.doc',
  '.ppt',
] as const;

// Re-export specific types from individual parsers
export type {
  ICsvParserConfig,
  IPdfParserConfig,
  IDocxParserConfig,
  IPptxParserConfig,
};

// Type guards
export const TypeGuards = {
  isParsedBlock: (obj: any): obj is TParsedBlock => {
    return parsedBlockSchema.safeParse(obj).success;
  },

  isParserResult: (obj: any): obj is TParserResult => {
    return parserResultSchema.safeParse(obj).success;
  },

  isParserError: (obj: any): obj is TParserError => {
    return parserErrorSchema.safeParse(obj).success;
  },

  isSupportedMimeType: (mimeType: string): mimeType is typeof SUPPORTED_MIME_TYPES[number] => {
    return SUPPORTED_MIME_TYPES.includes(mimeType as any);
  },

  isSupportedExtension: (extension: string): extension is typeof SUPPORTED_EXTENSIONS[number] => {
    return SUPPORTED_EXTENSIONS.includes(extension as any);
  },
} as const;

// Version info
export const VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();

// Default configurations
export const DEFAULT_CONFIGS = {
  csv: {
    delimiter: ',',
    hasHeaders: true,
    skipEmptyLines: true,
    maxRows: 10000,
    inferTypes: true,
  } as ICsvParserConfig,

  pdf: {
    extractImages: false,
    preserveLayout: true,
    minLineLength: 3,
    mergeLines: true,
    detectHeadings: true,
    detectLists: true,
  } as IPdfParserConfig,

  docx: {
    includeHiddenText: false,
    preserveFormatting: true,
    convertImages: false,
    extractTables: true,
    extractHeaders: false,
    extractFooters: false,
    detectLists: true,
    minParagraphLength: 5,
  } as IDocxParserConfig,

  pptx: {
    extractImages: false,
    extractTables: true,
    extractNotes: false,
    combineSlides: false,
    minTextLength: 3,
    detectTitles: true,
    includeSlideNumbers: true,
  } as IPptxParserConfig,

  service: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    timeout: 5 * 60 * 1000, // 5 minutes
    enabledParsers: ['csv', 'pdf', 'docx', 'pptx'],
  } as IFileParserServiceConfig,
} as const;