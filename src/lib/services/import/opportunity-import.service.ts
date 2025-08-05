import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { QuickParse } from '@/lib/services/parsers';

export interface OpportunityImportData {
  opportunityNumber: string;
  customerName: string;
  oppStage?: string;
  salesPerson?: string;
  salesDirector?: string;
  bookedGrossRevenue?: number;
  pipelineGrossRevenue?: number;
  margin?: number;
  bookedDate?: Date;
  estimatedCloseDate?: Date;
  accountId?: string;
  accountNumber?: string;
  accountName?: string;
  products?: ProductPurchaseData[];
}

export interface ProductPurchaseData {
  itemNumber: string;
  gpRevenueCategory?: string;
  mappedSolutionArea?: string;
  mappedSegment?: string;
  mappedCapability?: string;
  itemCategory?: string;
  quantity?: number;
  unitPrice?: number;
  totalValue?: number;
}

export interface OpportunityImportOptions {
  skipDuplicates?: boolean;
  updateExisting?: boolean;
  batchSize?: number;
  createMissingAccounts?: boolean;
  createMissingProducts?: boolean;
  validateRevenue?: boolean;
  linkProducts?: boolean;
}

export interface OpportunityImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  duplicates: number;
  accountsCreated: number;
  productsLinked: number;
  errors: Array<{
    row: number;
    opportunity: string;
    error: string;
  }>;
  warnings: Array<{
    row: number;
    opportunity: string;
    warning: string;
  }>;
  opportunityIds: string[];
  processingTime: number;
}

export interface OpportunityImportProgress {
  stage: 'parsing' | 'validation' | 'importing' | 'linking_accounts' | 'linking_products' | 'completed';
  processed: number;
  total: number;
  currentOpportunity?: string;
  errors: number;
  warnings: number;
}

