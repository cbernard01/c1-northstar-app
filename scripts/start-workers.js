#!/usr/bin/env node

/**
 * Worker process starter for C1 Northstar
 * Manages BullMQ job processors with proper scaling and monitoring
 */

const { Worker } = require('bullmq');
const { Redis } = require('ioredis');
const { PrismaClient } = require('@prisma/client');

// Configuration
const config = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  },
  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2'),
    maxStalledCount: 3,
    stalledInterval: 30000,
    maxFailedAttempts: 3,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

// Initialize connections
const redis = new Redis(config.redis);
const prisma = new PrismaClient();

// Worker instances
const workers = new Map();

// Graceful shutdown flag
let isShuttingDown = false;

/**
 * Logger utility
 */
const logger = {
  info: (message, ...args) => {
    if (['debug', 'info'].includes(config.logging.level)) {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
    }
  },
  warn: (message, ...args) => {
    if (['debug', 'info', 'warn'].includes(config.logging.level)) {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
    }
  },
  error: (message, ...args) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
  },
  debug: (message, ...args) => {
    if (config.logging.level === 'debug') {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
    }
  },
};

/**
 * Data import job processor
 */
const processDataImport = async (job) => {
  const { fileId, filePath, userId } = job.data;
  
  logger.info(`Processing data import job ${job.id}`, { fileId, filePath, userId });
  
  try {
    // Update job progress
    await job.updateProgress(10);
    
    // Simulate file processing (replace with actual implementation)
    // This would typically involve:
    // 1. Reading the file
    // 2. Parsing the data
    // 3. Validating records
    // 4. Importing to database
    // 5. Generating report
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing
    await job.updateProgress(50);
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate validation
    await job.updateProgress(80);
    
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate import
    await job.updateProgress(100);
    
    const result = {
      imported: 100,
      skipped: 5,
      errors: [],
      processedAt: new Date().toISOString(),
    };
    
    logger.info(`Data import job ${job.id} completed successfully`, result);
    return result;
    
  } catch (error) {
    logger.error(`Data import job ${job.id} failed`, error);
    throw error;
  }
};

/**
 * Lead scoring job processor
 */
const processLeadScoring = async (job) => {
  const { accountIds } = job.data;
  
  logger.info(`Processing lead scoring job ${job.id}`, { accountIds });
  
  try {
    const totalAccounts = accountIds.length;
    const scoredAccounts = [];
    
    for (let i = 0; i < totalAccounts; i++) {
      const accountId = accountIds[i];
      
      // Simulate lead scoring calculation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const score = Math.floor(Math.random() * 100);
      scoredAccounts.push({ accountId, score });
      
      // Update progress
      const progress = Math.floor(((i + 1) / totalAccounts) * 100);
      await job.updateProgress(progress);
    }
    
    const result = {
      scoredAccounts,
      totalProcessed: totalAccounts,
      processedAt: new Date().toISOString(),
    };
    
    logger.info(`Lead scoring job ${job.id} completed successfully`, result);
    return result;
    
  } catch (error) {
    logger.error(`Lead scoring job ${job.id} failed`, error);
    throw error;
  }
};

/**
 * Email sync job processor
 */
const processEmailSync = async (job) => {
  const { userId, lastSyncDate } = job.data;
  
  logger.info(`Processing email sync job ${job.id}`, { userId, lastSyncDate });
  
  try {
    // Simulate email synchronization
    await job.updateProgress(25);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await job.updateProgress(50);
    await new Promise(resolve => setTimeout(resolve, 800));
    
    await job.updateProgress(75);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await job.updateProgress(100);
    
    const result = {
      emailsSynced: 25,
      newEmails: 5,
      updatedEmails: 20,
      syncedAt: new Date().toISOString(),
    };
    
    logger.info(`Email sync job ${job.id} completed successfully`, result);
    return result;
    
  } catch (error) {
    logger.error(`Email sync job ${job.id} failed`, error);
    throw error;
  }
};

/**
 * Report generation job processor
 */
const processReportGeneration = async (job) => {
  const { reportType, userId, parameters } = job.data;
  
  logger.info(`Processing report generation job ${job.id}`, { reportType, userId });
  
  try {
    // Simulate report generation
    await job.updateProgress(20);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    await job.updateProgress(60);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await job.updateProgress(90);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await job.updateProgress(100);
    
    const result = {
      reportId: `report_${Date.now()}`,
      reportType,
      recordCount: 150,
      fileSize: 2048,
      generatedAt: new Date().toISOString(),
    };
    
    logger.info(`Report generation job ${job.id} completed successfully`, result);
    return result;
    
  } catch (error) {
    logger.error(`Report generation job ${job.id} failed`, error);
    throw error;
  }
};

/**
 * Data enrichment job processor
 */
const processDataEnrichment = async (job) => {
  const { accountIds, enrichmentType } = job.data;
  
  logger.info(`Processing data enrichment job ${job.id}`, { accountIds, enrichmentType });
  
  try {
    const totalAccounts = accountIds.length;
    const enrichedAccounts = [];
    
    for (let i = 0; i < totalAccounts; i++) {
      const accountId = accountIds[i];
      
      // Simulate data enrichment
      await new Promise(resolve => setTimeout(resolve, 200));
      
      enrichedAccounts.push({
        accountId,
        enrichedFields: ['industry', 'employeeCount', 'revenue'],
      });
      
      const progress = Math.floor(((i + 1) / totalAccounts) * 100);
      await job.updateProgress(progress);
    }
    
    const result = {
      enrichedAccounts,
      totalProcessed: totalAccounts,
      enrichmentType,
      processedAt: new Date().toISOString(),
    };
    
    logger.info(`Data enrichment job ${job.id} completed successfully`, result);
    return result;
    
  } catch (error) {
    logger.error(`Data enrichment job ${job.id} failed`, error);
    throw error;
  }
};

