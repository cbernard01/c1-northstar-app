/**
 * Import Services - Main Export
 * Comprehensive import services for the C1 Northstar Sales Intelligence Platform
 */

// Account Import Service
export {
  AccountImportService,
  getAccountImportService,
  type AccountImportData,
  type AccountImportOptions,
  type AccountImportResult,
  type AccountImportProgress,
} from './account-import.service';

// Product Import Service
export {
  ProductImportService,
  getProductImportService,
  type ProductImportData,
  type ProductImportOptions,
  type ProductImportResult,
  type ProductImportProgress,
} from './product-import.service';

// Opportunity Import Service
export {
  OpportunityImportService,
  getOpportunityImportService,
  type OpportunityImportData,
  type OpportunityImportOptions,
  type OpportunityImportResult,
  type OpportunityImportProgress,
  type ProductPurchaseData,
} from './opportunity-import.service';

// Asset Import Service
export {
  AssetImportService,
  getAssetImportService,
  type AssetImportData,
  type AssetImportOptions,
  type AssetImportResult,
  type AssetImportProgress,
} from './asset-import.service';

// Import Orchestrator Service
export {
  ImportOrchestratorService,
  getImportOrchestratorService,
  type BatchImportData,
  type BatchImportOptions,
  type BatchImportResult,
  type BatchImportProgress,
  type ComplexImportJob,
} from './import-orchestrator.service';

// Convenience class that provides unified access to all import services
export class ImportService {
  public readonly accountImport: AccountImportService;
  public readonly productImport: ProductImportService;
  public readonly opportunityImport: OpportunityImportService;
  public readonly assetImport: AssetImportService;
  public readonly orchestrator: ImportOrchestratorService;

  constructor() {
    this.accountImport = getAccountImportService();
    this.productImport = getProductImportService();
    this.opportunityImport = getOpportunityImportService();
    this.assetImport = getAssetImportService();
    this.orchestrator = getImportOrchestratorService();
  }

  /**
   * Quick import methods for single files
   */
  async importAccounts(
    buffer: Buffer,
    fileName: string,
    options?: AccountImportOptions,
    onProgress?: (progress: AccountImportProgress) => void
  ) {
    return await this.accountImport.importFromCsv(buffer, fileName, options, onProgress);
  }

  async importProducts(
    buffer: Buffer,
    fileName: string,
    options?: ProductImportOptions,
    onProgress?: (progress: ProductImportProgress) => void
  ) {
    return await this.productImport.importFromCsv(buffer, fileName, options, onProgress);
  }

  async importOpportunities(
    buffer: Buffer,
    fileName: string,
    options?: OpportunityImportOptions,
    onProgress?: (progress: OpportunityImportProgress) => void
  ) {
    return await this.opportunityImport.importFromCsv(buffer, fileName, options, onProgress);
  }

  async importAsset(
    data: AssetImportData,
    userId: string,
    options?: AssetImportOptions,
    onProgress?: (progress: AssetImportProgress) => void
  ) {
    return await this.assetImport.importAsset(data, userId, options, onProgress);
  }

  async importAssetBatch(
    assets: AssetImportData[],
    userId: string,
    options?: AssetImportOptions,
    onProgress?: (progress: AssetImportProgress) => void
  ) {
    return await this.assetImport.importAssetBatch(assets, userId, options, onProgress);
  }

  /**
   * Complex batch import
   */
  async importBatch(
    data: BatchImportData,
    userId: string,
    options?: BatchImportOptions
  ) {
    return await this.orchestrator.executeBatchImport(data, userId, options);
  }

  /**
   * Queue complex import for background processing
   */
  async queueImport(
    data: BatchImportData,
    userId: string,
    options?: BatchImportOptions
  ) {
    return await this.orchestrator.queueComplexImport(data, userId, options);
  }

  /**
   * Get comprehensive import statistics
   */
  async getImportStats(userId?: string, timeRange: 'day' | 'week' | 'month' = 'day') {
    const [
      accountStats,
      productStats,
      opportunityStats,
      assetStats,
      orchestratorStats,
    ] = await Promise.all([
      this.accountImport.getImportStats(timeRange),
      this.productImport.getImportStats(timeRange),
      this.opportunityImport.getImportStats(timeRange),
      this.assetImport.getImportStats(timeRange),
      this.orchestrator.getImportStats(userId, timeRange),
    ]);

    return {
      accounts: accountStats,
      products: productStats,
      opportunities: opportunityStats,
      assets: assetStats,
      jobs: orchestratorStats,
      timeRange,
      summary: {
        totalImported: (accountStats.totalImported || 0) + 
                      (productStats.totalProducts || 0) + 
                      (opportunityStats.totalOpportunities || 0) + 
                      (assetStats.statusDistribution?.reduce((sum, stat) => sum + stat.count, 0) || 0),
        totalJobs: orchestratorStats.totalJobs,
      },
    };
  }

