import { NextRequest, NextResponse } from 'next/server';

import { withAuth, getUserId } from '@/lib/middleware/auth';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { withAccountsRateLimit } from '@/lib/middleware/rate-limit';
import { getImportService } from '@/lib/services/import';
import { importValidationRequestSchema, ImportValidation } from '@/lib/validations/import';
import { logger } from '@/lib/logger';

// POST /api/import/validate - Validate CSV file before import
const postHandler = withErrorHandler(
  withAccountsRateLimit(
    withAuth(async (req) => {
      const userId = getUserId(req);
      
      try {
        // Parse multipart form data
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const typeParam = formData.get('type') as string;

        if (!file) {
          return NextResponse.json(
            { error: 'Bad Request', message: 'File is required' },
            { status: 400 }
          );
        }

        if (!typeParam) {
          return NextResponse.json(
            { error: 'Bad Request', message: 'Type parameter is required' },
            { status: 400 }
          );
        }

        // Validate type parameter
        let type: 'accounts' | 'products' | 'opportunities';
        try {
          const parsed = importValidationRequestSchema.parse({ type: typeParam });
          type = parsed.type;
        } catch (error) {
          return NextResponse.json(
            { error: 'Bad Request', message: 'Invalid type. Must be accounts, products, or opportunities' },
            { status: 400 }
          );
        }

        // Basic file validation
        const fileValidation = ImportValidation.validateFileUpload(file, {
          allowedMimeTypes: ['text/csv', 'application/csv', 'text/comma-separated-values'],
        });

        if (!fileValidation.valid) {
          return NextResponse.json({
            valid: false,
            errors: fileValidation.errors,
            warnings: fileValidation.warnings,
          });
        }

        // Convert file to buffer and validate structure
        const buffer = Buffer.from(await file.arrayBuffer());
        
        const importService = getImportService();
        const validation = await importService.validateImportData(type, buffer, file.name);

        // Get recommended field mappings if valid
        let fieldMappings = {};
        let structureValidation = { valid: true, errors: [], warnings: [] };
        
        if (validation.valid && validation.preview.length > 0) {
          const headers = Object.keys(validation.preview[0]);
          fieldMappings = ImportValidation.getFieldMappings(headers, type);
          structureValidation = ImportValidation.validateCsvStructure(headers, type);
        }

        logger.info('CSV validation completed', {
          fileName: file.name,
          type,
          userId,
          valid: validation.valid,
          totalRows: validation.totalRows,
        });

        return NextResponse.json({
          valid: validation.valid && structureValidation.valid,
          errors: [
            ...validation.errors,
            ...structureValidation.errors,
          ],
          warnings: [
            ...validation.warnings,
            ...structureValidation.warnings,
            ...fileValidation.warnings,
          ],
          preview: validation.preview,
          totalRows: validation.totalRows,
          fieldMappings,
          recommendations: getRecommendations(type, validation, structureValidation),
          estimatedProcessingTime: estimation(validation.totalRows, type),
        });

      } catch (error) {
        logger.error('CSV validation failed', { error, userId });
        
        return NextResponse.json({
          valid: false,
          errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
          warnings: [],
        }, { status: 500 });
      }
    })
  )
);

export async function POST(req: NextRequest) {
  return postHandler(req);
}