/**
 * Job processors map
 */
const processors = {
  'data_import': processDataImport,
  'lead_scoring': processLeadScoring,
  'email_sync': processEmailSync,
  'report_generation': processReportGeneration,
  'data_enrichment': processDataEnrichment,
};

/**
 * Create worker for a specific queue
 */
const createWorker = (queueName) => {
  const processor = processors[queueName];
  
  if (!processor) {
    logger.error(`No processor found for queue: ${queueName}`);
    return null;
  }
  
  const worker = new Worker(queueName, processor, {
    connection: config.redis,
    concurrency: config.worker.concurrency,
    maxStalledCount: config.worker.maxStalledCount,
    stalledInterval: config.worker.stalledInterval,
    settings: {
      retryProcessDelay: 5000,
    },
  });
  
  // Worker event handlers
  worker.on('ready', () => {
    logger.info(`Worker for queue '${queueName}' is ready`);
  });
  
  worker.on('active', (job) => {
    logger.debug(`Job ${job.id} started processing in queue '${queueName}'`);
  });
  
  worker.on('completed', (job, result) => {
    logger.info(`Job ${job.id} completed in queue '${queueName}'`, { 
      duration: Date.now() - job.processedOn,
      result: typeof result === 'object' ? Object.keys(result) : result 
    });
  });
  
  worker.on('failed', (job, error) => {
    logger.error(`Job ${job?.id} failed in queue '${queueName}'`, {
      error: error.message,
      attempts: job?.attemptsMade,
      maxAttempts: config.worker.maxFailedAttempts,
    });
  });
  
  worker.on('stalled', (jobId) => {
    logger.warn(`Job ${jobId} stalled in queue '${queueName}'`);
  });
  
  worker.on('error', (error) => {
    logger.error(`Worker error in queue '${queueName}'`, error);
  });
  
  return worker;
};

/**
 * Initialize all workers
 */
const initializeWorkers = async () => {
  logger.info('Initializing job workers...');
  
  // Create workers for each queue
  for (const queueName of Object.keys(processors)) {
    const worker = createWorker(queueName);
    if (worker) {
      workers.set(queueName, worker);
      logger.info(`Worker created for queue: ${queueName}`);
    }
  }
  
  logger.info(`${workers.size} workers initialized successfully`);
};

/**
 * Health check endpoint (for monitoring)
 */
const checkHealth = async () => {
  try {
    // Check Redis connection
    await redis.ping();
    
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Check worker status
    const workerStatus = {};
    for (const [queueName, worker] of workers) {
      workerStatus[queueName] = worker.isRunning() ? 'running' : 'stopped';
    }
    
    return {
      status: 'healthy',
      redis: 'connected',
      database: 'connected',
      workers: workerStatus,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Graceful shutdown
 */
const gracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress...');
    return;
  }
  
  isShuttingDown = true;
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  try {
    // Close all workers
    const shutdownPromises = [];
    for (const [queueName, worker] of workers) {
      logger.info(`Closing worker for queue: ${queueName}`);
      shutdownPromises.push(worker.close());
    }
    
    await Promise.all(shutdownPromises);
    logger.info('All workers closed successfully');
    
    // Close Redis connection
    await redis.quit();
    logger.info('Redis connection closed');
    
    // Close Prisma connection
    await prisma.$disconnect();
    logger.info('Database connection closed');
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
    
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
};

/**
 * Monitor workers periodically
 */
const monitorWorkers = () => {
  setInterval(async () => {
    if (isShuttingDown) return;
    
    try {
      const health = await checkHealth();
      
      if (health.status === 'unhealthy') {
        logger.error('Health check failed', health);
      } else {
        logger.debug('Health check passed', health);
      }
      
      // Log worker statistics
      for (const [queueName, worker] of workers) {
        if (worker.isRunning()) {
          logger.debug(`Worker ${queueName} is running, processing: ${worker.processing.size}`);
        } else {
          logger.warn(`Worker ${queueName} is not running`);
        }
      }
    } catch (error) {
      logger.error('Monitor check failed', error);
    }
  }, 30000); // Check every 30 seconds
};

/**
 * Main function
 */
const main = async () => {
  logger.info('Starting C1 Northstar job workers...');
  logger.info('Configuration:', {
    redis: { host: config.redis.host, port: config.redis.port },
    worker: config.worker,
    logging: config.logging,
  });
  
  try {
    // Test connections
    await redis.ping();
    logger.info('Redis connection established');
    
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection established');
    
    // Initialize workers
    await initializeWorkers();
    
    // Start monitoring
    monitorWorkers();
    
    logger.info('All workers started successfully. Waiting for jobs...');
    
    // Keep the process running
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon
    
  } catch (error) {
    logger.error('Failed to start workers', error);
    process.exit(1);
  }
};

// Start the workers
if (require.main === module) {
  main().catch((error) => {
    logger.error('Unhandled error in main process', error);
    process.exit(1);
  });
}

module.exports = {
  main,
  checkHealth,
  processors,
};