import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { QuickParse } from '@/lib/services/parsers';

export interface ProductImportData {
  itemNumber: string;
  itemDescription?: string;
  itemTypeCode?: number;
  itemTypeDescription?: string;
  productType?: string;
  itemRevenueCategory?: string;
  itemManufacturer?: string;
  itemCategory?: string;
  itemLineOfBusiness?: string;
  itemSubcategory?: string;
  itemClass?: string;
  portfolio?: string;
  currentCost?: number;
  scdStartDate?: Date;
  scdEndDate?: Date;
  isCurrentRecordFlag?: boolean;
  offer?: string;
  practice?: string;
  solutionSegment?: string;
  businessSegment?: string;
  manufacturerPractice?: string;
  manufacturerItemCategory?: string;
  growthCategory?: string;
}

export interface ProductImportOptions {
  skipDuplicates?: boolean;
  updateExisting?: boolean;
  batchSize?: number;
  validateItemNumbers?: boolean;
  enableSCD?: boolean; // Slowly Changing Dimensions
}

export interface ProductImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  duplicates: number;
  errors: Array<{
    row: number;
    product: string;
    error: string;
  }>;
  warnings: Array<{
    row: number;
    product: string;
    warning: string;
  }>;
  productIds: string[];
  processingTime: number;
}

export interface ProductImportProgress {
  stage: 'parsing' | 'validation' | 'importing' | 'scd_processing' | 'completed';
  processed: number;
  total: number;
  currentProduct?: string;
  errors: number;
  warnings: number;
}

