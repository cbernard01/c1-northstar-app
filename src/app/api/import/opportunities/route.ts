import { NextRequest, NextResponse } from 'next/server';

import { withAuth, getUserId } from '@/lib/middleware/auth';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { withAccountsRateLimit } from '@/lib/middleware/rate-limit';
import { getImportService } from '@/lib/services/import';
import { opportunityImportRequestSchema, ImportValidation } from '@/lib/validations/import';
import { logger } from '@/lib/logger';

// POST /api/import/opportunities - Import opportunities from CSV
const postHandler = withErrorHandler(
  withAccountsRateLimit(
    withAuth(async (req) => {
      const userId = getUserId(req);
      
      try {
        // Parse multipart form data
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const optionsJson = formData.get('options') as string;

        if (!file) {
          return NextResponse.json(
            { error: 'Bad Request', message: 'File is required' },
            { status: 400 }
          );
        }

        // Validate file
        const fileValidation = ImportValidation.validateFileUpload(file);
        if (!fileValidation.valid) {
          return NextResponse.json(
            { 
              error: 'Bad Request', 
              message: 'Invalid file',
              details: fileValidation.errors,
            },
            { status: 400 }
          );
        }

        // Parse options
        let options = {};
        if (optionsJson) {
          try {
            const parsedOptions = JSON.parse(optionsJson);
            options = opportunityImportRequestSchema.parse({ options: parsedOptions }).options || {};
          } catch (error) {
            return NextResponse.json(
              { error: 'Bad Request', message: 'Invalid options format' },
              { status: 400 }
            );
          }
        }

        // Convert file to buffer
        const buffer = Buffer.from(await file.arrayBuffer());

        // Validate CSV structure if it's a CSV file
        if (file.type === 'text/csv' || file.type === 'application/csv') {
          try {
            const importService = getImportService();
            const validation = await importService.validateImportData('opportunities', buffer, file.name);
            
            if (!validation.valid) {
              return NextResponse.json(
                { 
                  error: 'Bad Request', 
                  message: 'Invalid CSV structure',
                  details: validation.errors,
                  warnings: validation.warnings,
                  preview: validation.preview,
                },
                { status: 400 }
              );
            }
          } catch (error) {
            logger.error('Opportunity import validation failed', { error, fileName: file.name });
            return NextResponse.json(
              { error: 'Bad Request', message: 'Failed to validate CSV file' },
              { status: 400 }
            );
          }
        }

        // Start import process
        const importService = getImportService();
        
        logger.info('Starting opportunity import', {
          fileName: file.name,
          fileSize: file.size,
          userId,
          options,
        });

        const result = await importService.importOpportunities(
          buffer,
          file.name,
          options,
          // Progress callback could be used for WebSocket updates
          undefined
        );

        logger.info('Opportunity import completed', {
          fileName: file.name,
          userId,
          result: {
            total: result.total,
            created: result.created,
            updated: result.updated,
            failed: result.failed,
            accountsCreated: result.accountsCreated,
            productsLinked: result.productsLinked,
            processingTime: result.processingTime,
          },
        });

        // Return success response
        return NextResponse.json({
          success: true,
          result,
          message: `Successfully imported ${result.created} opportunities, updated ${result.updated} opportunities. Created ${result.accountsCreated} accounts and linked ${result.productsLinked} products.`,
        }, { status: 200 });

      } catch (error) {
        logger.error('Opportunity import failed', { error, userId });
        
        return NextResponse.json(
          { 
            error: 'Internal Server Error', 
            message: 'Import failed',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        );
      }
    })
  )
);

export async function POST(req: NextRequest) {
  return postHandler(req);
}

// GET /api/import/opportunities/stats - Get opportunity import statistics
const getStatsHandler = withErrorHandler(
  withAccountsRateLimit(
    withAuth(async (req) => {
      try {
        const url = new URL(req.url);
        const timeRange = url.searchParams.get('timeRange') as 'day' | 'week' | 'month' || 'day';
        
        const importService = getImportService();
        const stats = await importService.opportunityImport.getImportStats(timeRange);

        return NextResponse.json({
          success: true,
          stats,
        });

      } catch (error) {
        logger.error('Opportunity stats endpoint error', { error });
        return NextResponse.json(
          { error: 'Internal Server Error', message: 'Failed to get statistics' },
          { status: 500 }
        );
      }
    })
  )
);

// GET /api/import/opportunities/validate - Validate opportunity CSV structure
const getValidateHandler = withErrorHandler(
  withAccountsRateLimit(
    withAuth(async (req) => {
      try {
        const url = new URL(req.url);
        const fileName = url.searchParams.get('fileName');
        
        if (!fileName) {
          return NextResponse.json(
            { error: 'Bad Request', message: 'fileName parameter is required' },
            { status: 400 }
          );
        }

        return NextResponse.json({
          valid: true,
          expectedFields: {
            required: [
              'opportunityNumber', 'opportunity_number', 'opp_number',
              'customerName', 'customer_name', 'account_name'
            ],
            optional: [
              'oppStage', 'stage', 'opportunity_stage',
              'salesPerson', 'sales_person', 'sales_rep',
              'salesDirector', 'sales_director',
              'bookedGrossRevenue', 'booked_revenue', 'revenue',
              'pipelineGrossRevenue', 'pipeline_revenue',
              'margin', 'profit_margin',
              'bookedDate', 'close_date',
              'estimatedCloseDate', 'estimated_close_date',
              'accountId', 'account_id', 'account_number'
            ],
          },
          productFields: {
            description: 'Product purchase data can be included in the same CSV',
            fields: [
              'itemNumber', 'item_number', 'product_number', 'sku',
              'gpRevenueCategory', 'revenue_category',
              'mappedSolutionArea', 'solution_area',
              'mappedSegment', 'segment',
              'mappedCapability', 'capability',
              'itemCategory', 'product_category'
            ],
          },
          recommendations: [
            'Include account identifiers (ID or number) for better linking',
            'Revenue fields should be numeric values',
            'Dates should be in ISO format (YYYY-MM-DD) or common formats',
            'Enable createMissingAccounts option if accounts are not pre-imported',
            'Use linkProducts option to automatically link product data',
          ],
        });

      } catch (error) {
        logger.error('Opportunity validation endpoint error', { error });
        return NextResponse.json(
          { error: 'Internal Server Error', message: 'Validation failed' },
          { status: 500 }
        );
      }
    })
  )
);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  
  if (url.pathname.endsWith('/stats')) {
    return getStatsHandler(req);
  } else if (url.pathname.endsWith('/validate')) {
    return getValidateHandler(req);
  }
  
  return NextResponse.json(
    { error: 'Not Found', message: 'Endpoint not found' },
    { status: 404 }
  );
}