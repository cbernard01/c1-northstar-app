import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { checkRedisHealth } from '@/lib/redis';

/**
 * Readiness probe endpoint
 * Comprehensive health check for all critical services
 * Used by orchestrators to determine if the application is ready to serve traffic
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const checks: Record<string, any> = {};
  let overallStatus = 'healthy';
  const errors: string[] = [];

  try {
    // Check database connectivity
    try {
      await prisma.$queryRaw`SELECT 1 as health_check`;
      checks.database = {
        status: 'healthy',
        message: 'Database connection successful',
      };
    } catch (dbError) {
      checks.database = {
        status: 'unhealthy',
        message: dbError instanceof Error ? dbError.message : 'Database connection failed',
      };
      errors.push('Database connection failed');
      overallStatus = 'unhealthy';
    }

    // Check Redis connectivity
    try {
      const redisHealthy = await checkRedisHealth();
      checks.redis = {
        status: redisHealthy ? 'healthy' : 'unhealthy',
        message: redisHealthy ? 'Redis connection successful' : 'Redis ping failed',
      };
      if (!redisHealthy) {
        errors.push('Redis connection failed');
        overallStatus = 'unhealthy';
      }
    } catch (redisError) {
      checks.redis = {
        status: 'unhealthy',
        message: redisError instanceof Error ? redisError.message : 'Redis connection failed',
      };
      errors.push('Redis connection failed');
      overallStatus = 'unhealthy';
    }

    // Check Qdrant connectivity (if configured)
    const qdrantHost = process.env.QDRANT_HOST;
    const qdrantPort = process.env.QDRANT_PORT || '6333';
    
    if (qdrantHost) {
      try {
        const qdrantUrl = `http://${qdrantHost}:${qdrantPort}/health`;
        const qdrantResponse = await fetch(qdrantUrl, {
          method: 'GET',
          timeout: 5000,
        });
        
        if (qdrantResponse.ok) {
          checks.qdrant = {
            status: 'healthy',
            message: 'Qdrant connection successful',
          };
        } else {
          checks.qdrant = {
            status: 'unhealthy',
            message: `Qdrant returned status ${qdrantResponse.status}`,
          };
          errors.push('Qdrant health check failed');
          overallStatus = 'unhealthy';
        }
      } catch (qdrantError) {
        checks.qdrant = {
          status: 'unhealthy',
          message: qdrantError instanceof Error ? qdrantError.message : 'Qdrant connection failed',
        };
        errors.push('Qdrant connection failed');
        overallStatus = 'unhealthy';
      }
    } else {
      checks.qdrant = {
        status: 'not_configured',
        message: 'Qdrant host not configured',
      };
    }

    // Check critical environment variables
    const requiredEnvVars = [
      'DATABASE_URL',
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL',
    ];

    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    checks.environment = {
      status: missingEnvVars.length === 0 ? 'healthy' : 'unhealthy',
      message: missingEnvVars.length === 0 
        ? 'All required environment variables are set'
        : `Missing environment variables: ${missingEnvVars.join(', ')}`,
      missingVariables: missingEnvVars,
    };

    if (missingEnvVars.length > 0) {
      errors.push(`Missing environment variables: ${missingEnvVars.join(', ')}`);
      overallStatus = 'unhealthy';
    }

    // Check system resources
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const memoryUsagePercent = Math.round((memoryUsedMB / memoryTotalMB) * 100);

    checks.system = {
      status: memoryUsagePercent < 90 ? 'healthy' : 'warning',
      message: `Memory usage: ${memoryUsedMB}MB/${memoryTotalMB}MB (${memoryUsagePercent}%)`,
      uptime: process.uptime(),
      nodeVersion: process.version,
    };

    const responseTime = Date.now() - startTime;

    const health = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime,
      service: 'c1-northstar-app',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks,
      errors: errors.length > 0 ? errors : undefined,
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 503;

    return NextResponse.json(health, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('Readiness check failed:', error);
    
    const health = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      service: 'c1-northstar-app',
      error: error instanceof Error ? error.message : 'Readiness check failed',
      checks,
    };

    return NextResponse.json(health, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  }
}