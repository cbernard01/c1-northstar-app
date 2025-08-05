/**
 * Example usage of the file parsing services
 * 
 * This file demonstrates how to use the various parsers in the C1 Northstar platform.
 * These examples can be used as reference for implementing file parsing in your application.
 */

import { 
  fileParserService, 
  FileParserUtils, 
  QuickParse,
  ParserFactory,
  DEFAULT_CONFIGS,
  CsvParser,
  PdfParser,
  DocxParser,
  PptxParser,
  type TParserResult,
  type TParsedBlock 
} from './index';

/**
 * Example 1: Basic file parsing with auto-detection
 */
export async function basicParsingExample(buffer: Buffer, fileName: string): Promise<void> {
  try {
    console.log('🔍 Analyzing file:', fileName);
    
    // Get file info without parsing
    const fileInfo = FileParserUtils.getFileInfo(buffer, fileName);
    console.log('📊 File info:', fileInfo);
    
    // Validate file before parsing
    const validation = await FileParserUtils.validateFile(buffer, fileInfo.detectedMimeType);
    if (!validation.valid) {
      console.error('❌ File validation failed:', validation.errors);
      return;
    }
    
    // Parse the file automatically
    const result = await QuickParse.auto(buffer, fileName);
    console.log('✅ Parsing completed:', {
      fileName: result.metadata.fileName,
      totalBlocks: result.metadata.totalBlocks,
      processingTime: `${result.metadata.processingTime}ms`,
      errors: result.metadata.errors,
      warnings: result.metadata.warnings,
    });
    
    // Display parsed content summary
    result.blocks.forEach((block, index) => {
      console.log(`\n📄 Block ${index + 1}:`, {
        type: block.content.type,
        title: block.title,
        preview: getBlockPreview(block),
      });
    });
    
  } catch (error) {
    console.error('❌ Parsing failed:', error);
  }
}

/**
 * Example 2: CSV parsing with specific configuration
 */
export async function csvParsingExample(buffer: Buffer, fileName: string): Promise<void> {
  try {
    console.log('📈 Parsing CSV file:', fileName);
    
    // Detect CSV delimiter
    const delimiter = CsvParser.detectDelimiter(buffer);
    console.log('🔍 Detected delimiter:', delimiter);
    
    // Check if file has headers
    const hasHeaders = CsvParser.hasHeaders(buffer, delimiter);
    console.log('📋 Has headers:', hasHeaders);
    
    // Parse with custom configuration
    const result = await QuickParse.csv(buffer, fileName, {
      delimiter,
      hasHeaders,
      maxRows: 1000,
      inferTypes: true,
      skipEmptyLines: true,
    });
    
    console.log('✅ CSV parsing completed:', {
      totalBlocks: result.metadata.totalBlocks,
      processingTime: `${result.metadata.processingTime}ms`,
    });
    
    // Find table blocks
    const tableBlocks = result.blocks.filter(block => block.content.type === 'table');
    console.log(`📊 Found ${tableBlocks.length} table(s)`);
    
    tableBlocks.forEach((block, index) => {
      if (block.content.type === 'table') {
        console.log(`\nTable ${index + 1}:`, {
          headers: block.content.headers,
          rowCount: block.content.rows.length,
          columnCount: block.content.headers.length,
        });
      }
    });
    
  } catch (error) {
    console.error('❌ CSV parsing failed:', error);
  }
}

/**
 * Example 3: PDF parsing with page range
 */