export class ProductImportService {
  /**
   * Import products from CSV buffer
   */
  async importFromCsv(
    buffer: Buffer,
    fileName: string,
    options: ProductImportOptions = {},
    onProgress?: (progress: ProductImportProgress) => void
  ): Promise<ProductImportResult> {
    const startTime = Date.now();
    const result: ProductImportResult = {
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      duplicates: 0,
      errors: [],
      warnings: [],
      productIds: [],
      processingTime: 0,
    };

    try {
      // Stage 1: Parse CSV
      onProgress?.({
        stage: 'parsing',
        processed: 0,
        total: 0,
        errors: 0,
        warnings: 0,
      });

      const parserResult = await QuickParse.csv(buffer, fileName, {
        hasHeaders: true,
        inferTypes: true,
        skipEmptyLines: true,
      });

      const rawData = parserResult.blocks.map(block => block.content.data);
      result.total = rawData.length;

      logger.info(`ProductImportService: Parsed ${result.total} products from CSV`, {
        fileName,
        total: result.total,
      });

      // Stage 2: Validate and transform data
      onProgress?.({
        stage: 'validation',
        processed: 0,
        total: result.total,
        errors: 0,
        warnings: 0,
      });

      const validProducts: ProductImportData[] = [];
      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        const rowNumber = i + 1;

        try {
          const productData = this.transformCsvRow(row, rowNumber);
          const validation = this.validateProductData(productData, rowNumber);
          
          if (validation.errors.length > 0) {
            result.errors.push(...validation.errors);
            result.failed++;
          } else {
            validProducts.push(productData);
            if (validation.warnings.length > 0) {
              result.warnings.push(...validation.warnings);
            }
          }
        } catch (error) {
          result.errors.push({
            row: rowNumber,
            product: row.itemNumber || `Row ${rowNumber}`,
            error: error instanceof Error ? error.message : 'Unknown validation error',
          });
          result.failed++;
        }

        onProgress?.({
          stage: 'validation',
          processed: i + 1,
          total: result.total,
          currentProduct: row.itemNumber,
          errors: result.errors.length,
          warnings: result.warnings.length,
        });
      }

      // Stage 3: Import products
      onProgress?.({
        stage: 'importing',
        processed: 0,
        total: validProducts.length,
        errors: result.errors.length,
        warnings: result.warnings.length,
      });

      const batchSize = options.batchSize || 100;
      for (let i = 0; i < validProducts.length; i += batchSize) {
        const batch = validProducts.slice(i, i + batchSize);
        const batchResult = await this.importProductBatch(batch, options);
        
        result.created += batchResult.created;
        result.updated += batchResult.updated;
        result.skipped += batchResult.skipped;
        result.duplicates += batchResult.duplicates;
        result.productIds.push(...batchResult.productIds);
        result.errors.push(...batchResult.errors);

        onProgress?.({
          stage: 'importing',
          processed: Math.min(i + batchSize, validProducts.length),
          total: validProducts.length,
          errors: result.errors.length,
          warnings: result.warnings.length,
        });
      }

      // Stage 4: Process SCD (Slowly Changing Dimensions) if enabled
      if (options.enableSCD && result.productIds.length > 0) {
        await this.processSCDUpdates(result.productIds, onProgress);
      }

      onProgress?.({
        stage: 'completed',
        processed: validProducts.length,
        total: validProducts.length,
        errors: result.errors.length,
        warnings: result.warnings.length,
      });

      result.processingTime = Date.now() - startTime;

      logger.info('ProductImportService: Import completed', {
        fileName,
        result: {
          total: result.total,
          created: result.created,
          updated: result.updated,
          failed: result.failed,
          processingTime: result.processingTime,
        },
      });

      return result;

    } catch (error) {
      logger.error('ProductImportService: Import failed', { fileName, error });
      throw error;
    }
  }

  /**
   * Transform CSV row to ProductImportData
   */
  private transformCsvRow(row: any, rowNumber: number): ProductImportData {
    // Map common CSV column names to our schema
    const columnMapping: Record<string, string> = {
      'item_number': 'itemNumber',
      'product_number': 'itemNumber',
      'sku': 'itemNumber',
      'item_description': 'itemDescription',
      'product_description': 'itemDescription',
      'description': 'itemDescription',
      'item_type_code': 'itemTypeCode',
      'type_code': 'itemTypeCode',
      'item_type_description': 'itemTypeDescription',
      'type_description': 'itemTypeDescription',
      'product_type': 'productType',
      'item_revenue_category': 'itemRevenueCategory',
      'revenue_category': 'itemRevenueCategory',
      'item_manufacturer': 'itemManufacturer',
      'manufacturer': 'itemManufacturer',
      'item_category': 'itemCategory',
      'category': 'itemCategory',
      'item_line_of_business': 'itemLineOfBusiness',
      'line_of_business': 'itemLineOfBusiness',
      'lob': 'itemLineOfBusiness',
      'item_subcategory': 'itemSubcategory',
      'subcategory': 'itemSubcategory',
      'item_class': 'itemClass',
      'class': 'itemClass',
      'current_cost': 'currentCost',
      'cost': 'currentCost',
      'price': 'currentCost',
      'scd_start_date': 'scdStartDate',
      'start_date': 'scdStartDate',
      'scd_end_date': 'scdEndDate',
      'end_date': 'scdEndDate',
      'is_current_record_flag': 'isCurrentRecordFlag',
      'is_current': 'isCurrentRecordFlag',
      'active': 'isCurrentRecordFlag',
      'solution_segment': 'solutionSegment',
      'business_segment': 'businessSegment',
      'manufacturer_practice': 'manufacturerPractice',
      'manufacturer_item_category': 'manufacturerItemCategory',
      'growth_category': 'growthCategory',
    };

    const productData: ProductImportData = {
      itemNumber: '', // Required field
      isCurrentRecordFlag: true, // Default to active
    };

    // Transform the row using column mapping
    for (const [csvKey, value] of Object.entries(row)) {
      if (value === null || value === undefined || value === '') continue;

      const normalizedKey = csvKey.toLowerCase().trim();
      const mappedKey = columnMapping[normalizedKey] || normalizedKey;

      if (mappedKey === 'itemNumber') {
        productData.itemNumber = String(value).trim();
      } else if (mappedKey === 'currentCost') {
        const numValue = parseFloat(String(value));
        if (!isNaN(numValue)) {
          productData.currentCost = numValue;
        }
      } else if (mappedKey === 'itemTypeCode') {
        const numValue = parseInt(String(value));
        if (!isNaN(numValue)) {
          productData.itemTypeCode = numValue;
        }
      } else if (mappedKey === 'isCurrentRecordFlag') {
        productData.isCurrentRecordFlag = this.parseBoolean(value);
      } else if (mappedKey === 'scdStartDate' || mappedKey === 'scdEndDate') {
        const dateValue = this.parseDate(value);
        if (dateValue) {
          (productData as any)[mappedKey] = dateValue;
        }
      } else if (Object.prototype.hasOwnProperty.call(productData, mappedKey)) {
        (productData as any)[mappedKey] = String(value).trim();
      }
    }

    return productData;
  }

  /**
   * Validate product data
   */
  private validateProductData(
    data: ProductImportData,
    rowNumber: number
  ): {
    errors: Array<{ row: number; product: string; error: string }>;
    warnings: Array<{ row: number; product: string; warning: string }>;
  } {
    const errors: Array<{ row: number; product: string; error: string }> = [];
    const warnings: Array<{ row: number; product: string; warning: string }> = [];
    const productName = data.itemNumber || `Row ${rowNumber}`;

    // Required field validation
    if (!data.itemNumber || data.itemNumber.trim().length === 0) {
      errors.push({
        row: rowNumber,
        product: productName,
        error: 'Item number is required',
      });
    }

    // Business rule validations
    if (data.itemNumber && data.itemNumber.length > 100) {
      errors.push({
        row: rowNumber,
        product: productName,
        error: 'Item number exceeds maximum length (100 characters)',
      });
    }

    if (data.currentCost && data.currentCost < 0) {
      warnings.push({
        row: rowNumber,
        product: productName,
        warning: 'Negative cost detected',
      });
    }

    if (data.scdStartDate && data.scdEndDate && data.scdStartDate > data.scdEndDate) {
      errors.push({
        row: rowNumber,
        product: productName,
        error: 'SCD start date cannot be after end date',
      });
    }

    if (data.itemDescription && data.itemDescription.length > 1000) {
      warnings.push({
        row: rowNumber,
        product: productName,
        warning: 'Description is very long and may be truncated',
      });
    }

    return { errors, warnings };
  }

  /**
   * Import a batch of products
   */
  private async importProductBatch(
    products: ProductImportData[],
    options: ProductImportOptions
  ): Promise<Omit<ProductImportResult, 'total' | 'processingTime'>> {
    const result = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      duplicates: 0,
      errors: [] as Array<{ row: number; product: string; error: string }>,
      productIds: [] as string[],
    };

    for (const productData of products) {
      try {
        // Check for existing product
        const existingProduct = await prisma.product.findUnique({
          where: { itemNumber: productData.itemNumber },
        });
        
        if (existingProduct) {
          if (options.updateExisting) {
            // Handle SCD updates if enabled
            if (options.enableSCD) {
              await this.handleSCDUpdate(existingProduct, productData);
            } else {
              // Simple update
              const updated = await prisma.product.update({
                where: { id: existingProduct.id },
                data: {
                  ...productData,
                  updatedAt: new Date(),
                },
              });
              result.productIds.push(updated.id);
            }
            result.updated++;
          } else if (options.skipDuplicates) {
            result.skipped++;
            result.duplicates++;
          } else {
            result.errors.push({
              row: 0,
              product: productData.itemNumber,
              error: 'Product already exists',
            });
            result.failed++;
          }
        } else {
          // Create new product
          const created = await prisma.product.create({
            data: {
              ...productData,
              scdStartDate: productData.scdStartDate || new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          result.created++;
          result.productIds.push(created.id);
        }
      } catch (error) {
        result.errors.push({
          row: 0,
          product: productData.itemNumber,
          error: error instanceof Error ? error.message : 'Unknown database error',
        });
        result.failed++;
      }
    }

    return result;
  }

  /**
   * Handle Slowly Changing Dimension updates
   */
  private async handleSCDUpdate(existingProduct: any, newData: ProductImportData) {
    // Check if significant fields have changed
    const significantFields = [
      'itemDescription',
      'itemCategory',
      'itemManufacturer',
      'solutionSegment',
      'businessSegment',
      'currentCost',
    ];

    const hasChanges = significantFields.some(field => {
      const existingValue = existingProduct[field];
      const newValue = (newData as any)[field];
      return existingValue !== newValue;
    });

    if (hasChanges) {
      // Close the current record
      await prisma.product.update({
        where: { id: existingProduct.id },
        data: {
          scdEndDate: new Date(),
          isCurrentRecordFlag: false,
          updatedAt: new Date(),
        },
      });

      // Create a new current record
      await prisma.product.create({
        data: {
          ...newData,
          scdStartDate: new Date(),
          isCurrentRecordFlag: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } else {
      // Update the existing record
      await prisma.product.update({
        where: { id: existingProduct.id },
        data: {
          ...newData,
          updatedAt: new Date(),
        },
      });
    }
  }

  /**
   * Process SCD updates for imported products
   */
  private async processSCDUpdates(
    productIds: string[],
    onProgress?: (progress: ProductImportProgress) => void
  ) {
    onProgress?.({
      stage: 'scd_processing',
      processed: 0,
      total: productIds.length,
      errors: 0,
      warnings: 0,
    });

    // Mark old records as inactive if needed
    await prisma.product.updateMany({
      where: {
        id: { in: productIds },
        scdEndDate: { lt: new Date() },
      },
      data: {
        isCurrentRecordFlag: false,
      },
    });

    onProgress?.({
      stage: 'scd_processing',
      processed: productIds.length,
      total: productIds.length,
      errors: 0,
      warnings: 0,
    });
  }

  /**
   * Parse boolean values from various formats
   */
  private parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    const str = String(value).toLowerCase().trim();
    return ['true', '1', 'yes', 'y', 'active', 'enabled'].includes(str);
  }

  /**
   * Parse date values from various formats
   */
  private parseDate(value: any): Date | null {
    if (value instanceof Date) return value;
    if (!value) return null;
    
    const date = new Date(String(value));
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Get product import statistics
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

    const [totalProducts, activeProducts, manufacturerStats] = await Promise.all([
      prisma.product.count({
        where: {
          createdAt: { gte: startDate },
        },
      }),
      prisma.product.count({
        where: {
          isCurrentRecordFlag: true,
          createdAt: { gte: startDate },
        },
      }),
      prisma.product.groupBy({
        by: ['itemManufacturer'],
        where: {
          isCurrentRecordFlag: true,
          itemManufacturer: { not: null },
          createdAt: { gte: startDate },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      totalProducts,
      activeProducts,
      inactiveProducts: totalProducts - activeProducts,
      topManufacturers: manufacturerStats.map(stat => ({
        manufacturer: stat.itemManufacturer,
        count: stat._count.id,
      })),
      timeRange,
    };
  }

  /**
   * Validate item number format
   */
  validateItemNumber(itemNumber: string): boolean {
    // Common patterns for item numbers
    const patterns = [
      /^[A-Z0-9-]+$/, // Alphanumeric with hyphens
      /^\d+$/, // Numeric only
      /^[A-Z]+\d+$/, // Letters followed by numbers
    ];

    return patterns.some(pattern => pattern.test(itemNumber));
  }

  /**
   * Clean and normalize product data
   */
  cleanProductData(data: ProductImportData): ProductImportData {
    return {
      ...data,
      itemNumber: data.itemNumber?.trim().toUpperCase(),
      itemDescription: data.itemDescription?.trim(),
      itemManufacturer: data.itemManufacturer?.trim(),
      itemCategory: data.itemCategory?.trim(),
      portfolio: data.portfolio?.trim(),
      solutionSegment: data.solutionSegment?.trim(),
      businessSegment: data.businessSegment?.trim(),
    };
  }
}

// Singleton instance
let productImportService: ProductImportService | null = null;

export function getProductImportService(): ProductImportService {
  if (!productImportService) {
    productImportService = new ProductImportService();
  }
  return productImportService;
}