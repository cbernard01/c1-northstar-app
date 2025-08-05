import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/middleware/auth';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { getImportService } from '@/lib/services/import';
import { logger } from '@/lib/logger';

// GET /api/import/health - Check health of all import services
const getHandler = withErrorHandler(
  withAuth(async (req) => {
    try {
      const importService = getImportService();
      const health = await importService.healthCheck();

      const status = health.healthy ? 200 : 503;
      const overallStatus = health.healthy ? 'healthy' : 'unhealthy';

      // Calculate service health summary
      const serviceSummary = Object.entries(health.services).reduce((acc, [serviceName, serviceHealth]) => {
        acc[serviceHealth.status] = (acc[serviceHealth.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const response = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        services: health.services,
        summary: {
          total: Object.keys(health.services).length,
          healthy: serviceSummary.healthy || 0,
          degraded: serviceSummary.degraded || 0,
          unhealthy: serviceSummary.unhealthy || 0,
        },
        version: '1.0.0',
        uptime: process.uptime(),
      };

      if (status === 503) {
        logger.warn('Import services health check failed', { 
          unhealthyServices: Object.entries(health.services)
            .filter(([, service]) => service.status === 'unhealthy')
            .map(([name]) => name),
        });
      }

      return NextResponse.json(response, { status });

    } catch (error) {
      logger.error('Import health check failed', { error });
      
      return NextResponse.json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        version: '1.0.0',
        uptime: process.uptime(),
      }, { status: 503 });
    }
  })
);

export async function GET(req: NextRequest) {
  return getHandler(req);
}