export async function pdfParsingExample(buffer: Buffer, fileName: string): Promise<void> {
  try {
    console.log('📄 Parsing PDF file:', fileName);
    
    // Get page count first
    const pageCount = await PdfParser.getPageCount(buffer);
    console.log(`📖 PDF has ${pageCount} page(s)`);
    
    // Parse specific page range
    const result = await QuickParse.pdf(buffer, fileName, {
      pageRange: { start: 1, end: Math.min(5, pageCount) }, // First 5 pages
      detectHeadings: true,
      detectLists: true,
      minLineLength: 5,
    });
    
    console.log('✅ PDF parsing completed:', {
      totalBlocks: result.metadata.totalBlocks,
      processingTime: `${result.metadata.processingTime}ms`,
    });
    
    // Analyze content types
    const contentTypes = result.blocks.reduce((acc, block) => {
      acc[block.content.type] = (acc[block.content.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('📊 Content analysis:', contentTypes);
    
    // Show headings
    const headings = result.blocks.filter(block => block.content.type === 'heading');
    if (headings.length > 0) {
      console.log('\n📝 Document headings:');
      headings.forEach((heading, index) => {
        if (heading.content.type === 'heading') {
          console.log(`  ${'  '.repeat(heading.content.level - 1)}${index + 1}. ${heading.content.text}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ PDF parsing failed:', error);
  }
}

/**
 * Example 4: DOCX parsing with table extraction
 */
export async function docxParsingExample(buffer: Buffer, fileName: string): Promise<void> {
  try {
    console.log('📝 Parsing DOCX file:', fileName);
    
    // Extract plain text first for quick preview
    const plainText = await DocxParser.extractPlainText(buffer);
    console.log('📄 Plain text preview:', plainText.slice(0, 200) + '...');
    
    // Parse with table extraction enabled
    const result = await QuickParse.docx(buffer, fileName, {
      extractTables: true,
      detectLists: true,
      preserveFormatting: true,
      minParagraphLength: 10,
    });
    
    console.log('✅ DOCX parsing completed:', {
      totalBlocks: result.metadata.totalBlocks,
      processingTime: `${result.metadata.processingTime}ms`,
    });
    
    // Analyze document structure
    const structure = {
      headings: result.blocks.filter(b => b.content.type === 'heading').length,
      paragraphs: result.blocks.filter(b => b.content.type === 'text').length,
      lists: result.blocks.filter(b => b.content.type === 'list').length,
      tables: result.blocks.filter(b => b.content.type === 'table').length,
    };
    
    console.log('📊 Document structure:', structure);
    
    // Show tables if any
    const tables = result.blocks.filter(block => block.content.type === 'table');
    tables.forEach((table, index) => {
      if (table.content.type === 'table') {
        console.log(`\n📊 Table ${index + 1}:`, {
          title: table.title,
          columns: table.content.headers,
          rows: table.content.rows.length,
        });
      }
    });
    
  } catch (error) {
    console.error('❌ DOCX parsing failed:', error);
  }
}

/**
 * Example 5: PPTX parsing with slide extraction
 */
export async function pptxParsingExample(buffer: Buffer, fileName: string): Promise<void> {
  try {
    console.log('🎯 Parsing PPTX file:', fileName);
    
    // Get slide count first
    const slideCount = await PptxParser.getSlideCount(buffer);
    console.log(`🎪 Presentation has ${slideCount} slide(s)`);
    
    // Extract titles only for quick overview
    const titles = await PptxParser.extractTitles(buffer);
    console.log('📋 Slide titles:', titles);
    
    // Parse full presentation
    const result = await QuickParse.pptx(buffer, fileName, {
      extractTables: true,
      detectTitles: true,
      combineSlides: false, // Keep slides separate
      includeSlideNumbers: true,
    });
    
    console.log('✅ PPTX parsing completed:', {
      totalBlocks: result.metadata.totalBlocks,
      processingTime: `${result.metadata.processingTime}ms`,
    });
    
    // Group blocks by slide number
    const slideBlocks = result.blocks.reduce((acc, block) => {
      const slideNum = block.metadata.slideNumber || 0;
      if (!acc[slideNum]) acc[slideNum] = [];
      acc[slideNum].push(block);
      return acc;
    }, {} as Record<number, TParsedBlock[]>);
    
    console.log('🎪 Slides breakdown:');
    Object.entries(slideBlocks).forEach(([slideNum, blocks]) => {
      if (slideNum !== '0') { // Skip summary blocks
        const slideTitle = blocks.find(b => b.content.type === 'heading')?.title || 'Untitled';
        console.log(`  Slide ${slideNum}: "${slideTitle}" (${blocks.length} blocks)`);
      }
    });
    
  } catch (error) {
    console.error('❌ PPTX parsing failed:', error);
  }
}

/**
 * Example 6: Batch processing multiple files
 */
export async function batchParsingExample(
  files: Array<{ buffer: Buffer; fileName: string; mimeType: string }>
): Promise<void> {
  try {
    console.log('🔄 Processing batch of', files.length, 'files');
    
    const results = await fileParserService.parseMultiple(files, {
      maxConcurrency: 3,
      timeout: 30000, // 30 seconds per file
    });
    
    console.log('✅ Batch processing completed');
    
    // Analyze results
    const successful = results.filter(r => r.result);
    const failed = results.filter(r => r.error);
    
    console.log(`📊 Results: ${successful.length} successful, ${failed.length} failed`);
    
    // Show successful results
    successful.forEach(({ fileName, result }) => {
      if (result) {
        console.log(`✅ ${fileName}: ${result.metadata.totalBlocks} blocks in ${result.metadata.processingTime}ms`);
      }
    });
    
    // Show failures
    failed.forEach(({ fileName, error }) => {
      if (error) {
        console.log(`❌ ${fileName}: ${error.message}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Batch processing failed:', error);
  }
}

/**
 * Example 7: Using the service with custom configuration
 */
export async function customServiceExample(): Promise<void> {
  try {
    console.log('⚙️ Creating custom parser service');
    
    // Create service with custom configuration
    const customService = ParserFactory.createFileParserService({
      maxFileSize: 20 * 1024 * 1024, // 20MB limit
      timeout: 2 * 60 * 1000, // 2 minutes timeout
      enabledParsers: ['csv', 'pdf'], // Only enable specific parsers
      defaultConfigs: {
        csv: {
          ...DEFAULT_CONFIGS.csv,
          maxRows: 5000, // Limit CSV rows
        },
        pdf: {
          ...DEFAULT_CONFIGS.pdf,
          detectHeadings: false, // Disable heading detection
        },
      },
    });
    
    // Check service status
    const health = await customService.healthCheck();
    console.log('🏥 Service health:', health);
    
    // Get service statistics
    const stats = customService.getStatistics();
    console.log('📈 Service statistics:', stats);
    
    // Show supported MIME types
    const supportedTypes = customService.getSupportedMimeTypes();
    console.log('📋 Supported MIME types:', supportedTypes);
    
  } catch (error) {
    console.error('❌ Custom service setup failed:', error);
  }
}

/**
 * Example 8: Error handling and recovery
 */
export async function errorHandlingExample(buffer: Buffer, fileName: string): Promise<void> {
  try {
    console.log('🛡️ Testing error handling for:', fileName);
    
    // Try parsing with very strict limits to trigger errors
    const result = await fileParserService.parseFromBuffer(buffer, fileName, 'unknown/type', {
      maxFileSize: 100, // Very small limit
      timeout: 1, // Very short timeout
    });
    
    console.log('✅ Unexpected success:', result.metadata);
    
  } catch (error: any) {
    console.log('🔍 Caught expected error:');
    
    if (error.code) {
      console.log('  Error code:', error.code);
      console.log('  Error message:', error.message);
      console.log('  Error details:', error.details);
      
      // Handle different error types
      switch (error.code) {
        case 'UNSUPPORTED_FILE':
          console.log('💡 Suggestion: Check if file type is supported');
          break;
        case 'IO_ERROR':
          console.log('💡 Suggestion: Check file path and permissions');
          break;
        case 'CORRUPTED_FILE':
          console.log('💡 Suggestion: Verify file integrity');
          break;
        case 'PARSING_ERROR':
          console.log('💡 Suggestion: Try with different parser settings');
          break;
      }
    } else {
      console.log('  Generic error:', error.message);
    }
  }
}

/**
 * Helper function to get a preview of a parsed block
 */
function getBlockPreview(block: TParsedBlock): string {
  switch (block.content.type) {
    case 'text':
      return block.content.text.slice(0, 100) + (block.content.text.length > 100 ? '...' : '');
    
    case 'heading':
      return `Level ${block.content.level}: ${block.content.text}`;
    
    case 'list':
      return `${block.content.ordered ? 'Ordered' : 'Unordered'} list with ${block.content.items.length} items`;
    
    case 'table':
      return `Table with ${block.content.headers.length} columns and ${block.content.rows.length} rows`;
    
    default:
      return 'Unknown content type';
  }
}

/**
 * Usage examples function - demonstrates how to use all examples
 */
export async function runAllExamples(): Promise<void> {
  console.log('🚀 Running all parser examples...\n');
  
  // Note: In a real application, you would have actual file buffers
  // These examples assume you have buffers from uploaded files
  
  try {
    // Example data (in real usage, these would come from file uploads)
    const csvBuffer = Buffer.from('name,age,city\nJohn,30,NYC\nJane,25,LA');
    const mockPdfBuffer = Buffer.from('%PDF-1.4\n...mock pdf content...');
    
    console.log('1️⃣ Basic parsing example:');
    await basicParsingExample(csvBuffer, 'sample.csv');
    
    console.log('\n2️⃣ CSV parsing example:');
    await csvParsingExample(csvBuffer, 'data.csv');
    
    console.log('\n7️⃣ Custom service example:');
    await customServiceExample();
    
    console.log('\n8️⃣ Error handling example:');
    await errorHandlingExample(Buffer.from('invalid'), 'invalid.xyz');
    
    console.log('\n✅ All examples completed!');
    
  } catch (error) {
    console.error('❌ Example execution failed:', error);
  }
}