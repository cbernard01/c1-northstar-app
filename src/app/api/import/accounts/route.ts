import { NextRequest, NextResponse } from 'next/server';

import { withAuth, getUserId } from '@/lib/middleware/auth';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { withAccountsRateLimit } from '@/lib/middleware/rate-limit';
import { getImportService } from '@/lib/services/import';
import { accountImportRequestSchema, ImportValidation } from '@/lib/validations/import';
import { logger } from '@/lib/logger';

// POST /api/import/accounts - Import accounts from CSV
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
            options = accountImportRequestSchema.parse({ options: parsedOptions }).options || {};
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
            const validation = await importService.validateImportData('accounts', buffer, file.name);
            
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
            logger.error('Account import validation failed', { error, fileName: file.name });
            return NextResponse.json(
              { error: 'Bad Request', message: 'Failed to validate CSV file' },
              { status: 400 }
            );
          }
        }

        // Start import process
        const importService = getImportService();
        
        logger.info('Starting account import', {
          fileName: file.name,
          fileSize: file.size,
          userId,
          options,
        });

        const result = await importService.importAccounts(
          buffer,
          file.name,
          options,
          // Progress callback could be used for WebSocket updates
          undefined
        );

        logger.info('Account import completed', {
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
          message: `Successfully imported ${result.created} accounts, updated ${result.updated} accounts`,
        }, { status: 200 });

      } catch (error) {
        logger.error('Account import failed', { error, userId });
        
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

// GET /api/import/accounts/validate - Validate account CSV before import
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

        // This endpoint expects the file to be uploaded separately and validated
        // In a real implementation, you might store the file temporarily and validate it
        // For now, we'll return the expected structure
        
        return NextResponse.json({
          valid: true,
          expectedFields: {
            required: ['name', 'account_name', 'company_name'],
            optional: [
              'domain', 'industry', 'size', 'location', 'description',
              'website', 'gem_status', 'crm_owner', 'target_solutions'
            ],
          },
          recommendations: [
            'Include a domain field for better duplicate detection',
            'Ensure account names are unique or provide account numbers',
            'Industry and size fields help with categorization',
          ],
        });

      } catch (error) {
        logger.error('Account validation endpoint error', { error });
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
  if (url.pathname.endsWith('/validate')) {
    return getValidateHandler(req);
  }
  
  return NextResponse.json(
    { error: 'Not Found', message: 'Endpoint not found' },
    { status: 404 }
  );
}