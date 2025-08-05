import { NextRequest, NextResponse } from 'next/server';

import { withAuth, getUserId } from '@/lib/middleware/auth';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { withAccountsRateLimit } from '@/lib/middleware/rate-limit';
import { getImportService } from '@/lib/services/import';
import { productImportRequestSchema, ImportValidation } from '@/lib/validations/import';
import { logger } from '@/lib/logger';

// POST /api/import/products - Import products from CSV
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
            options = productImportRequestSchema.parse({ options: parsedOptions }).options || {};
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
            const validation = await importService.validateImportData('products', buffer, file.name);
            
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
            logger.error('Product import validation failed', { error, fileName: file.name });
            return NextResponse.json(
              { error: 'Bad Request', message: 'Failed to validate CSV file' },
              { status: 400 }
            );
          }
        }

        // Start import process
        const importService = getImportService();
        
        logger.info('Starting product import', {
          fileName: file.name,
          fileSize: file.size,
          userId,
          options,
        });

        const result = await importService.importProducts(
          buffer,
          file.name,
          options,
          // Progress callback could be used for WebSocket updates
          undefined
        );

        logger.info('Product import completed', {
          fileName: file.name,
          userId,
          result: {
            total: result.total,
            created: result.created,
            updated: result.updated,
            failed: result.failed,
            processingTime: result.processingTime,
          },
        });

        // Return success response
        return NextResponse.json({
          success: true,
          result,
          message: `Successfully imported ${result.created} products, updated ${result.updated} products`,
        }, { status: 200 });

      } catch (error) {
        logger.error('Product import failed', { error, userId });
        
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

// GET /api/import/products/stats - Get product import statistics
const getStatsHandler = withErrorHandler(
  withAccountsRateLimit(
    withAuth(async (req) => {
      try {
        const url = new URL(req.url);
        const timeRange = url.searchParams.get('timeRange') as 'day' | 'week' | 'month' || 'day';
        
        const importService = getImportService();
        const stats = await importService.productImport.getImportStats(timeRange);

        return NextResponse.json({
          success: true,
          stats,
        });

      } catch (error) {
        logger.error('Product stats endpoint error', { error });
        return NextResponse.json(
          { error: 'Internal Server Error', message: 'Failed to get statistics' },
          { status: 500 }
        );
      }
    })
  )
);

// GET /api/import/products/validate - Validate product CSV structure
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
            required: ['itemNumber', 'item_number', 'product_number', 'sku'],
            optional: [
              'itemDescription', 'item_description', 'description',
              'itemManufacturer', 'manufacturer',
              'itemCategory', 'category',
              'currentCost', 'cost', 'price',
              'productType', 'solutionSegment', 'businessSegment',
              'portfolio', 'offer', 'practice'
            ],
          },
          recommendations: [
            'Ensure item numbers are unique',
            'Include manufacturer and category for better organization',
            'Cost/price information helps with revenue analysis',
            'Use consistent naming conventions across all products',
          ],
          scdInfo: {
            description: 'Slowly Changing Dimensions (SCD) support available',
            fields: ['scdStartDate', 'scdEndDate', 'isCurrentRecordFlag'],
            note: 'Enable SCD in options to track product changes over time',
          },
        });

      } catch (error) {
        logger.error('Product validation endpoint error', { error });
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