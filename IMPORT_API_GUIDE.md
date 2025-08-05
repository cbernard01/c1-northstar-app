# Import API System Guide

This guide covers the comprehensive import API system for the C1 Northstar Sales Intelligence Platform.

## Overview

The import system supports importing four main types of data:
- **Accounts** - Company account data from CSV
- **Products** - Product catalog data from CSV  
- **Opportunities** - Sales opportunity data from CSV
- **Assets** - Documents (PDF, DOCX, PPTX) with vectorization

## API Endpoints

### Account Import
- `POST /api/import/accounts` - Import accounts from CSV
- `GET /api/import/accounts/validate` - Validate account CSV structure

### Product Import
- `POST /api/import/products` - Import products from CSV
- `GET /api/import/products/validate` - Validate product CSV structure
- `GET /api/import/products/stats` - Get import statistics

### Opportunity Import
- `POST /api/import/opportunities` - Import opportunities from CSV
- `GET /api/import/opportunities/validate` - Validate opportunity CSV structure
- `GET /api/import/opportunities/stats` - Get import statistics

### Asset Import
- `POST /api/import/assets` - Import and process documents
- `GET /api/import/assets/supported-types` - Get supported file types
- `GET /api/import/assets/validate` - Validate asset files
- `GET /api/import/assets/stats` - Get import statistics

### Batch Import
- `POST /api/import/batch` - Complex batch import with multiple file types
- `GET /api/import/batch/validate` - Get batch import information

### Job Management
- `GET /api/import/jobs` - List import jobs with filtering
- `GET /api/import/jobs/{jobId}` - Get specific job status
- `DELETE /api/import/jobs/{jobId}` - Cancel import job

### System
- `GET /api/import/stats` - Get comprehensive import statistics
- `GET /api/import/health` - Check import services health
- `POST /api/import/validate` - Validate CSV files before import
- `GET /api/import/validate/templates` - Get CSV templates

## Usage Examples

### 1. Import Accounts

```typescript
const formData = new FormData();
formData.append('file', accountsFile);
formData.append('options', JSON.stringify({
  skipDuplicates: true,
  updateExisting: false,
  createChunks: true,
  storeVectors: true,
}));

const response = await fetch('/api/import/accounts', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
```

### 2. Import Products with SCD

```typescript
const formData = new FormData();
formData.append('file', productsFile);
formData.append('options', JSON.stringify({
  enableSCD: true,
  updateExisting: true,
  batchSize: 100,
}));

const response = await fetch('/api/import/products', {
  method: 'POST',
  body: formData,
});
```

### 3. Import Assets with Vectorization

```typescript
const formData = new FormData();
formData.append('files', pdfFile1);
formData.append('files', pdfFile2);
formData.append('options', JSON.stringify({
  generateChunks: true,
  storeVectors: true,
  vectorScope: 'sales-assets',
  detectCategory: true,
}));

const response = await fetch('/api/import/assets', {
  method: 'POST',
  body: formData,
});
```

### 4. Batch Import with Multiple Types

```typescript
const formData = new FormData();
formData.append('accountsFile', accountsCsv);
formData.append('productsFile', productsCsv);
formData.append('opportunitiesFile', opportunitiesCsv);
formData.append('assetFiles', salesDeck1);
formData.append('assetFiles', dataSheet1);

formData.append('options', JSON.stringify({
  generateInsights: true,
  createVectors: true,
  linkRelatedData: true,
  processOrder: ['accounts', 'products', 'opportunities', 'assets'],
}));

const response = await fetch('/api/import/batch', {
  method: 'POST',
  body: formData,
});

const { jobId } = await response.json();

// Track progress
const jobStatus = await fetch(`/api/import/jobs/${jobId}`);
```

### 5. Validate CSV Before Import

```typescript
const formData = new FormData();
formData.append('file', csvFile);
formData.append('type', 'accounts');

const response = await fetch('/api/import/validate', {
  method: 'POST',
  body: formData,
});

const validation = await response.json();
if (validation.valid) {
  // Proceed with import
} else {
  // Show validation errors
  console.log('Errors:', validation.errors);
  console.log('Warnings:', validation.warnings);
}
```

## CSV Format Requirements

### Accounts CSV
Required columns:
- `name` or `account_name` or `company_name`

Recommended columns:
- `domain`, `industry`, `size`, `location`, `description`

Optional columns:
- `account_number`, `gem_status`, `crm_owner`, etc.

### Products CSV
Required columns:
- `itemNumber` or `item_number` or `product_number` or `sku`

Recommended columns:
- `itemDescription`, `itemManufacturer`, `itemCategory`, `currentCost`

SCD columns (optional):
- `scdStartDate`, `scdEndDate`, `isCurrentRecordFlag`

### Opportunities CSV
Required columns:
- `opportunityNumber` or `opportunity_number`
- `customerName` or `customer_name`

