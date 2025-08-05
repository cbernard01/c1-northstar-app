# File Parser Services

A comprehensive file parsing system for the C1 Northstar Sales Intelligence Platform, supporting CSV, PDF, DOCX, and PPTX files with production-ready features.

## Features

- **Multi-format Support**: CSV, PDF, DOCX, PPTX parsing
- **Type-safe**: Full TypeScript support with Zod validation
- **Async Processing**: Non-blocking parsing with timeout support
- **Error Handling**: Robust error handling with specific error codes
- **Batch Processing**: Handle multiple files concurrently
- **Validation**: File format validation before parsing
- **Configurable**: Extensive configuration options per parser
- **Monitoring**: Built-in health checks and task tracking

## Quick Start

```typescript
import { fileParserService, QuickParse } from '@/lib/services/parsers';

// Auto-detect and parse any supported file
const result = await QuickParse.auto(buffer, fileName);

// Or use specific parsers
const csvResult = await QuickParse.csv(buffer, 'data.csv');
const pdfResult = await QuickParse.pdf(buffer, 'document.pdf');
const docxResult = await QuickParse.docx(buffer, 'report.docx');
const pptxResult = await QuickParse.pptx(buffer, 'presentation.pptx');
```

## Service Usage

### Basic Parsing

```typescript
import { fileParserService } from '@/lib/services/parsers';

// Parse from buffer
const result = await fileParserService.parseFromBuffer(
  buffer, 
  'filename.csv', 
  'text/csv'
);

// Parse from file path
const result = await fileParserService.parseFromPath('/path/to/file.csv');
```

### Batch Processing

```typescript
const files = [
  { buffer: csvBuffer, fileName: 'data.csv', mimeType: 'text/csv' },
  { buffer: pdfBuffer, fileName: 'report.pdf', mimeType: 'application/pdf' },
];

const results = await fileParserService.parseMultiple(files, {
  maxConcurrency: 3,
  timeout: 30000,
});
```

### Configuration

```typescript
// CSV Parser Configuration
const csvConfig = {
  delimiter: ',',
  hasHeaders: true,
  skipEmptyLines: true,
  maxRows: 10000,
  inferTypes: true,
};

// PDF Parser Configuration
const pdfConfig = {
  pageRange: { start: 1, end: 5 },
  detectHeadings: true,
  detectLists: true,
  minLineLength: 5,
};

// DOCX Parser Configuration
const docxConfig = {
  extractTables: true,
  preserveFormatting: true,
  detectLists: true,
  minParagraphLength: 10,
};

// PPTX Parser Configuration
const pptxConfig = {
  extractTables: true,
  detectTitles: true,
  combineSlides: false,
  includeSlideNumbers: true,
};
```

## Parsed Output Structure

All parsers return a standardized `TParserResult`:

```typescript
{
  blocks: TParsedBlock[],     // Array of parsed content blocks
  metadata: {
    fileName: string,
    fileSize: number,
    fileType: string,
    totalBlocks: number,
    processingTime: number,
    errors: string[],
    warnings: string[],
  }
}
```

### Block Types

Each block has a specific content type:

- **Text Block**: Plain text content
- **Heading Block**: Document headings with levels
- **List Block**: Ordered/unordered lists
- **Table Block**: Structured tabular data

```typescript
// Text Block
{
  id: string,
  content: { type: 'text', text: string },
  metadata: { pageNumber?: number, confidence?: number }
}

// Table Block
{
  id: string,
  content: { 
    type: 'table', 
    headers: string[], 
    rows: string[][] 
  },
  metadata: { source: string }
}
```

## Error Handling

The service provides structured error handling:

```typescript
try {
  const result = await fileParserService.parseFromBuffer(buffer, name, type);
} catch (error: TParserError) {
  switch (error.code) {
    case 'UNSUPPORTED_FILE':
      // Handle unsupported file type
      break;
    case 'CORRUPTED_FILE':
      // Handle corrupted file
      break;
    case 'PARSING_ERROR':
      // Handle parsing errors
      break;
    case 'IO_ERROR':
      // Handle I/O errors
      break;
  }
}
```

## Validation

Validate files before parsing:

```typescript
import { FileParserUtils } from '@/lib/services/parsers';

// Detect MIME type
const mimeType = FileParserUtils.detectMimeType(buffer, fileName);

// Validate file
const validation = await FileParserUtils.validateFile(buffer, mimeType);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}

// Get file information
const info = FileParserUtils.getFileInfo(buffer, fileName);
console.log(`Estimated parsing time: ${info.estimatedParsingTime}s`);
```

## Monitoring

Monitor service health and active tasks:

```typescript
// Health check
const health = await fileParserService.healthCheck();
console.log('Service status:', health.status);

// Get statistics
const stats = fileParserService.getStatistics();
console.log('Active parsers:', stats.registeredParsers);

// Track active tasks
const tasks = fileParserService.getActiveTasks();
console.log('Processing:', tasks.length, 'files');
```

## Individual Parser Features

### CSV Parser
- Auto-detects delimiters (`,`, `;`, `\t`, `|`)
- Header detection and inference
- Type inference for columns
- Row limits and pagination
- Empty line handling

### PDF Parser
- Page range selection
- Heading detection with levels
- List extraction
- Layout preservation options
- Metadata extraction

### DOCX Parser
- Table extraction
- Style preservation
- List detection
- Header/footer extraction
- Image handling (optional)

### PPTX Parser
- Slide-by-slide parsing
- Title extraction
- Bullet point detection
- Table extraction
- Speaker notes (optional)

## Custom Parser Development

Extend the system with custom parsers:

```typescript
import { BaseFileParser, IParserConfig, TParserResult } from '@/lib/services/parsers';

class CustomParser extends BaseFileParser {
  readonly name = 'Custom Parser';
  readonly version = '1.0.0';
  readonly supportedMimeTypes = ['custom/type'];

  async parseFromBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    config?: IParserConfig
  ): Promise<TParserResult> {
    // Implement parsing logic
    return this.createParserResult(blocks, fileName, buffer.length, mimeType, processingTime);
  }

  protected getFeatures(): string[] {
    return ['Custom feature 1', 'Custom feature 2'];
  }
}

// Register the parser
fileParserService.registerParser('custom', new CustomParser());
```

## Performance Considerations

- **File Size Limits**: Default 50MB, configurable per service
- **Timeout Settings**: Default 5 minutes, configurable per operation
- **Concurrency**: Batch processing with configurable concurrency limits
- **Memory Usage**: Streaming where possible to minimize memory footprint
- **Caching**: Consider implementing result caching for frequently parsed files

## Dependencies

The parsers rely on these key libraries:
- `csv-parser`: CSV parsing
- `pdf-parse`: PDF text extraction
- `mammoth`: DOCX text and HTML extraction
- `pptx2json`: PPTX slide extraction
- `adm-zip`: ZIP archive handling (fallback)
- `zod`: Runtime type validation

## Testing

Run the verification script to test all parsers:

```bash
npx tsx src/lib/services/parsers/verify.ts
```

## Integration with C1 Northstar

The parsers integrate with the platform's:
- Job queue system for background processing
- AI services for content analysis
- Database for storing parsed results
- WebSocket for real-time progress updates

Example integration:

```typescript
// In an API route
export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await fileParserService.parseFromBuffer(
    buffer,
    file.name,
    file.type
  );
  
  // Process with AI services
  // Store in database
  // Update job status
  
  return Response.json(result.metadata);
}
```

## Best Practices

1. **Always validate files** before parsing
2. **Use appropriate timeouts** for large files
3. **Handle errors gracefully** with user-friendly messages
4. **Monitor memory usage** during batch processing
5. **Cache results** when parsing the same files repeatedly
6. **Use specific parsers** when file type is known
7. **Implement progress tracking** for long-running operations

## Troubleshooting

### Common Issues

**"No parser available for MIME type"**
- Check if the file type is supported
- Verify MIME type detection is correct
- File extension might not match content

**"File size exceeds maximum"**
- Increase `maxFileSize` in configuration
- Consider splitting large files
- Use streaming processing for very large files

**"Parsing timeout"**
- Increase `timeout` setting
- Check file complexity
- Consider processing in chunks

**"File does not have valid signature"**
- File might be corrupted
- Wrong file extension
- Unsupported file version

### Debug Mode

Enable detailed logging:

```typescript
const result = await fileParserService.parseFromBuffer(buffer, name, type, {
  // Add debug configuration
});

console.log('Errors:', result.metadata.errors);
console.log('Warnings:', result.metadata.warnings);
```