export class OpportunityImportService {
  /**
   * Import opportunities from CSV buffer
   */
  async importFromCsv(
    buffer: Buffer,
    fileName: string,
    options: OpportunityImportOptions = {},
    onProgress?: (progress: OpportunityImportProgress) => void
  ): Promise<OpportunityImportResult> {
    const startTime = Date.now();
    const result: OpportunityImportResult = {
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      duplicates: 0,
      accountsCreated: 0,
      productsLinked: 0,
      errors: [],
      warnings: [],
      opportunityIds: [],
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

      logger.info(`OpportunityImportService: Parsed ${result.total} opportunities from CSV`, {
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

      const validOpportunities: OpportunityImportData[] = [];
      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        const rowNumber = i + 1;

        try {
          const opportunityData = this.transformCsvRow(row, rowNumber);
          const validation = this.validateOpportunityData(opportunityData, rowNumber);
          
          if (validation.errors.length > 0) {
            result.errors.push(...validation.errors);
            result.failed++;
          } else {
            validOpportunities.push(opportunityData);
            if (validation.warnings.length > 0) {
              result.warnings.push(...validation.warnings);
            }
          }
        } catch (error) {
          result.errors.push({
            row: rowNumber,
            opportunity: row.opportunityNumber || `Row ${rowNumber}`,
            error: error instanceof Error ? error.message : 'Unknown validation error',
          });
          result.failed++;
        }

        onProgress?.({
          stage: 'validation',
          processed: i + 1,
          total: result.total,
          currentOpportunity: row.opportunityNumber,
          errors: result.errors.length,
          warnings: result.warnings.length,
        });
      }

      // Stage 3: Link accounts
      if (options.createMissingAccounts) {
        await this.linkOrCreateAccounts(validOpportunities, result, onProgress);
      }

      // Stage 4: Import opportunities
      onProgress?.({
        stage: 'importing',
        processed: 0,
        total: validOpportunities.length,
        errors: result.errors.length,
        warnings: result.warnings.length,
      });

      const batchSize = options.batchSize || 50;
      for (let i = 0; i < validOpportunities.length; i += batchSize) {
        const batch = validOpportunities.slice(i, i + batchSize);
        const batchResult = await this.importOpportunityBatch(batch, options);
        
        result.created += batchResult.created;
        result.updated += batchResult.updated;
        result.skipped += batchResult.skipped;
        result.duplicates += batchResult.duplicates;
        result.opportunityIds.push(...batchResult.opportunityIds);
        result.errors.push(...batchResult.errors);

        onProgress?.({
          stage: 'importing',
          processed: Math.min(i + batchSize, validOpportunities.length),
          total: validOpportunities.length,
          errors: result.errors.length,
          warnings: result.warnings.length,
        });
      }

      // Stage 5: Link products if requested
      if (options.linkProducts && result.opportunityIds.length > 0) {
        await this.linkProducts(result.opportunityIds, validOpportunities, result, onProgress);
      }

      onProgress?.({
        stage: 'completed',
        processed: validOpportunities.length,
        total: validOpportunities.length,
        errors: result.errors.length,
        warnings: result.warnings.length,
      });

      result.processingTime = Date.now() - startTime;

      logger.info('OpportunityImportService: Import completed', {
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
      logger.error('OpportunityImportService: Import failed', { fileName, error });
      throw error;
    }
  }

  /**
   * Transform CSV row to OpportunityImportData
   */
  private transformCsvRow(row: any, rowNumber: number): OpportunityImportData {
    // Map common CSV column names to our schema
    const columnMapping: Record<string, string> = {
      'opportunity_number': 'opportunityNumber',
      'opp_number': 'opportunityNumber',
      'opportunity_id': 'opportunityNumber',
      'customer_name': 'customerName',
      'account_name': 'customerName',
      'opp_stage': 'oppStage',
      'stage': 'oppStage',
      'opportunity_stage': 'oppStage',
      'sales_person': 'salesPerson',
      'sales_rep': 'salesPerson',
      'salesperson': 'salesPerson',
      'sales_director': 'salesDirector',
      'director': 'salesDirector',
      'booked_gross_revenue': 'bookedGrossRevenue',
      'booked_revenue': 'bookedGrossRevenue',
      'revenue': 'bookedGrossRevenue',
      'pipeline_gross_revenue': 'pipelineGrossRevenue',
      'pipeline_revenue': 'pipelineGrossRevenue',
      'pipeline': 'pipelineGrossRevenue',
      'margin': 'margin',
      'profit_margin': 'margin',
      'booked_date': 'bookedDate',
      'close_date': 'bookedDate',
      'estimated_close_date': 'estimatedCloseDate',
      'est_close_date': 'estimatedCloseDate',
      'projected_close': 'estimatedCloseDate',
      'account_id': 'accountId',
      'account_number': 'accountNumber',
      'account_name': 'accountName',
    };

    const opportunityData: OpportunityImportData = {
      opportunityNumber: '',
      customerName: '',
    };

    // Transform the row using column mapping
    for (const [csvKey, value] of Object.entries(row)) {
      if (value === null || value === undefined || value === '') continue;

      const normalizedKey = csvKey.toLowerCase().trim();
      const mappedKey = columnMapping[normalizedKey] || normalizedKey;

      if (mappedKey === 'opportunityNumber') {
        opportunityData.opportunityNumber = String(value).trim();
      } else if (mappedKey === 'customerName' || mappedKey === 'accountName') {
        if (!opportunityData.customerName) {
          opportunityData.customerName = String(value).trim();
        }
      } else if (['bookedGrossRevenue', 'pipelineGrossRevenue', 'margin'].includes(mappedKey)) {
        const numValue = parseFloat(String(value));
        if (!isNaN(numValue)) {
          (opportunityData as any)[mappedKey] = numValue;
        }
      } else if (['bookedDate', 'estimatedCloseDate'].includes(mappedKey)) {
        const dateValue = this.parseDate(value);
        if (dateValue) {
          (opportunityData as any)[mappedKey] = dateValue;
        }
      } else if (Object.prototype.hasOwnProperty.call(opportunityData, mappedKey)) {
        (opportunityData as any)[mappedKey] = String(value).trim();
      }
    }

    // Extract product data if present in the same row
    this.extractProductData(row, opportunityData);

    return opportunityData;
  }

  /**
   * Extract product purchase data from CSV row
   */
  private extractProductData(row: any, opportunityData: OpportunityImportData) {
    const productFields = {
      'item_number': 'itemNumber',
      'product_number': 'itemNumber',
      'sku': 'itemNumber',
      'gp_revenue_category': 'gpRevenueCategory',
      'revenue_category': 'gpRevenueCategory',
      'mapped_solution_area': 'mappedSolutionArea',
      'solution_area': 'mappedSolutionArea',
      'mapped_segment': 'mappedSegment',
      'segment': 'mappedSegment',
      'mapped_capability': 'mappedCapability',
      'capability': 'mappedCapability',
      'item_category': 'itemCategory',
      'product_category': 'itemCategory',
      'quantity': 'quantity',
      'unit_price': 'unitPrice',
      'price': 'unitPrice',
      'total_value': 'totalValue',
      'value': 'totalValue',
    };

    const productData: ProductPurchaseData = {
      itemNumber: '',
    };

    let hasProductData = false;
    for (const [csvKey, value] of Object.entries(row)) {
      if (value === null || value === undefined || value === '') continue;

      const normalizedKey = csvKey.toLowerCase().trim();
      const mappedKey = productFields[normalizedKey as keyof typeof productFields];

      if (mappedKey) {
        hasProductData = true;
        if (mappedKey === 'itemNumber') {
          productData.itemNumber = String(value).trim();
        } else if (['quantity', 'unitPrice', 'totalValue'].includes(mappedKey)) {
          const numValue = parseFloat(String(value));
          if (!isNaN(numValue)) {
            (productData as any)[mappedKey] = numValue;
          }
        } else {
          (productData as any)[mappedKey] = String(value).trim();
        }
      }
    }

    if (hasProductData && productData.itemNumber) {
      opportunityData.products = [productData];
    }
  }

  /**
   * Validate opportunity data
   */
  private validateOpportunityData(
    data: OpportunityImportData,
    rowNumber: number
  ): {
    errors: Array<{ row: number; opportunity: string; error: string }>;
    warnings: Array<{ row: number; opportunity: string; warning: string }>;
  } {
    const errors: Array<{ row: number; opportunity: string; error: string }> = [];
    const warnings: Array<{ row: number; opportunity: string; warning: string }> = [];
    const opportunityName = data.opportunityNumber || `Row ${rowNumber}`;

    // Required field validation
    if (!data.opportunityNumber || data.opportunityNumber.trim().length === 0) {
      errors.push({
        row: rowNumber,
        opportunity: opportunityName,
        error: 'Opportunity number is required',
      });
    }

    if (!data.customerName || data.customerName.trim().length === 0) {
      errors.push({
        row: rowNumber,
        opportunity: opportunityName,
        error: 'Customer name is required',
      });
    }

    // Business rule validations
    if (data.bookedGrossRevenue && data.bookedGrossRevenue < 0) {
      warnings.push({
        row: rowNumber,
        opportunity: opportunityName,
        warning: 'Negative booked revenue detected',
      });
    }

    if (data.pipelineGrossRevenue && data.pipelineGrossRevenue < 0) {
      warnings.push({
        row: rowNumber,
        opportunity: opportunityName,
        warning: 'Negative pipeline revenue detected',
      });
    }

    if (data.margin && (data.margin < -100 || data.margin > 100)) {
      warnings.push({
        row: rowNumber,
        opportunity: opportunityName,
        warning: 'Margin value seems unusual (should be percentage)',
      });
    }

    if (data.bookedDate && data.estimatedCloseDate && data.bookedDate > data.estimatedCloseDate) {
      warnings.push({
        row: rowNumber,
        opportunity: opportunityName,
        warning: 'Booked date is after estimated close date',
      });
    }

    if (data.estimatedCloseDate && data.estimatedCloseDate < new Date()) {
      warnings.push({
        row: rowNumber,
        opportunity: opportunityName,
        warning: 'Estimated close date is in the past',
      });
    }

    return { errors, warnings };
  }

  /**
   * Link or create accounts for opportunities
   */
  private async linkOrCreateAccounts(
    opportunities: OpportunityImportData[],
    result: OpportunityImportResult,
    onProgress?: (progress: OpportunityImportProgress) => void
  ) {
    onProgress?.({
      stage: 'linking_accounts',
      processed: 0,
      total: opportunities.length,
      errors: result.errors.length,
      warnings: result.warnings.length,
    });

    for (let i = 0; i < opportunities.length; i++) {
      const opportunity = opportunities[i];
      
      try {
        // Try to find existing account
        let account = null;
        
        if (opportunity.accountId) {
          account = await prisma.companyAccount.findUnique({
            where: { id: opportunity.accountId },
          });
        } else if (opportunity.accountNumber) {
          account = await prisma.companyAccount.findUnique({
            where: { accountNumber: opportunity.accountNumber },
          });
        } else {
          // Search by customer name
          account = await prisma.companyAccount.findFirst({
            where: {
              name: {
                equals: opportunity.customerName,
                mode: 'insensitive',
              },
            },
          });
        }

        if (!account) {
          // Create new account
          account = await prisma.companyAccount.create({
            data: {
              name: opportunity.customerName,
              accountNumber: opportunity.accountNumber || this.generateAccountNumber(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          result.accountsCreated++;
        }

        opportunity.accountId = account.id;

        onProgress?.({
          stage: 'linking_accounts',
          processed: i + 1,
          total: opportunities.length,
          currentOpportunity: opportunity.opportunityNumber,
          errors: result.errors.length,
          warnings: result.warnings.length,
        });

      } catch (error) {
        result.errors.push({
          row: 0,
          opportunity: opportunity.opportunityNumber,
          error: `Failed to link account: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }
  }

  /**
   * Import a batch of opportunities
   */
  private async importOpportunityBatch(
    opportunities: OpportunityImportData[],
    options: OpportunityImportOptions
  ): Promise<Omit<OpportunityImportResult, 'total' | 'processingTime' | 'accountsCreated' | 'productsLinked'>> {
    const result = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      duplicates: 0,
      errors: [] as Array<{ row: number; opportunity: string; error: string }>,
      opportunityIds: [] as string[],
    };

    for (const opportunityData of opportunities) {
      try {
        // Check for existing opportunity
        const existingOpportunity = await prisma.opportunity.findUnique({
          where: { opportunityNumber: opportunityData.opportunityNumber },
        });
        
        if (existingOpportunity) {
          if (options.updateExisting) {
            // Update existing opportunity
            const updated = await prisma.opportunity.update({
              where: { id: existingOpportunity.id },
              data: {
                customerName: opportunityData.customerName,
                oppStage: opportunityData.oppStage,
                salesPerson: opportunityData.salesPerson,
                salesDirector: opportunityData.salesDirector,
                bookedGrossRevenue: opportunityData.bookedGrossRevenue || 0,
                pipelineGrossRevenue: opportunityData.pipelineGrossRevenue || 0,
                margin: opportunityData.margin || 0,
                bookedDate: opportunityData.bookedDate,
                estimatedCloseDate: opportunityData.estimatedCloseDate,
                accountId: opportunityData.accountId || existingOpportunity.accountId,
                updatedAt: new Date(),
              },
            });
            result.updated++;
            result.opportunityIds.push(updated.id);
          } else if (options.skipDuplicates) {
            result.skipped++;
            result.duplicates++;
          } else {
            result.errors.push({
              row: 0,
              opportunity: opportunityData.opportunityNumber,
              error: 'Opportunity already exists',
            });
            result.failed++;
          }
        } else {
          // Create new opportunity
          if (!opportunityData.accountId) {
            result.errors.push({
              row: 0,
              opportunity: opportunityData.opportunityNumber,
              error: 'Missing account ID for opportunity',
            });
            result.failed++;
            continue;
          }

          const created = await prisma.opportunity.create({
            data: {
              opportunityNumber: opportunityData.opportunityNumber,
              customerName: opportunityData.customerName,
              oppStage: opportunityData.oppStage,
              salesPerson: opportunityData.salesPerson,
              salesDirector: opportunityData.salesDirector,
              bookedGrossRevenue: opportunityData.bookedGrossRevenue || 0,
              pipelineGrossRevenue: opportunityData.pipelineGrossRevenue || 0,
              margin: opportunityData.margin || 0,
              bookedDate: opportunityData.bookedDate,
              estimatedCloseDate: opportunityData.estimatedCloseDate,
              accountId: opportunityData.accountId,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          result.created++;
          result.opportunityIds.push(created.id);
        }
      } catch (error) {
        result.errors.push({
          row: 0,
          opportunity: opportunityData.opportunityNumber,
          error: error instanceof Error ? error.message : 'Unknown database error',
        });
        result.failed++;
      }
    }

    return result;
  }

  /**
   * Link products to opportunities
   */
  private async linkProducts(
    opportunityIds: string[],
    opportunities: OpportunityImportData[],
    result: OpportunityImportResult,
    onProgress?: (progress: OpportunityImportProgress) => void
  ) {
    onProgress?.({
      stage: 'linking_products',
      processed: 0,
      total: opportunityIds.length,
      errors: result.errors.length,
      warnings: result.warnings.length,
    });

    const opportunityMap = new Map<string, OpportunityImportData>();
    opportunities.forEach(opp => {
      opportunityMap.set(opp.opportunityNumber, opp);
    });

    for (let i = 0; i < opportunityIds.length; i++) {
      const opportunityId = opportunityIds[i];
      
      try {
        const opportunity = await prisma.opportunity.findUnique({
          where: { id: opportunityId },
        });

        if (!opportunity) continue;

        const opportunityData = opportunityMap.get(opportunity.opportunityNumber);
        if (!opportunityData?.products) continue;

        for (const productData of opportunityData.products) {
          try {
            // Find the product
            const product = await prisma.product.findUnique({
              where: { itemNumber: productData.itemNumber },
            });

            if (product) {
              // Create purchase product link
              await prisma.purchaseProduct.create({
                data: {
                  opportunityId,
                  productId: product.id,
                  gpRevenueCategory: productData.gpRevenueCategory,
                  mappedSolutionArea: productData.mappedSolutionArea,
                  mappedSegment: productData.mappedSegment,
                  mappedCapability: productData.mappedCapability,
                  itemCategory: productData.itemCategory,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              });
              result.productsLinked++;
            }
          } catch (error) {
            // Ignore duplicate key errors for product links
            if (!error.message?.includes('unique constraint')) {
              result.warnings.push({
                row: 0,
                opportunity: opportunity.opportunityNumber,
                warning: `Failed to link product ${productData.itemNumber}: ${error.message}`,
              });
            }
          }
        }

        onProgress?.({
          stage: 'linking_products',
          processed: i + 1,
          total: opportunityIds.length,
          currentOpportunity: opportunity.opportunityNumber,
          errors: result.errors.length,
          warnings: result.warnings.length,
        });

      } catch (error) {
        logger.error('OpportunityImportService: Failed to link products', {
          opportunityId,
          error,
        });
      }
    }
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
   * Generate unique account number
   */
  private generateAccountNumber(): string {
    return `ACC-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;
  }

  /**
   * Get opportunity import statistics
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

    const [totalOpportunities, pipelineValue, stageStats] = await Promise.all([
      prisma.opportunity.count({
        where: {
          createdAt: { gte: startDate },
        },
      }),
      prisma.opportunity.aggregate({
        where: {
          createdAt: { gte: startDate },
        },
        _sum: {
          pipelineGrossRevenue: true,
          bookedGrossRevenue: true,
        },
      }),
      prisma.opportunity.groupBy({
        by: ['oppStage'],
        where: {
          oppStage: { not: null },
          createdAt: { gte: startDate },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
    ]);

    return {
      totalOpportunities,
      pipelineValue: pipelineValue._sum.pipelineGrossRevenue || 0,
      bookedValue: pipelineValue._sum.bookedGrossRevenue || 0,
      stageDistribution: stageStats.map(stat => ({
        stage: stat.oppStage,
        count: stat._count.id,
      })),
      timeRange,
    };
  }
}

// Singleton instance
let opportunityImportService: OpportunityImportService | null = null;

export function getOpportunityImportService(): OpportunityImportService {
  if (!opportunityImportService) {
    opportunityImportService = new OpportunityImportService();
  }
  return opportunityImportService;
}