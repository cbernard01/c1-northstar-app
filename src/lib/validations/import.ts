import { z } from 'zod';
import { DocumentScope } from '@prisma/client';

// Base import options
const baseImportOptionsSchema = z.object({
  skipDuplicates: z.boolean().optional().default(true),
  updateExisting: z.boolean().optional().default(false),
  batchSize: z.number().min(1).max(1000).optional().default(50),
});

// Account import schemas
export const accountImportOptionsSchema = baseImportOptionsSchema.extend({
  generateSummaries: z.boolean().optional().default(false),
  createChunks: z.boolean().optional().default(false),
  storeVectors: z.boolean().optional().default(false),
  validateDomains: z.boolean().optional().default(true),
});

export const accountImportRequestSchema = z.object({
  options: accountImportOptionsSchema.optional(),
});

// Product import schemas
export const productImportOptionsSchema = baseImportOptionsSchema.extend({
  validateItemNumbers: z.boolean().optional().default(true),
  enableSCD: z.boolean().optional().default(false),
});

export const productImportRequestSchema = z.object({
  options: productImportOptionsSchema.optional(),
});

// Opportunity import schemas
export const opportunityImportOptionsSchema = baseImportOptionsSchema.extend({
  createMissingAccounts: z.boolean().optional().default(false),
  createMissingProducts: z.boolean().optional().default(false),
  validateRevenue: z.boolean().optional().default(true),
  linkProducts: z.boolean().optional().default(true),
});

export const opportunityImportRequestSchema = z.object({
  options: opportunityImportOptionsSchema.optional(),
});

// Asset import schemas
export const assetImportOptionsSchema = z.object({
  batchSize: z.number().min(1).max(10).optional().default(3),
  generateChunks: z.boolean().optional().default(true),
  storeVectors: z.boolean().optional().default(false),
  vectorScope: z.enum(['sales-assets', 'account-summary', 'general']).optional().default('sales-assets'),
  detectCategory: z.boolean().optional().default(true),
  extractMetadata: z.boolean().optional().default(true),
  maxFileSize: z.number().min(1024).max(100 * 1024 * 1024).optional().default(50 * 1024 * 1024), // 50MB
  allowedMimeTypes: z.array(z.string()).optional(),
  chunkingOptions: z.object({
    chunkSize: z.number().min(100).max(4000).optional().default(1000),
    chunkOverlap: z.number().min(0).max(500).optional().default(100),
    preserveStructure: z.boolean().optional().default(true),
  }).optional(),
});

export const assetImportRequestSchema = z.object({
  accountNumber: z.string().optional(),
  accountId: z.string().optional(),
  title: z.string().optional(),
  category: z.string().optional(),
  scope: z.nativeEnum(DocumentScope).optional(),
  options: assetImportOptionsSchema.optional(),
});

// Batch import schemas
export const batchImportOptionsSchema = z.object({
  generateInsights: z.boolean().optional().default(false),
  createVectors: z.boolean().optional().default(false),
  linkRelatedData: z.boolean().optional().default(true),
  validateRelationships: z.boolean().optional().default(true),
  processOrder: z.array(z.enum(['accounts', 'products', 'opportunities', 'assets'])).optional(),
  rollbackOnError: z.boolean().optional().default(false),
  continueOnError: z.boolean().optional().default(true),
});

export const batchImportRequestSchema = z.object({
  options: batchImportOptionsSchema.optional(),
});

// Import validation schemas
export const importValidationRequestSchema = z.object({
  type: z.enum(['accounts', 'products', 'opportunities']),
});

// Import job schemas
export const jobQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  pageSize: z.coerce.number().min(1).max(100).optional().default(20),
  status: z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'PENDING', 'CANCELLED', 'PAUSED']).optional(),
  type: z.enum(['IMPORT_ACCOUNTS', 'IMPORT_PRODUCTS', 'IMPORT_OPPORTUNITIES', 'IMPORT_ASSETS']).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'startedAt', 'completedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Import stats schemas
export const importStatsQuerySchema = z.object({
  timeRange: z.enum(['day', 'week', 'month']).optional().default('day'),
  type: z.enum(['accounts', 'products', 'opportunities', 'assets', 'all']).optional().default('all'),
});

