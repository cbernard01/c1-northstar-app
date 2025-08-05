import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

/**
 * Database connectivity health check
 * Tests connection to PostgreSQL database
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Test database connection with a simple query
    const result = await prisma.$queryRaw`SELECT 1 as health_check`;
    const responseTime = Date.now() - startTime;

    // Additional database metrics
    const dbMetrics = await prisma.$queryRaw`
      SELECT 
        count(*) as connection_count
      FROM pg_stat_activity 
      WHERE state = 'active'
    ` as any[];

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'database',
      database: 'postgresql',
      responseTime,
      checks: {
        connection: 'healthy',
        query: result ? 'healthy' : 'unhealthy',
        activeConnections: dbMetrics[0]?.connection_count || 0,
      },
      metadata: {
        databaseUrl: process.env.DATABASE_URL?.replace(/:[^:]*@/, ':***@') || 'not configured',
      },
    };

    return NextResponse.json(health, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    
    const health = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'database',
      database: 'postgresql',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Database connection failed',
      checks: {
        connection: 'unhealthy',
        query: 'failed',
      },
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