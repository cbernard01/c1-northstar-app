import { NextRequest, NextResponse } from 'next/server';

import { withAuth, getUserId } from '@/lib/middleware/auth';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { withAccountsRateLimit } from '@/lib/middleware/rate-limit';
import { getImportService } from '@/lib/services/import';
import { assetImportRequestSchema, ImportValidation } from '@/lib/validations/import';
import { logger } from '@/lib/logger';

// POST /api/import/assets - Import and process documents
const postHandler = withErrorHandler(
  withAccountsRateLimit(
    withAuth(async (req) => {
      const userId = getUserId(req);
      
      try {
        // Parse multipart form data
        const formData = await req.formData();
        const files = formData.getAll('files') as File[];
        const optionsJson = formData.get('options') as string;
        const metadataJson = formData.get('metadata') as string;

        if (!files || files.length === 0) {
          return NextResponse.json(
            { error: 'Bad Request', message: 'At least one file is required' },
            { status: 400 }
          );
        }

        // Parse options and metadata
        let options = {};
        let metadata = {};
        
        if (optionsJson) {
          try {
            const parsedOptions = JSON.parse(optionsJson);
            options = assetImportRequestSchema.parse({ options: parsedOptions }).options || {};
          } catch (error) {
            return NextResponse.json(
              { error: 'Bad Request', message: 'Invalid options format' },
              { status: 400 }
            );
          }
        }

        if (metadataJson) {
          try {
            metadata = JSON.parse(metadataJson);
          } catch (error) {
            return NextResponse.json(
              { error: 'Bad Request', message: 'Invalid metadata format' },
              { status: 400 }
            );
          }
        }

        // Validate files
        const importService = getImportService();
        const assetImportData = [];
        const validationErrors: string[] = [];

        for (const file of files) {
          // Check if file type is supported
          if (!importService.isAssetTypeSupported(file.type)) {
            validationErrors.push(`Unsupported file type for ${file.name}: ${file.type}`);
            continue;
          }

          // Validate file
          const fileValidation = ImportValidation.validateFileUpload(file, {
            maxFileSize: (options as any)?.maxFileSize,
            allowedMimeTypes: (options as any)?.allowedMimeTypes,
          });

          if (!fileValidation.valid) {
            validationErrors.push(`Invalid file ${file.name}: ${fileValidation.errors.join(', ')}`);
            continue;
          }

          // Convert file to asset import data
          const buffer = Buffer.from(await file.arrayBuffer());
          const assetData = {
            fileName: file.name,
            originalName: file.name,
            buffer,
            fileSize: file.size,
            mimeType: file.type,
            ...(metadata as any),
          };

          assetImportData.push(assetData);
        }

        if (validationErrors.length > 0) {
          return NextResponse.json(
            { 
              error: 'Bad Request', 
              message: 'File validation failed',
              details: validationErrors,
            },
            { status: 400 }
          );
        }

        if (assetImportData.length === 0) {
          return NextResponse.json(
            { error: 'Bad Request', message: 'No valid files to import' },
            { status: 400 }
          );
        }

        logger.info('Starting asset import', {
          fileCount: assetImportData.length,
          totalSize: assetImportData.reduce((sum, asset) => sum + asset.fileSize, 0),
          userId,
          options,
        });

        // Import assets
        let result;
        if (assetImportData.length === 1) {
          // Single asset import
          result = await importService.importAsset(
            assetImportData[0],
            userId,
            options,
            // Progress callback could be used for WebSocket updates
            undefined
          );
        } else {
          // Batch asset import
          result = await importService.importAssetBatch(
            assetImportData,
            userId,
            options,
            // Progress callback could be used for WebSocket updates
            undefined
          );
        }

        logger.info('Asset import completed', {
          fileCount: assetImportData.length,
          userId,
          result: {
            total: result.total,
            imported: result.imported,
            failed: result.failed,
            chunksGenerated: result.chunksGenerated,
            vectorsStored: result.vectorsStored,
            processingTime: result.processingTime,
          },
        });

        // Return success response
        return NextResponse.json({
          success: true,
          result,
          message: `Successfully imported ${result.imported} assets, generated ${result.chunksGenerated} chunks${result.vectorsStored ? `, stored ${result.vectorsStored} vectors` : ''}`,
        }, { status: 200 });

      } catch (error) {
        logger.error('Asset import failed', { error, userId });
        
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

// GET /api/import/assets/stats - Get asset import statistics
const getStatsHandler = withErrorHandler(
  withAccountsRateLimit(
    withAuth(async (req) => {
      try {
        const url = new URL(req.url);
        const timeRange = url.searchParams.get('timeRange') as 'day' | 'week' | 'month' || 'day';
        
        const importService = getImportService();
        const stats = await importService.assetImport.getImportStats(timeRange);

        return NextResponse.json({
          success: true,
          stats,
        });

      } catch (error) {
        logger.error('Asset stats endpoint error', { error });
        return NextResponse.json(
          { error: 'Internal Server Error', message: 'Failed to get statistics' },
          { status: 500 }
        );
      }
    })
  )
);

// GET /api/import/assets/supported-types - Get supported file types
const getSupportedTypesHandler = withErrorHandler(
  withAccountsRateLimit(
    withAuth(async (req) => {
      try {
        const importService = getImportService();
        const supportedTypes = importService.getSupportedAssetTypes();

        const typeInfo = Object.entries(supportedTypes).map(([mimeType, extension]) => ({
          mimeType,
          extension,
          description: getTypeDescription(mimeType),
        }));

        return NextResponse.json({
          success: true,
          supportedTypes: typeInfo,
          maxFileSize: 50 * 1024 * 1024, // 50MB
          recommendations: [
            'PDF files are ideal for data sheets and case studies',
            'DOCX files work well for proposals and technical documentation',
            'PPTX files are great for sales presentations and training materials',
            'Enable vectorization for better searchability',
            'Use appropriate categories for automatic classification',
          ],
        });

      } catch (error) {
        logger.error('Supported types endpoint error', { error });
        return NextResponse.json(
          { error: 'Internal Server Error', message: 'Failed to get supported types' },
          { status: 500 }
        );
      }
    })
  )
);

// GET /api/import/assets/validate - Validate asset before import
const getValidateHandler = withErrorHandler(
  withAccountsRateLimit(
    withAuth(async (req) => {
      try {
        const url = new URL(req.url);
        const mimeType = url.searchParams.get('mimeType');
        const fileSize = url.searchParams.get('fileSize');
        
        if (!mimeType) {
          return NextResponse.json(
            { error: 'Bad Request', message: 'mimeType parameter is required' },
            { status: 400 }
          );
        }

        const importService = getImportService();
        const isSupported = importService.isAssetTypeSupported(mimeType);
        const fileSizeNum = fileSize ? parseInt(fileSize) : 0;
        const maxSize = 50 * 1024 * 1024; // 50MB

        const validation = {
          supported: isSupported,
          sizeValid: fileSizeNum <= maxSize,
          maxFileSize: maxSize,
          fileType: importService.assetImport.getFileExtension(mimeType),
          recommendations: [] as string[],
          warnings: [] as string[],
        };

        if (!isSupported) {
          validation.recommendations.push(`File type ${mimeType} is not supported. Convert to PDF, DOCX, or PPTX.`);
        }

        if (fileSizeNum > maxSize) {
          validation.recommendations.push(`File size (${Math.round(fileSizeNum / 1024 / 1024)}MB) exceeds limit. Split large files.`);
        }

        if (fileSizeNum > 10 * 1024 * 1024) { // 10MB
          validation.warnings.push('Large files may take longer to process');
        }

        if (mimeType === 'application/pdf') {
          validation.recommendations.push('Ensure PDF has searchable text (not just images)');
        }

        return NextResponse.json({
          success: true,
          validation,
        });

      } catch (error) {
        logger.error('Asset validation endpoint error', { error });
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
  } else if (url.pathname.endsWith('/supported-types')) {
    return getSupportedTypesHandler(req);
  } else if (url.pathname.endsWith('/validate')) {
    return getValidateHandler(req);
  }
  
  return NextResponse.json(
    { error: 'Not Found', message: 'Endpoint not found' },
    { status: 404 }
  );
}

// Helper function to get type descriptions
function getTypeDescription(mimeType: string): string {
  const descriptions: Record<string, string> = {
    'application/pdf': 'PDF Documents - Ideal for data sheets, case studies, and reports',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Documents - Great for proposals and documentation',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint Presentations - Perfect for sales decks and training materials',
    'text/plain': 'Text Files - Simple text documents',
    'text/csv': 'CSV Files - Structured data files',
    'application/vnd.ms-excel': 'Excel Files (Legacy) - Spreadsheet data',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Files - Spreadsheet data',
  };

  return descriptions[mimeType] || 'Supported document type';
}