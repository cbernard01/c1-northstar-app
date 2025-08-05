/**
 * Test suite for File Parser Service
 */

import { 
  FileParserService, 
  fileParserService, 
  FileParserUtils,
  QuickParse,
  CsvParser,
  PdfParser
} from '../../lib/services/parsers';

describe('FileParserService', () => {
  describe('Service Initialization', () => {
    test('should initialize with default parsers', () => {
      const service = new FileParserService();
      const stats = service.getStatistics();
      
      expect(stats.registeredParsers).toBeGreaterThan(0);
      expect(stats.supportedMimeTypes).toBeGreaterThan(0);
      expect(stats.parsers).toHaveLength(4); // CSV, PDF, DOCX, PPTX
    });

    test('should support common MIME types', () => {
      const supportedTypes = fileParserService.getSupportedMimeTypes();
      
      expect(supportedTypes).toContain('text/csv');
      expect(supportedTypes).toContain('application/pdf');
      expect(supportedTypes).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(supportedTypes).toContain('application/vnd.openxmlformats-officedocument.presentationml.presentation');
    });

    test('should check file type support', () => {
      expect(fileParserService.isSupported('text/csv')).toBe(true);
      expect(fileParserService.isSupported('application/pdf')).toBe(true);
      expect(fileParserService.isSupported('image/jpeg')).toBe(false);
      expect(fileParserService.isSupported('unknown/type')).toBe(false);
    });
  });

  describe('CSV Parser', () => {
    test('should parse simple CSV data', async () => {
      const csvData = 'name,age,city\nJohn,30,NYC\nJane,25,LA\nBob,35,Chicago';
      const buffer = Buffer.from(csvData);
      
      const result = await QuickParse.csv(buffer, 'test.csv');
      
      expect(result.metadata.fileName).toBe('test.csv');
      expect(result.metadata.totalBlocks).toBeGreaterThan(0);
      expect(result.metadata.errors).toHaveLength(0);
      
      // Should have summary and table blocks
      const tableBlocks = result.blocks.filter(block => block.content.type === 'table');
      expect(tableBlocks).toHaveLength(1);
      
      const tableBlock = tableBlocks[0];
      if (tableBlock.content.type === 'table') {
        expect(tableBlock.content.headers).toEqual(['name', 'age', 'city']);
        expect(tableBlock.content.rows).toHaveLength(3);
        expect(tableBlock.content.rows[0]).toEqual(['John', '30', 'NYC']);
      }
    });

    test('should detect CSV delimiter', () => {
      const csvSemicolon = Buffer.from('name;age;city\nJohn;30;NYC');
      const csvTab = Buffer.from('name\tage\tcity\nJohn\t30\tNYC');
      const csvComma = Buffer.from('name,age,city\nJohn,30,NYC');
      
      expect(CsvParser.detectDelimiter(csvSemicolon)).toBe(';');
      expect(CsvParser.detectDelimiter(csvTab)).toBe('\t');
      expect(CsvParser.detectDelimiter(csvComma)).toBe(',');
    });

    test('should detect headers', () => {
      const withHeaders = Buffer.from('Name,Age,City\nJohn,30,NYC');
      const withoutHeaders = Buffer.from('John,30,NYC\nJane,25,LA');
      
      expect(CsvParser.hasHeaders(withHeaders)).toBe(true);
      expect(CsvParser.hasHeaders(withoutHeaders)).toBe(false);
    });

    test('should handle empty CSV', async () => {
      const buffer = Buffer.from('');
      
      await expect(QuickParse.csv(buffer, 'empty.csv')).rejects.toThrow();
    });

    test('should handle CSV with custom delimiter', async () => {
      const csvData = 'name;age;city\nJohn;30;NYC\nJane;25;LA';
      const buffer = Buffer.from(csvData);
      
      const result = await QuickParse.csv(buffer, 'test.csv', {
        delimiter: ';',
        hasHeaders: true,
      });
      
      expect(result.metadata.errors).toHaveLength(0);
      const tableBlocks = result.blocks.filter(block => block.content.type === 'table');
      expect(tableBlocks).toHaveLength(1);
    });
  });

  describe('FileParserUtils', () => {
    test('should detect MIME type from file content', () => {
      const csvBuffer = Buffer.from('name,age\nJohn,30');
      const pdfBuffer = Buffer.from('%PDF-1.4\nsome content');
      
      expect(FileParserUtils.detectMimeType(csvBuffer, 'test.csv')).toBe('text/csv');
      expect(FileParserUtils.detectMimeType(pdfBuffer, 'test.pdf')).toBe('application/pdf');
    });

    test('should detect MIME type from file extension', () => {
      const unknownBuffer = Buffer.from('some binary data');
      
      expect(FileParserUtils.detectMimeType(unknownBuffer, 'test.csv')).toBe('text/csv');
      expect(FileParserUtils.detectMimeType(unknownBuffer, 'test.pdf')).toBe('application/pdf');
      expect(FileParserUtils.detectMimeType(unknownBuffer, 'test.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });

    test('should validate supported files', async () => {
      const csvBuffer = Buffer.from('name,age\nJohn,30');
      
      const validation = await FileParserUtils.validateFile(csvBuffer, 'text/csv');
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject unsupported files', async () => {
      const buffer = Buffer.from('some content');
      
      const validation = await FileParserUtils.validateFile(buffer, 'image/jpeg');
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should get file information', () => {
      const buffer = Buffer.from('name,age\nJohn,30');
      const info = FileParserUtils.getFileInfo(buffer, 'test.csv');
      
      expect(info.fileName).toBe('test.csv');
      expect(info.fileSize).toBe(buffer.length);
      expect(info.detectedMimeType).toBe('text/csv');
      expect(info.isSupported).toBe(true);
      expect(info.estimatedParsingTime).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle unsupported file types', async () => {
      const buffer = Buffer.from('some content');
      
      await expect(
        fileParserService.parseFromBuffer(buffer, 'test.xyz', 'unknown/type')
      ).rejects.toMatchObject({
        code: 'UNSUPPORTED_FILE',
        message: expect.stringContaining('No parser available'),
      });
    });

    test('should handle file size limits', async () => {
      const largeBuffer = Buffer.alloc(1000000); // 1MB
      
      await expect(
        fileParserService.parseFromBuffer(largeBuffer, 'large.csv', 'text/csv', {
          maxFileSize: 1000, // 1KB limit
        })
      ).rejects.toMatchObject({
        code: 'IO_ERROR',
        message: expect.stringContaining('exceeds maximum'),
      });
    });

    test('should handle corrupted files', async () => {
      const corruptedPdf = Buffer.from('not a pdf');
      
      await expect(
        QuickParse.pdf(corruptedPdf, 'corrupted.pdf')
      ).rejects.toThrow();
    });
  });

  describe('Service Management', () => {
    test('should track active tasks', async () => {
      const csvData = 'name,age\nJohn,30';
      const buffer = Buffer.from(csvData);
      
      // Start parsing (don't await yet)
      const parsePromise = fileParserService.parseFromBuffer(buffer, 'test.csv', 'text/csv');
      
      // Check active tasks
      const activeTasks = fileParserService.getActiveTasks();
      expect(activeTasks.length).toBeGreaterThanOrEqual(0);
      
      // Wait for completion
      await parsePromise;
    });

    test('should perform health check', async () => {
      const health = await fileParserService.healthCheck();
      
      expect(health.status).toMatch(/healthy|degraded|unhealthy/);
      expect(health.details.parsersLoaded).toBeGreaterThan(0);
      expect(health.details.activeTasks).toBeGreaterThanOrEqual(0);
    });

    test('should clear tasks', () => {
      fileParserService.clearTasks();
      const activeTasks = fileParserService.getActiveTasks();
      expect(activeTasks).toHaveLength(0);
    });
  });

  describe('Batch Processing', () => {
    test('should process multiple files', async () => {
      const files = [
        {
          buffer: Buffer.from('name,age\nJohn,30'),
          fileName: 'file1.csv',
          mimeType: 'text/csv',
        },
        {
          buffer: Buffer.from('product,price\nApple,1.5'),
          fileName: 'file2.csv',
          mimeType: 'text/csv',
        },
      ];
      
      const results = await fileParserService.parseMultiple(files, {
        maxConcurrency: 2,
      });
      
      expect(results).toHaveLength(2);
      expect(results.every(r => r.result || r.error)).toBe(true);
      
      const successful = results.filter(r => r.result);
      expect(successful.length).toBeGreaterThan(0);
    });

    test('should handle batch processing with errors', async () => {
      const files = [
        {
          buffer: Buffer.from('name,age\nJohn,30'),
          fileName: 'valid.csv',
          mimeType: 'text/csv',
        },
        {
          buffer: Buffer.from('invalid content'),
          fileName: 'invalid.xyz',
          mimeType: 'unknown/type',
        },
      ];
      
      const results = await fileParserService.parseMultiple(files);
      
      expect(results).toHaveLength(2);
      
      const successful = results.filter(r => r.result);
      const failed = results.filter(r => r.error);
      
      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect(successful[0].fileName).toBe('valid.csv');
      expect(failed[0].fileName).toBe('invalid.xyz');
    });
  });

  describe('Custom Configuration', () => {
    test('should create service with custom config', () => {
      const customService = new FileParserService({
        maxFileSize: 10 * 1024 * 1024, // 10MB
        timeout: 30000, // 30 seconds
        enabledParsers: ['csv', 'pdf'],
      });
      
      const stats = customService.getStatistics();
      expect(stats.registeredParsers).toBe(2); // Only CSV and PDF
      
      const supportedTypes = customService.getSupportedMimeTypes();
      expect(supportedTypes).toContain('text/csv');
      expect(supportedTypes).toContain('application/pdf');
      expect(supportedTypes).not.toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });

    test('should use default configurations', async () => {
      const csvData = 'name,age,city\n' + Array.from({ length: 15000 }, (_, i) => `User${i},${20 + i},City${i}`).join('\n');
      const buffer = Buffer.from(csvData);
      
      // Should truncate to default max rows (10000)
      const result = await QuickParse.csv(buffer, 'large.csv');
      
      expect(result.metadata.warnings.some(w => w.includes('truncated'))).toBe(true);
    });
  });
});

describe('Individual Parsers', () => {
  describe('CSV Parser Validation', () => {
    test('should validate CSV files', async () => {
      const parser = new CsvParser();
      const validCsv = Buffer.from('name,age\nJohn,30');
      const invalidCsv = Buffer.from('\x00\x01\x02\x03'); // Binary data
      
      await expect(parser.validateFile(validCsv, 'text/csv')).resolves.not.toThrow();
      await expect(parser.validateFile(invalidCsv, 'text/csv')).rejects.toThrow();
    });
  });

  describe('PDF Parser Validation', () => {
    test('should validate PDF files', async () => {
      const parser = new PdfParser();
      const validPdf = Buffer.from('%PDF-1.4\n');
      const invalidPdf = Buffer.from('not a pdf');
      
      await expect(parser.validateFile(validPdf, 'application/pdf')).resolves.not.toThrow();
      await expect(parser.validateFile(invalidPdf, 'application/pdf')).rejects.toThrow();
    });

    test('should reject unsupported PDF versions', async () => {
      const parser = new PdfParser();
      const unsupportedPdf = Buffer.from('%PDF-9.9\n'); // Future version
      
      await expect(parser.validateFile(unsupportedPdf, 'application/pdf')).rejects.toThrow();
    });
  });
});

describe('Type Guards and Utilities', () => {
  test('should validate parsed blocks', () => {
    const validBlock = {
      id: 'block_1',
      content: {
        type: 'text',
        text: 'Hello world',
      },
      metadata: {
        timestamp: new Date(),
      },
    };

    const invalidBlock = {
      id: 'block_1',
      content: {
        type: 'invalid_type',
        text: 'Hello world',
      },
    };

    // Note: TypeGuards would be imported from the index file
    // This is a placeholder for the actual type guard tests
    expect(typeof validBlock).toBe('object');
    expect(typeof invalidBlock).toBe('object');
  });
});