// File upload validation
export const fileUploadValidationSchema = z.object({
  maxFileSize: z.number().optional().default(50 * 1024 * 1024), // 50MB
  allowedMimeTypes: z.array(z.string()).optional().default([
    'text/csv',
    'application/csv',
    'text/comma-separated-values',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ]),
});

// Response schemas for type safety
export const importResultSchema = z.object({
  total: z.number(),
  created: z.number().optional(),
  imported: z.number().optional(),
  updated: z.number().optional(),
  skipped: z.number().optional(),
  failed: z.number(),
  duplicates: z.number().optional(),
  chunksGenerated: z.number().optional(),
  vectorsStored: z.number().optional(),
  errors: z.array(z.object({
    row: z.number().optional(),
    file: z.string().optional(),
    account: z.string().optional(),
    product: z.string().optional(),
    opportunity: z.string().optional(),
    error: z.string(),
  })),
  warnings: z.array(z.object({
    row: z.number().optional(),
    file: z.string().optional(),
    account: z.string().optional(),
    product: z.string().optional(),
    opportunity: z.string().optional(),
    warning: z.string(),
  })),
  processingTime: z.number(),
});

export const batchImportResultSchema = z.object({
  jobId: z.string(),
  accounts: importResultSchema.optional(),
  products: importResultSchema.optional(),
  opportunities: importResultSchema.optional(),
  assets: importResultSchema.optional(),
  totalProcessingTime: z.number(),
  overallStatus: z.enum(['completed', 'partial', 'failed']),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  summary: z.object({
    totalRecords: z.number(),
    totalCreated: z.number(),
    totalUpdated: z.number(),
    totalFailed: z.number(),
    totalSkipped: z.number(),
  }),
});

export const jobStatusSchema = z.object({
  id: z.string(),
  status: z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'PENDING', 'CANCELLED', 'PAUSED']),
  progress: z.number().min(0).max(100),
  title: z.string(),
  description: z.string().nullable(),
  result: z.any().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  failedAt: z.date().nullable(),
  metadata: z.any().nullable(),
  stages: z.array(z.object({
    id: z.string(),
    name: z.string(),
    status: z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'PENDING', 'CANCELLED', 'PAUSED']),
    progress: z.number().min(0).max(100),
    startedAt: z.date().nullable(),
    completedAt: z.date().nullable(),
    errorMessage: z.string().nullable(),
  })),
});

