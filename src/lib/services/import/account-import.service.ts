import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getChunkingService } from '@/lib/services/chunking';
import { QuickParse } from '@/lib/services/parsers';
import { TParserResult } from '@/lib/services/parsers/file-parser.interface';

export interface AccountImportData {
  accountNumber?: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  location?: string;
  description?: string;
  website?: string;
  gemStatus?: string;
  gemIndex?: string;
  crmOwner?: string;
  targetSolutions?: string;
  battleCardNotes?: string;
  competitorResearch?: string;
  recommendedSolution?: string;
  ccIntent?: string;
  ccVendor?: string;
  ucIntent?: string;
  ucVendor?: string;
  dcIntent?: string;
  dcVendor?: string;
  enIntent?: string;
  enVendor?: string;
  sxIntent?: string;
  sxVendor?: string;
  finalCustomerSegment?: string;
  ceCustomerSegment?: string;
  programCategory?: string;
  metadata?: any;
}

export interface AccountImportOptions {
  skipDuplicates?: boolean;
  updateExisting?: boolean;
  batchSize?: number;
  generateSummaries?: boolean;
  createChunks?: boolean;
  storeVectors?: boolean;
  validateDomains?: boolean;
}

export interface AccountImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  duplicates: number;
  errors: Array<{
    row: number;
    account: string;
    error: string;
  }>;
  warnings: Array<{
    row: number;
    account: string;
    warning: string;
  }>;
  accountIds: string[];
  processingTime: number;
}

export interface AccountImportProgress {
  stage: 'parsing' | 'validation' | 'importing' | 'chunking' | 'vectorizing' | 'completed';
  processed: number;
  total: number;
  currentAccount?: string;
  errors: number;
  warnings: number;
}

export class AccountImportService {
  private readonly chunkingService = getChunkingService();