Recommended columns:
- `oppStage`, `salesPerson`, `bookedGrossRevenue`, `estimatedCloseDate`

Product linking columns (optional):
- `itemNumber`, `gpRevenueCategory`, `mappedSolutionArea`

## Import Options

### Account Import Options
```typescript
{
  skipDuplicates: boolean;     // Skip existing accounts
  updateExisting: boolean;     // Update existing accounts
  batchSize: number;          // Processing batch size
  generateSummaries: boolean;  // Generate AI summaries
  createChunks: boolean;      // Create text chunks
  storeVectors: boolean;      // Store in vector database
  validateDomains: boolean;   // Validate domain formats
}
```

### Product Import Options
```typescript
{
  skipDuplicates: boolean;
  updateExisting: boolean;
  batchSize: number;
  validateItemNumbers: boolean;
  enableSCD: boolean;         // Slowly Changing Dimensions
}
```

### Asset Import Options
```typescript
{
  generateChunks: boolean;
  storeVectors: boolean;
  vectorScope: 'sales-assets' | 'account-summary' | 'general';
  detectCategory: boolean;
  extractMetadata: boolean;
  maxFileSize: number;
  chunkingOptions: {
    chunkSize: number;
    chunkOverlap: number;
    preserveStructure: boolean;
  };
}
```

## Error Handling

All endpoints return consistent error responses:

```typescript
{
  error: string;              // Error type
  message: string;            // Human-readable message
  details?: string[];         // Detailed error information
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized
- `403` - Forbidden
- `413` - Payload Too Large
- `429` - Too Many Requests
- `500` - Internal Server Error

## Job Tracking

Long-running imports return job IDs for tracking:

```typescript
// Start import
const { jobId } = await startImport();

// Check status
const status = await fetch(`/api/import/jobs/${jobId}`);
const job = await status.json();

console.log(`Progress: ${job.progress}%`);
console.log(`Status: ${job.status}`);
console.log(`Stage: ${job.stages[0]?.name}`);

// Cancel if needed
await fetch(`/api/import/jobs/${jobId}`, { method: 'DELETE' });
```

## Performance Considerations

### File Size Limits
- CSV files: 50MB maximum
- Asset files: 50MB per file maximum
- Batch operations: Consider splitting large datasets

### Processing Times
- Accounts: ~50ms per record
- Products: ~30ms per record  
- Opportunities: ~100ms per record (with linking)
- Assets: ~1-5 seconds per file (depending on size and vectorization)

### Vectorization
- Adds significant processing time
- Recommended for searchable content
- Uses OpenAI embeddings by default

## Integration Patterns

### Frontend Integration
```typescript
// React component example
const ImportWizard = () => {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState(null);

  const handleImport = async () => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/import/accounts', {
      method: 'POST',
      body: formData,
    });
    
    const result = await response.json();
    if (result.jobId) {
      setJobId(result.jobId);
      pollJobStatus(result.jobId);
    }
  };

  const pollJobStatus = async (jobId) => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/import/jobs/${jobId}`);
      const job = await response.json();
      
      setProgress(job.progress);
      
      if (job.status === 'COMPLETED' || job.status === 'FAILED') {
        clearInterval(interval);
      }
    }, 1000);
  };
};
```

### WebSocket Integration
For real-time progress updates, integrate with the WebSocket system:

```typescript
// Subscribe to job updates
const ws = new WebSocket('/api/ws');
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: `import-job-${jobId}`,
}));

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  if (update.type === 'job-progress') {
    setProgress(update.progress);
  }
};
```

## Best Practices

1. **Validate First**: Always validate CSV files before importing
2. **Use Batch Processing**: For large datasets, use appropriate batch sizes
3. **Enable Vectorization**: For searchable content, enable vector storage
4. **Monitor Progress**: Use job tracking for long-running operations
5. **Handle Errors**: Implement proper error handling and user feedback
6. **Test with Small Files**: Test import process with small files first
7. **Use Templates**: Download CSV templates for proper formatting

## Troubleshooting

### Common Issues

1. **CSV Format Errors**
   - Check column names match expected format
   - Ensure required columns are present
   - Validate data types (numbers, dates)

2. **File Size Issues**
   - Split large files into smaller chunks
   - Use compression if possible
   - Consider using batch processing

3. **Vector Storage Failures**
   - Check Qdrant service health
   - Verify embedding service availability
   - Monitor memory usage during processing

4. **Performance Issues**
   - Reduce batch sizes for memory-constrained environments
   - Disable vectorization if not needed
   - Use background processing for large imports

### Health Checks

Monitor system health:
```bash
curl /api/import/health
curl /api/health/db
curl /api/health/redis
```

### Logging

Check application logs for detailed error information:
- Import processing logs include job IDs and processing stages
- Vector storage logs include embedding generation details
- Database logs include transaction and constraint information