// Validation utilities
export const ImportValidation = {
  /**
   * Validate file upload
   */
  validateFileUpload(file: File, options?: z.infer<typeof fileUploadValidationSchema>) {
    const validation = fileUploadValidationSchema.parse(options || {});
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check file size
    if (file.size > validation.maxFileSize) {
      errors.push(`File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds limit (${Math.round(validation.maxFileSize / 1024 / 1024)}MB)`);
    }

    // Check MIME type
    if (!validation.allowedMimeTypes.includes(file.type)) {
      errors.push(`Unsupported file type: ${file.type}`);
    }

    // Warnings for large files
    if (file.size > 10 * 1024 * 1024) { // 10MB
      warnings.push('Large file may take longer to process');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },

  /**
   * Validate CSV structure
   */
  validateCsvStructure(
    headers: string[],
    type: 'accounts' | 'products' | 'opportunities'
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const lowerHeaders = headers.map(h => h.toLowerCase().trim());

    switch (type) {
      case 'accounts':
        const accountNameFields = ['name', 'account_name', 'company_name', 'accountname', 'companyname'];
        if (!accountNameFields.some(field => lowerHeaders.includes(field))) {
          errors.push('Missing required account name field. Expected one of: ' + accountNameFields.join(', '));
        }
        
        if (lowerHeaders.includes('domain') || lowerHeaders.includes('account_domain')) {
          // Good - domain helps with deduplication
        } else {
          warnings.push('No domain field found. This may result in duplicate accounts.');
        }
        break;

      case 'products':
        const itemNumberFields = ['itemnumber', 'item_number', 'product_number', 'sku', 'productnumber'];
        if (!itemNumberFields.some(field => lowerHeaders.includes(field))) {
          errors.push('Missing required item number field. Expected one of: ' + itemNumberFields.join(', '));
        }
        break;

      case 'opportunities':
        const oppNumberFields = ['opportunitynumber', 'opportunity_number', 'opp_number', 'oppnumber'];
        if (!oppNumberFields.some(field => lowerHeaders.includes(field))) {
          errors.push('Missing required opportunity number field. Expected one of: ' + oppNumberFields.join(', '));
        }

        const customerFields = ['customername', 'customer_name', 'account_name', 'accountname'];
        if (!customerFields.some(field => lowerHeaders.includes(field))) {
          errors.push('Missing required customer name field. Expected one of: ' + customerFields.join(', '));
        }
        break;
    }

    return { valid: errors.length === 0, errors, warnings };
  },

  /**
   * Get recommended field mappings
   */
  getFieldMappings(headers: string[], type: 'accounts' | 'products' | 'opportunities') {
    const lowerHeaders = headers.map(h => h.toLowerCase().trim());
    const mappings: Record<string, string> = {};

    switch (type) {
      case 'accounts':
        // Find account name field
        const accountNameField = lowerHeaders.find(h => 
          ['name', 'account_name', 'company_name', 'accountname', 'companyname'].includes(h)
        );
        if (accountNameField) {
          mappings.name = headers[lowerHeaders.indexOf(accountNameField)];
        }

        // Find domain field
        const domainField = lowerHeaders.find(h => 
          ['domain', 'account_domain', 'website', 'url'].includes(h)
        );
        if (domainField) {
          mappings.domain = headers[lowerHeaders.indexOf(domainField)];
        }

        // Find other common fields
        ['industry', 'size', 'location', 'description'].forEach(field => {
          const foundField = lowerHeaders.find(h => h.includes(field));
          if (foundField) {
            mappings[field] = headers[lowerHeaders.indexOf(foundField)];
          }
        });
        break;

      case 'products':
        // Find item number field
        const itemField = lowerHeaders.find(h => 
          ['itemnumber', 'item_number', 'product_number', 'sku', 'productnumber'].includes(h)
        );
        if (itemField) {
          mappings.itemNumber = headers[lowerHeaders.indexOf(itemField)];
        }

        // Find description field
        const descField = lowerHeaders.find(h => 
          h.includes('description') || h.includes('desc')
        );
        if (descField) {
          mappings.itemDescription = headers[lowerHeaders.indexOf(descField)];
        }

        // Find other fields
        ['manufacturer', 'category', 'cost', 'price'].forEach(field => {
          const foundField = lowerHeaders.find(h => h.includes(field));
          if (foundField) {
            mappings[field] = headers[lowerHeaders.indexOf(foundField)];
          }
        });
        break;

      case 'opportunities':
        // Find opportunity number
        const oppField = lowerHeaders.find(h => 
          ['opportunitynumber', 'opportunity_number', 'opp_number', 'oppnumber'].includes(h)
        );
        if (oppField) {
          mappings.opportunityNumber = headers[lowerHeaders.indexOf(oppField)];
        }

        // Find customer name
        const customerField = lowerHeaders.find(h => 
          ['customername', 'customer_name', 'account_name', 'accountname'].includes(h)
        );
        if (customerField) {
          mappings.customerName = headers[lowerHeaders.indexOf(customerField)];
        }

        // Find revenue fields
        ['revenue', 'pipeline', 'margin', 'stage'].forEach(field => {
          const foundField = lowerHeaders.find(h => h.includes(field));
          if (foundField) {
            mappings[field] = headers[lowerHeaders.indexOf(foundField)];
          }
        });
        break;
    }

    return mappings;
  },
} as const;

// Type exports for API usage
export type AccountImportOptions = z.infer<typeof accountImportOptionsSchema>;
export type ProductImportOptions = z.infer<typeof productImportOptionsSchema>;
export type OpportunityImportOptions = z.infer<typeof opportunityImportOptionsSchema>;
export type AssetImportOptions = z.infer<typeof assetImportOptionsSchema>;
export type BatchImportOptions = z.infer<typeof batchImportOptionsSchema>;
export type ImportValidationRequest = z.infer<typeof importValidationRequestSchema>;
export type JobQuery = z.infer<typeof jobQuerySchema>;
export type ImportStatsQuery = z.infer<typeof importStatsQuerySchema>;
export type FileUploadValidation = z.infer<typeof fileUploadValidationSchema>;
export type ImportResult = z.infer<typeof importResultSchema>;
export type BatchImportResult = z.infer<typeof batchImportResultSchema>;
export type JobStatus = z.infer<typeof jobStatusSchema>;