  /**
   * Import accounts from CSV buffer
   */
  async importFromCsv(
    buffer: Buffer,
    fileName: string,
    options: AccountImportOptions = {},
    onProgress?: (progress: AccountImportProgress) => void
  ): Promise<AccountImportResult> {
    const startTime = Date.now();
    const result: AccountImportResult = {
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      duplicates: 0,
      errors: [],
      warnings: [],
      accountIds: [],
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

      logger.info(`AccountImportService: Parsed ${result.total} accounts from CSV`, {
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

      const validAccounts: AccountImportData[] = [];
      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        const rowNumber = i + 1;

        try {
          const accountData = this.transformCsvRow(row, rowNumber);
          const validation = this.validateAccountData(accountData, rowNumber);
          
          if (validation.errors.length > 0) {
            result.errors.push(...validation.errors);
            result.failed++;
          } else {
            validAccounts.push(accountData);
            if (validation.warnings.length > 0) {
              result.warnings.push(...validation.warnings);
            }
          }
        } catch (error) {
          result.errors.push({
            row: rowNumber,
            account: row.name || `Row ${rowNumber}`,
            error: error instanceof Error ? error.message : 'Unknown validation error',
          });
          result.failed++;
        }

        onProgress?.({
          stage: 'validation',
          processed: i + 1,
          total: result.total,
          currentAccount: row.name,
          errors: result.errors.length,
          warnings: result.warnings.length,
        });
      }

      // Stage 3: Import accounts
      onProgress?.({
        stage: 'importing',
        processed: 0,
        total: validAccounts.length,
        errors: result.errors.length,
        warnings: result.warnings.length,
      });

      const batchSize = options.batchSize || 50;
      for (let i = 0; i < validAccounts.length; i += batchSize) {
        const batch = validAccounts.slice(i, i + batchSize);
        const batchResult = await this.importAccountBatch(batch, options);
        
        result.created += batchResult.created;
        result.updated += batchResult.updated;
        result.skipped += batchResult.skipped;
        result.duplicates += batchResult.duplicates;
        result.accountIds.push(...batchResult.accountIds);
        result.errors.push(...batchResult.errors);

        onProgress?.({
          stage: 'importing',
          processed: Math.min(i + batchSize, validAccounts.length),
          total: validAccounts.length,
          errors: result.errors.length,
          warnings: result.warnings.length,
        });
      }

      // Stage 4: Generate chunks and vectors if requested
      if ((options.createChunks || options.storeVectors) && result.accountIds.length > 0) {
        await this.processAccountVectorization(result.accountIds, options, onProgress);
      }

      onProgress?.({
        stage: 'completed',
        processed: validAccounts.length,
        total: validAccounts.length,
        errors: result.errors.length,
        warnings: result.warnings.length,
      });

      result.processingTime = Date.now() - startTime;

      logger.info('AccountImportService: Import completed', {
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
      logger.error('AccountImportService: Import failed', { fileName, error });
      throw error;
    }
  }

  /**
   * Transform CSV row to AccountImportData
   */
  private transformCsvRow(row: any, rowNumber: number): AccountImportData {
    // Map common CSV column names to our schema
    const columnMapping: Record<string, string> = {
      'account_number': 'accountNumber',
      'account_name': 'name',
      'company_name': 'name',
      'account_domain': 'domain',
      'company_domain': 'domain',
      'account_industry': 'industry',
      'company_industry': 'industry',
      'account_size': 'size',
      'company_size': 'size',
      'account_location': 'location',
      'company_location': 'location',
      'account_description': 'description',
      'company_description': 'description',
      'account_website': 'website',
      'company_website': 'website',
      'gem_status': 'gemStatus',
      'gem_index': 'gemIndex',
      'crm_owner': 'crmOwner',
      'target_solutions': 'targetSolutions',
      'battle_card_notes': 'battleCardNotes',
      'competitor_research': 'competitorResearch',
      'recommended_solution': 'recommendedSolution',
      'cc_intent': 'ccIntent',
      'cc_vendor': 'ccVendor',
      'uc_intent': 'ucIntent',
      'uc_vendor': 'ucVendor',
      'dc_intent': 'dcIntent',
      'dc_vendor': 'dcVendor',
      'en_intent': 'enIntent',
      'en_vendor': 'enVendor',
      'sx_intent': 'sxIntent',
      'sx_vendor': 'sxVendor',
      'final_customer_segment': 'finalCustomerSegment',
      'ce_customer_segment': 'ceCustomerSegment',
      'program_category': 'programCategory',
    };

    const accountData: AccountImportData = {
      name: '', // Required field
    };

    // Transform the row using column mapping
    for (const [csvKey, value] of Object.entries(row)) {
      if (value === null || value === undefined || value === '') continue;

      const normalizedKey = csvKey.toLowerCase().trim();
      const mappedKey = columnMapping[normalizedKey] || normalizedKey;

      if (mappedKey === 'name' || mappedKey === 'accountName' || mappedKey === 'companyName') {
        accountData.name = String(value).trim();
      } else if (Object.prototype.hasOwnProperty.call(accountData, mappedKey)) {
        (accountData as any)[mappedKey] = String(value).trim();
      }
    }

    // Validate domain format
    if (accountData.domain) {
      accountData.domain = this.normalizeDomain(accountData.domain);
    }

    // Set metadata for additional fields
    const additionalFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = key.toLowerCase().trim();
      if (!columnMapping[normalizedKey] && !normalizedKey.includes('name')) {
        additionalFields[key] = value;
      }
    }

    if (Object.keys(additionalFields).length > 0) {
      accountData.metadata = additionalFields;
    }

    return accountData;
  }

  /**
   * Validate account data
   */
  private validateAccountData(
    data: AccountImportData,
    rowNumber: number
  ): {
    errors: Array<{ row: number; account: string; error: string }>;
    warnings: Array<{ row: number; account: string; warning: string }>;
  } {
    const errors: Array<{ row: number; account: string; error: string }> = [];
    const warnings: Array<{ row: number; account: string; warning: string }> = [];
    const accountName = data.name || `Row ${rowNumber}`;

    // Required field validation
    if (!data.name || data.name.trim().length === 0) {
      errors.push({
        row: rowNumber,
        account: accountName,
        error: 'Account name is required',
      });
    }

    // Domain validation
    if (data.domain && !this.isValidDomain(data.domain)) {
      warnings.push({
        row: rowNumber,
        account: accountName,
        warning: `Invalid domain format: ${data.domain}`,
      });
    }

    // Business rule validations
    if (data.name && data.name.length > 255) {
      errors.push({
        row: rowNumber,
        account: accountName,
        error: 'Account name exceeds maximum length (255 characters)',
      });
    }

    if (data.description && data.description.length > 2000) {
      warnings.push({
        row: rowNumber,
        account: accountName,
        warning: 'Description is very long and may be truncated',
      });
    }

    return { errors, warnings };
  }

  /**
   * Import a batch of accounts
   */
  private async importAccountBatch(
    accounts: AccountImportData[],
    options: AccountImportOptions
  ): Promise<Omit<AccountImportResult, 'total' | 'processingTime'>> {
    const result = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      duplicates: 0,
      errors: [] as Array<{ row: number; account: string; error: string }>,
      accountIds: [] as string[],
    };

    for (const accountData of accounts) {
      try {
        // Check for existing account
        const existingAccount = await this.findExistingAccount(accountData);
        
        if (existingAccount) {
          if (options.updateExisting) {
            // Update existing account
            const updated = await prisma.companyAccount.update({
              where: { id: existingAccount.id },
              data: {
                ...accountData,
                updatedAt: new Date(),
              },
            });
            result.updated++;
            result.accountIds.push(updated.id);
          } else if (options.skipDuplicates) {
            result.skipped++;
            result.duplicates++;
          } else {
            result.errors.push({
              row: 0, // We don't have row context in batch processing
              account: accountData.name,
              error: 'Account already exists',
            });
            result.failed++;
          }
        } else {
          // Create new account
          const created = await prisma.companyAccount.create({
            data: {
              ...accountData,
              accountNumber: accountData.accountNumber || this.generateAccountNumber(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          result.created++;
          result.accountIds.push(created.id);
        }
      } catch (error) {
        result.errors.push({
          row: 0,
          account: accountData.name,
          error: error instanceof Error ? error.message : 'Unknown database error',
        });
        result.failed++;
      }
    }

    return result;
  }

  /**
   * Find existing account by domain or name
   */
  private async findExistingAccount(data: AccountImportData) {
    if (data.domain) {
      const existing = await prisma.companyAccount.findUnique({
        where: { domain: data.domain },
      });
      if (existing) return existing;
    }

    if (data.accountNumber) {
      const existing = await prisma.companyAccount.findUnique({
        where: { accountNumber: data.accountNumber },
      });
      if (existing) return existing;
    }

    // Check for similar names
    const existing = await prisma.companyAccount.findFirst({
      where: {
        name: {
          equals: data.name,
          mode: 'insensitive',
        },
      },
    });

    return existing;
  }

  /**
   * Process account vectorization
   */
  private async processAccountVectorization(
    accountIds: string[],
    options: AccountImportOptions,
    onProgress?: (progress: AccountImportProgress) => void
  ) {
    onProgress?.({
      stage: 'chunking',
      processed: 0,
      total: accountIds.length,
      errors: 0,
      warnings: 0,
    });

    for (let i = 0; i < accountIds.length; i++) {
      const accountId = accountIds[i];
      
      try {
        // Get account data
        const account = await prisma.companyAccount.findUnique({
          where: { id: accountId },
          include: {
            technologies: true,
            contacts: true,
            opportunities: true,
          },
        });

        if (!account) continue;

        // Transform to account data format
        const accountData = {
          accountNumber: account.accountNumber || account.id,
          accountName: account.name,
          summary: account.description || '',
          industry: account.industry,
          size: account.size,
          location: account.location,
          website: account.website,
          contacts: account.contacts,
          technologies: account.technologies,
          opportunities: account.opportunities,
        };

        // Process chunking and vectorization
        await this.chunkingService.processAccount(accountData, {
          generateEmbeddings: options.storeVectors,
          storeVectors: options.storeVectors,
          includeContacts: true,
          includeTechnologies: true,
          includeOpportunities: true,
        });

        onProgress?.({
          stage: 'chunking',
          processed: i + 1,
          total: accountIds.length,
          currentAccount: account.name,
          errors: 0,
          warnings: 0,
        });

      } catch (error) {
        logger.error('AccountImportService: Failed to process account vectorization', {
          accountId,
          error,
        });
      }
    }
  }

  /**
   * Generate unique account number
   */
  private generateAccountNumber(): string {
    return `ACC-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;
  }

  /**
   * Normalize domain format
   */
  private normalizeDomain(domain: string): string {
    return domain.toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');
  }

  /**
   * Validate domain format
   */
  private isValidDomain(domain: string): boolean {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
    return domainRegex.test(domain);
  }

  /**
   * Get import statistics
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

    const stats = await prisma.companyAccount.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      _count: {
        id: true,
      },
    });

    return {
      totalImported: stats.reduce((sum, stat) => sum + stat._count.id, 0),
      importsByDay: stats,
      timeRange,
    };
  }
}

// Singleton instance
let accountImportService: AccountImportService | null = null;

export function getAccountImportService(): AccountImportService {
  if (!accountImportService) {
    accountImportService = new AccountImportService();
  }
  return accountImportService;
}