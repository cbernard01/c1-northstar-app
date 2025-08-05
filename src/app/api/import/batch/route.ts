import { NextRequest, NextResponse } from 'next/server';

import { withAuth, getUserId } from '@/lib/middleware/auth';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { withAccountsRateLimit } from '@/lib/middleware/rate-limit';
import { getImportService } from '@/lib/services/import';
import { batchImportRequestSchema, ImportValidation } from '@/lib/validations/import';
import { logger } from '@/lib/logger';

// POST /api/import/batch - Complex batch import with multiple file types
const postHandler = withErrorHandler(
  withAccountsRateLimit(
    withAuth(async (req) => {
      const userId = getUserId(req);
      
      try {
        // Parse multipart form data
        const formData = await req.formData();
        const optionsJson = formData.get('options') as string;
        
        // Parse options
        let options = {};
        if (optionsJson) {
          try {
            const parsedOptions = JSON.parse(optionsJson);
            options = batchImportRequestSchema.parse({ options: parsedOptions }).options || {};
          } catch (error) {
            return NextResponse.json(
              { error: 'Bad Request', message: 'Invalid options format' },
              { status: 400 }
            );
          }
        }

        // Parse different file types
        const batchData: any = {};
        const validationErrors: string[] = [];

        // Handle accounts file
        const accountsFile = formData.get('accountsFile') as File;
        const accountsOptionsJson = formData.get('accountsOptions') as string;
        
        if (accountsFile) {
          const fileValidation = ImportValidation.validateFileUpload(accountsFile);
          if (!fileValidation.valid) {
            validationErrors.push(`Accounts file invalid: ${fileValidation.errors.join(', ')}`);
          } else {
            const buffer = Buffer.from(await accountsFile.arrayBuffer());
            let accountsOptions = {};
            
            if (accountsOptionsJson) {
              try {
                accountsOptions = JSON.parse(accountsOptionsJson);
              } catch (error) {
                validationErrors.push('Invalid accounts options format');
              }
            }

            batchData.accounts = {
              buffer,
              fileName: accountsFile.name,
              options: accountsOptions,
            };
          }
        }

        // Handle products file
        const productsFile = formData.get('productsFile') as File;
        const productsOptionsJson = formData.get('productsOptions') as string;
        
        if (productsFile) {
          const fileValidation = ImportValidation.validateFileUpload(productsFile);
          if (!fileValidation.valid) {
            validationErrors.push(`Products file invalid: ${fileValidation.errors.join(', ')}`);
          } else {
            const buffer = Buffer.from(await productsFile.arrayBuffer());
            let productsOptions = {};
            
            if (productsOptionsJson) {
              try {
                productsOptions = JSON.parse(productsOptionsJson);
              } catch (error) {
                validationErrors.push('Invalid products options format');
              }
            }

            batchData.products = {
              buffer,
              fileName: productsFile.name,
              options: productsOptions,
            };
          }
        }

        // Handle opportunities file
        const opportunitiesFile = formData.get('opportunitiesFile') as File;
        const opportunitiesOptionsJson = formData.get('opportunitiesOptions') as string;
        
        if (opportunitiesFile) {
          const fileValidation = ImportValidation.validateFileUpload(opportunitiesFile);
          if (!fileValidation.valid) {
            validationErrors.push(`Opportunities file invalid: ${fileValidation.errors.join(', ')}`);
          } else {
            const buffer = Buffer.from(await opportunitiesFile.arrayBuffer());
            let opportunitiesOptions = {};
            
            if (opportunitiesOptionsJson) {
              try {
                opportunitiesOptions = JSON.parse(opportunitiesOptionsJson);
              } catch (error) {
                validationErrors.push('Invalid opportunities options format');
              }
            }

            batchData.opportunities = {
              buffer,
              fileName: opportunitiesFile.name,
              options: opportunitiesOptions,
            };
          }
        }

        // Handle assets files
        const assetFiles = formData.getAll('assetFiles') as File[];
        const assetMetadataJson = formData.get('assetMetadata') as string;
        
        if (assetFiles && assetFiles.length > 0) {
          const importService = getImportService();
          const assetImportData = [];
          let assetMetadata = {};

          if (assetMetadataJson) {
            try {
              assetMetadata = JSON.parse(assetMetadataJson);
            } catch (error) {
              validationErrors.push('Invalid asset metadata format');
            }
          }

          for (const file of assetFiles) {
            if (!importService.isAssetTypeSupported(file.type)) {
              validationErrors.push(`Unsupported asset file type: ${file.type} for ${file.name}`);
              continue;
            }

            const fileValidation = ImportValidation.validateFileUpload(file);
            if (!fileValidation.valid) {
              validationErrors.push(`Asset file ${file.name} invalid: ${fileValidation.errors.join(', ')}`);
              continue;
            }

            const buffer = Buffer.from(await file.arrayBuffer());
            assetImportData.push({
              fileName: file.name,
              originalName: file.name,
              buffer,
              fileSize: file.size,
              mimeType: file.type,
              ...(assetMetadata as any),
            });
          }

          if (assetImportData.length > 0) {
            batchData.assets = assetImportData;
          }
        }

        if (validationErrors.length > 0) {
          return NextResponse.json(
            { 
              error: 'Bad Request', 
              message: 'Batch validation failed',
              details: validationErrors,
            },
            { status: 400 }
          );
        }

        if (Object.keys(batchData).length === 0) {
          return NextResponse.json(
            { error: 'Bad Request', message: 'At least one file type must be provided' },
            { status: 400 }
          );
        }

        logger.info('Starting batch import', {
          importTypes: Object.keys(batchData),
          userId,
          options,
        });

        // Execute batch import
        const importService = getImportService();
        const result = await importService.importBatch(batchData, userId, options);

        logger.info('Batch import completed', {
          jobId: result.jobId,
          userId,
          overallStatus: result.overallStatus,
          summary: result.summary,
          processingTime: result.totalProcessingTime,
        });

        // Return success response
        return NextResponse.json({
          success: true,
          jobId: result.jobId,
          result,
          message: `Batch import ${result.overallStatus}. Processed ${result.summary.totalRecords} records total.`,
        }, { status: 200 });

      } catch (error) {
        logger.error('Batch import failed', { error, userId });
        
        return NextResponse.json(
          { 
            error: 'Internal Server Error', 
            message: 'Batch import failed',
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

// POST /api/import/batch/queue - Queue batch import for background processing
const postQueueHandler = withErrorHandler(
  withAccountsRateLimit(
    withAuth(async (req) => {
      const userId = getUserId(req);
      
      try {
        // Parse multipart form data (same as above)
        const formData = await req.formData();
        const optionsJson = formData.get('options') as string;
        
        // Parse options
        let options = {};
        if (optionsJson) {
          try {
            const parsedOptions = JSON.parse(optionsJson);
            options = batchImportRequestSchema.parse({ options: parsedOptions }).options || {};
          } catch (error) {
            return NextResponse.json(
              { error: 'Bad Request', message: 'Invalid options format' },
              { status: 400 }
            );
          }
        }

        // Parse files (same logic as above, but simplified for brevity)
        const batchData: any = {};
        const validationErrors: string[] = [];

        // Handle each file type (accounts, products, opportunities, assets)
        // ... (same validation logic as above)

        if (validationErrors.length > 0) {
          return NextResponse.json(
            { 
              error: 'Bad Request', 
              message: 'Batch validation failed',
              details: validationErrors,
            },
            { status: 400 }
          );
        }

        if (Object.keys(batchData).length === 0) {
          return NextResponse.json(
            { error: 'Bad Request', message: 'At least one file type must be provided' },
            { status: 400 }
          );
        }

        logger.info('Queueing batch import', {
          importTypes: Object.keys(batchData),
          userId,
          options,
        });

        // Queue batch import for background processing
        const importService = getImportService();
        const { jobId } = await importService.queueImport(batchData, userId, options);

        logger.info('Batch import queued', {
          jobId,
          userId,
          importTypes: Object.keys(batchData),
        });

        // Return job ID for tracking
        return NextResponse.json({
          success: true,
          jobId,
          message: 'Batch import queued successfully. Use the job ID to track progress.',
          trackingUrl: `/api/import/jobs/${jobId}`,
        }, { status: 202 });

      } catch (error) {
        logger.error('Batch import queueing failed', { error, userId });
        
        return NextResponse.json(
          { 
            error: 'Internal Server Error', 
            message: 'Failed to queue batch import',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        );
      }
    })
  )
);

// GET /api/import/batch/validate - Validate batch import structure
const getValidateHandler = withErrorHandler(
  withAccountsRateLimit(
    withAuth(async (req) => {
      try {
        return NextResponse.json({
          success: true,
          batchImportInfo: {
            description: 'Import multiple file types in a single operation',
            supportedTypes: {
              accounts: {
                fileTypes: ['CSV'],
                required: false,
                description: 'Company accounts data',
              },
              products: {
                fileTypes: ['CSV'],
                required: false,
                description: 'Product catalog data',
              },
              opportunities: {
                fileTypes: ['CSV'],
                required: false,
                description: 'Sales opportunities data',
              },
              assets: {
                fileTypes: ['PDF', 'DOCX', 'PPTX', 'TXT'],
                required: false,
                description: 'Sales assets and documents',
                multiple: true,
              },
            },
            processingOrder: [
              'accounts (creates account records)',
              'products (creates product catalog)',
              'opportunities (links to accounts and products)',
              'assets (processes and vectorizes documents)',
              'insights (optional AI-generated insights)',
            ],
            options: {
              generateInsights: 'Generate AI insights from imported data',
              createVectors: 'Create vector embeddings for search',
              linkRelatedData: 'Automatically link related records',
              validateRelationships: 'Validate data relationships',
              rollbackOnError: 'Rollback all changes if any step fails',
              continueOnError: 'Continue processing other types if one fails',
            },
            recommendations: [
              'Import accounts first if opportunities reference them',
              'Import products before opportunities if they contain product data',
              'Enable vector creation for better search capabilities',
              'Use batch processing for large datasets',
              'Monitor job progress using the returned job ID',
            ],
          },
        });

      } catch (error) {
        logger.error('Batch validation endpoint error', { error });
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
  } else if (url.pathname.endsWith('/queue')) {
    // This would be handled by a separate POST to /queue endpoint
    return NextResponse.json(
      { error: 'Method Not Allowed', message: 'Use POST to queue batch imports' },
      { status: 405 }
    );
  }
  
  return NextResponse.json(
    { error: 'Not Found', message: 'Endpoint not found' },
    { status: 404 }
  );
}