import { NextRequest, NextResponse } from 'next/server';

import { withAuth, getUserId } from '@/lib/middleware/auth';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { withAccountsRateLimit } from '@/lib/middleware/rate-limit';
import { getImportService } from '@/lib/services/import';
import { importStatsQuerySchema } from '@/lib/validations/import';
import { logger } from '@/lib/logger';

// GET /api/import/stats - Get comprehensive import statistics
const getHandler = withErrorHandler(
  withAccountsRateLimit(
    withAuth(async (req) => {
      const userId = getUserId(req);
      
      try {
        const url = new URL(req.url);
        const params = Object.fromEntries(url.searchParams.entries());
        
        const { timeRange, type } = importStatsQuerySchema.parse(params);

        const importService = getImportService();
        
        if (type === 'all') {
          // Get comprehensive stats for all import types
          const stats = await importService.getImportStats(userId, timeRange);
          
          return NextResponse.json({
            success: true,
            timeRange,
            stats,
            generatedAt: new Date().toISOString(),
          });
        } else {
          // Get stats for specific import type
          let typeStats;
          
          switch (type) {
            case 'accounts':
              typeStats = await importService.accountImport.getImportStats(timeRange);
              break;
            case 'products':
              typeStats = await importService.productImport.getImportStats(timeRange);
              break;
            case 'opportunities':
              typeStats = await importService.opportunityImport.getImportStats(timeRange);
              break;
            case 'assets':
              typeStats = await importService.assetImport.getImportStats(timeRange);
              break;
            default:
              return NextResponse.json(
                { error: 'Bad Request', message: 'Invalid import type' },
                { status: 400 }
              );
          }

          return NextResponse.json({
            success: true,
            type,
            timeRange,
            stats: typeStats,
            generatedAt: new Date().toISOString(),
          });
        }

      } catch (error) {
        logger.error('Import stats failed', { error, userId });
        return NextResponse.json(
          { error: 'Internal Server Error', message: 'Failed to get import statistics' },
          { status: 500 }
        );
      }
    })
  )
);

export async function GET(req: NextRequest) {
  return getHandler(req);
}