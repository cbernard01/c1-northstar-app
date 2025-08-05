import { NextRequest, NextResponse } from 'next/server';

import { checkRedisHealth, redis } from '@/lib/redis';

/**
 * Redis connectivity health check
 * Tests connection to Redis cache and job queue
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Test Redis connection
    const isHealthy = await checkRedisHealth();
    const responseTime = Date.now() - startTime;

    if (!isHealthy) {
      throw new Error('Redis ping failed');
    }

    // Get Redis info
    const redisInfo = await redis.info('server');
    const redisMemory = await redis.info('memory');
    const redisStats = await redis.info('stats');

    // Parse Redis version from info
    const versionMatch = redisInfo.match(/redis_version:([^\r\n]+)/);
    const version = versionMatch ? versionMatch[1] : 'unknown';

    // Parse memory usage
    const memoryMatch = redisMemory.match(/used_memory_human:([^\r\n]+)/);
    const memoryUsed = memoryMatch ? memoryMatch[1] : 'unknown';

    // Parse total connections
    const connectionsMatch = redisStats.match(/total_connections_received:([^\r\n]+)/);
    const totalConnections = connectionsMatch ? parseInt(connectionsMatch[1]) : 0;

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'redis',
      responseTime,
      checks: {
        connection: 'healthy',
        ping: 'healthy',
      },
      metadata: {
        version,
        memoryUsed,
        totalConnections,
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || '6379',
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
    console.error('Redis health check failed:', error);
    
    const health = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'redis',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Redis connection failed',
      checks: {
        connection: 'unhealthy',
        ping: 'failed',
      },
      metadata: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || '6379',
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