// GET /api/import/validate/templates - Get CSV templates for each import type
const getTemplatesHandler = withErrorHandler(
  withAccountsRateLimit(
    withAuth(async (req) => {
      try {
        const templates = {
          accounts: {
            requiredFields: ['name'],
            recommendedFields: [
              'domain', 
              'industry', 
              'size', 
              'location', 
              'description', 
              'website'
            ],
            optionalFields: [
              'account_number',
              'gem_status',
              'crm_owner',
              'target_solutions',
              'battle_card_notes',
              'competitor_research',
              'recommended_solution',
              'cc_intent',
              'cc_vendor',
              'uc_intent', 
              'uc_vendor',
              'dc_intent',
              'dc_vendor',
              'en_intent',
              'en_vendor',
              'sx_intent',
              'sx_vendor',
              'final_customer_segment',
              'ce_customer_segment',
              'program_category'
            ],
            sampleData: {
              name: 'Acme Corporation',
              domain: 'acme.com',
              industry: 'Technology',
              size: 'large',
              location: 'San Francisco, CA',
              description: 'Leading technology solutions provider',
              website: 'https://acme.com',
            },
          },
          
          products: {
            requiredFields: ['itemNumber'],
            recommendedFields: [
              'itemDescription',
              'itemManufacturer', 
              'itemCategory',
              'currentCost'
            ],
            optionalFields: [
              'itemTypeCode',
              'itemTypeDescription',
              'productType',
              'itemRevenueCategory',
              'itemLineOfBusiness',
              'itemSubcategory',
              'itemClass',
              'portfolio',
              'scdStartDate',
              'scdEndDate',
              'isCurrentRecordFlag',
              'offer',
              'practice',
              'solutionSegment',
              'businessSegment',
              'manufacturerPractice',
              'manufacturerItemCategory',
              'growthCategory'
            ],
            sampleData: {
              itemNumber: 'PROD-001',
              itemDescription: 'Wireless Router 802.11ac',
              itemManufacturer: 'TechCorp',
              itemCategory: 'Networking',
              currentCost: 299.99,
              solutionSegment: 'Enterprise Networking',
              businessSegment: 'SMB',
            },
          },
          
          opportunities: {
            requiredFields: ['opportunityNumber', 'customerName'],
            recommendedFields: [
              'oppStage',
              'salesPerson',
              'bookedGrossRevenue',
              'pipelineGrossRevenue',
              'estimatedCloseDate'
            ],
            optionalFields: [
              'salesDirector',
              'margin',
              'bookedDate',
              'accountId',
              'account_number',
              'itemNumber',
              'gpRevenueCategory',
              'mappedSolutionArea',
              'mappedSegment',
              'mappedCapability',
              'itemCategory'
            ],
            sampleData: {
              opportunityNumber: 'OPP-2024-001',
              customerName: 'Acme Corporation',
              oppStage: 'Qualified',
              salesPerson: 'John Smith',
              bookedGrossRevenue: 50000,
              pipelineGrossRevenue: 75000,
              margin: 25.5,
              estimatedCloseDate: '2024-12-31',
            },
          },
        };

        return NextResponse.json({
          success: true,
          templates,
          downloadLinks: {
            accounts: '/api/import/validate/templates/accounts.csv',
            products: '/api/import/validate/templates/products.csv',
            opportunities: '/api/import/validate/templates/opportunities.csv',
          },
          generalGuidelines: [
            'Use UTF-8 encoding for CSV files',
            'Include headers in the first row',
            'Avoid special characters in field names',
            'Use consistent date formats (YYYY-MM-DD recommended)',
            'Ensure numeric fields contain only numbers',
            'Remove leading/trailing spaces from text fields',
            'Check for duplicate records before import',
          ],
        });

      } catch (error) {
        logger.error('Template endpoint error', { error });
        return NextResponse.json(
          { error: 'Internal Server Error', message: 'Failed to get templates' },
          { status: 500 }
        );
      }
    })
  )
);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  
  if (url.pathname.endsWith('/templates')) {
    return getTemplatesHandler(req);
  }
  
  return NextResponse.json(
    { error: 'Not Found', message: 'Endpoint not found' },
    { status: 404 }
  );
}

// Helper functions
function getRecommendations(
  type: 'accounts' | 'products' | 'opportunities',
  validation: any,
  structureValidation: any
): string[] {
  const recommendations: string[] = [];

  // General recommendations
  if (validation.totalRows > 1000) {
    recommendations.push('Large dataset detected. Consider enabling batch processing for better performance.');
  }

  if (validation.totalRows > 10000) {
    recommendations.push('Very large dataset. Consider splitting into smaller files or using background processing.');
  }

  // Type-specific recommendations
  switch (type) {
    case 'accounts':
      if (!validation.preview.some((row: any) => row.domain)) {
        recommendations.push('Include domain field for better duplicate detection and account linking.');
      }
      recommendations.push('Enable vector creation to make accounts searchable in AI features.');
      break;

    case 'products':
      if (validation.preview.some((row: any) => row.scdStartDate || row.scdEndDate)) {
        recommendations.push('SCD (Slowly Changing Dimensions) fields detected. Enable SCD processing in options.');
      }
      recommendations.push('Ensure item numbers are unique across your product catalog.');
      break;

    case 'opportunities':
      recommendations.push('Enable "createMissingAccounts" if some accounts are not yet imported.');
      recommendations.push('Enable "linkProducts" if your CSV contains product information.');
      if (validation.preview.some((row: any) => row.itemNumber || row.product_number)) {
        recommendations.push('Product data detected. Consider importing products first for better linking.');
      }
      break;
  }

  return recommendations;
}

function estimation(totalRows: number, type: string): number {
  // Rough estimation based on row count and complexity
  const baseTimePerRow = {
    accounts: 50, // ms per row
    products: 30,
    opportunities: 100,
  };

  const base = (baseTimePerRow as any)[type] || 50;
  return Math.max(1000, totalRows * base); // At least 1 second
}