  /**
   * Validate import data before processing
   */
  async validateImportData(
    type: 'accounts' | 'products' | 'opportunities',
    buffer: Buffer,
    fileName: string
  ): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    preview: any[];
    totalRows: number;
  }> {
    try {
      // Parse the CSV to get preview data
      const parserResult = await import('@/lib/services/parsers').then(
        module => module.QuickParse.csv(buffer, fileName, { hasHeaders: true })
      );

      const data = parserResult.blocks.map(block => block.content.data);
      const preview = data.slice(0, 5); // First 5 rows for preview
      const errors: string[] = [];
      const warnings: string[] = [];

      // Basic validation based on type
      switch (type) {
        case 'accounts':
          if (!preview.some(row => row.name || row.account_name || row.company_name)) {
            errors.push('No account name column found. Expected: name, account_name, or company_name');
          }
          break;

        case 'products':
          if (!preview.some(row => row.itemNumber || row.item_number || row.product_number || row.sku)) {
            errors.push('No item number column found. Expected: itemNumber, item_number, product_number, or sku');
          }
          break;

        case 'opportunities':
          if (!preview.some(row => row.opportunityNumber || row.opportunity_number || row.opp_number)) {
            errors.push('No opportunity number column found. Expected: opportunityNumber, opportunity_number, or opp_number');
          }
          if (!preview.some(row => row.customerName || row.customer_name || row.account_name)) {
            errors.push('No customer name column found. Expected: customerName, customer_name, or account_name');
          }
          break;
      }

      // Check for empty data
      if (data.length === 0) {
        errors.push('File appears to be empty or contains no valid data rows');
      } else if (data.length === 1) {
        warnings.push('File contains only one data row (plus headers)');
      }

      // Check for large files
      if (data.length > 10000) {
        warnings.push(`Large file detected (${data.length} rows). Consider processing in smaller batches.`);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        preview,
        totalRows: data.length,
      };

    } catch (error) {
      return {
        valid: false,
        errors: [`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
        preview: [],
        totalRows: 0,
      };
    }
  }

  /**
   * Get supported file types for assets
   */
  getSupportedAssetTypes() {
    return this.assetImport.getSupportedTypes();
  }

  /**
   * Check if asset file type is supported
   */
  isAssetTypeSupported(mimeType: string) {
    return this.assetImport.isSupported(mimeType);
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string) {
    return await this.orchestrator.getImportJobStatus(jobId);
  }

  /**
   * Cancel import job
   */
  async cancelJob(jobId: string, userId: string) {
    return await this.orchestrator.cancelImportJob(jobId, userId);
  }

  /**
   * Health check for all import services
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    services: Record<string, { status: 'healthy' | 'degraded' | 'unhealthy'; message?: string }>;
  }> {
    const services: Record<string, { status: 'healthy' | 'degraded' | 'unhealthy'; message?: string }> = {};
    let allHealthy = true;

    // Test each service
    try {
      // Test account import (small validation)
      await this.accountImport.getImportStats('day');
      services.accountImport = { status: 'healthy' };
    } catch (error) {
      services.accountImport = { 
        status: 'unhealthy', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
      allHealthy = false;
    }

    try {
      // Test product import
      await this.productImport.getImportStats('day');
      services.productImport = { status: 'healthy' };
    } catch (error) {
      services.productImport = { 
        status: 'unhealthy', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
      allHealthy = false;
    }

    try {
      // Test opportunity import
      await this.opportunityImport.getImportStats('day');
      services.opportunityImport = { status: 'healthy' };
    } catch (error) {
      services.opportunityImport = { 
        status: 'unhealthy', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
      allHealthy = false;
    }

    try {
      // Test asset import
      await this.assetImport.getImportStats('day');
      services.assetImport = { status: 'healthy' };
    } catch (error) {
      services.assetImport = { 
        status: 'unhealthy', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
      allHealthy = false;
    }

    try {
      // Test orchestrator
      await this.orchestrator.getImportStats(undefined, 'day');
      services.orchestrator = { status: 'healthy' };
    } catch (error) {
      services.orchestrator = { 
        status: 'unhealthy', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
      allHealthy = false;
    }

    return {
      healthy: allHealthy,
      services,
    };
  }
}

// Singleton instance
let importService: ImportService | null = null;

/**
 * Get singleton import service instance
 */
export function getImportService(): ImportService {
  if (!importService) {
    importService = new ImportService();
  }
  return importService;
}

/**
 * Initialize import services
 */
export async function initializeImportServices(): Promise<ImportService> {
  const service = getImportService();
  
  // Validate setup
  const health = await service.healthCheck();
  if (!health.healthy) {
    const unhealthyServices = Object.entries(health.services)
      .filter(([, status]) => status.status === 'unhealthy')
      .map(([name, status]) => `${name}: ${status.message}`)
      .join(', ');
    
    throw new Error(`Import services validation failed: ${unhealthyServices}`);
  }

  const degradedServices = Object.entries(health.services)
    .filter(([, status]) => status.status === 'degraded')
    .map(([name]) => name);

  if (degradedServices.length > 0) {
    console.warn('Some import services are degraded:', degradedServices.join(', '));
  }

  return service;
}

// Export constants
export const IMPORT_CONSTANTS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_BATCH_SIZE: 100,
  DEFAULT_CHUNK_SIZE: 1000,
  DEFAULT_CHUNK_OVERLAP: 100,
  SUPPORTED_CSV_TYPES: [
    'text/csv',
    'application/csv',
    'text/comma-separated-values',
  ],
  SUPPORTED_ASSET_TYPES: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
    'text/plain',
    'application/vnd.ms-excel', // XLS
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
  ],
} as const;

// Export type utilities
export const ImportUtils = {
  /**
   * Detect import type from file name or content
   */
  detectImportType(fileName: string, sampleData?: any[]): 'accounts' | 'products' | 'opportunities' | 'assets' | 'unknown' {
    const lowerFileName = fileName.toLowerCase();
    
    // File name patterns
    if (lowerFileName.includes('account') || lowerFileName.includes('company') || lowerFileName.includes('customer')) {
      return 'accounts';
    }
    
    if (lowerFileName.includes('product') || lowerFileName.includes('catalog') || lowerFileName.includes('item')) {
      return 'products';
    }
    
    if (lowerFileName.includes('opportunity') || lowerFileName.includes('pipeline') || lowerFileName.includes('deal')) {
      return 'opportunities';
    }
    
    // Content-based detection
    if (sampleData && sampleData.length > 0) {
      const firstRow = sampleData[0];
      const keys = Object.keys(firstRow).map(k => k.toLowerCase());
      
      if (keys.some(k => k.includes('account') || k.includes('company') || k.includes('domain'))) {
        return 'accounts';
      }
      
      if (keys.some(k => k.includes('item') || k.includes('product') || k.includes('sku') || k.includes('manufacturer'))) {
        return 'products';
      }
      
      if (keys.some(k => k.includes('opportunity') || k.includes('pipeline') || k.includes('revenue'))) {
        return 'opportunities';
      }
    }
    
    return 'unknown';
  },

  /**
   * Validate file size
   */
  validateFileSize(size: number, maxSize: number = IMPORT_CONSTANTS.MAX_FILE_SIZE): { valid: boolean; error?: string } {
    if (size > maxSize) {
      return {
        valid: false,
        error: `File size (${Math.round(size / 1024 / 1024)}MB) exceeds limit (${Math.round(maxSize / 1024 / 1024)}MB)`,
      };
    }
    return { valid: true };
  },

  /**
   * Estimate processing time based on file size and type
   */
  estimateProcessingTime(fileSize: number, recordCount: number, includeVectorization: boolean = false): number {
    // Base processing time: ~1ms per record for CSV, ~50ms per KB for documents
    let baseTime = recordCount * 1;
    
    // Add time for vectorization if requested
    if (includeVectorization) {
      baseTime += recordCount * 100; // ~100ms per record for vectorization
    }
    
    // Add file parsing overhead
    baseTime += Math.max(fileSize / 1024, 1000); // At least 1 second, plus 1ms per KB
    
    return Math.round(baseTime);
  },
} as const;