/**
 * Workers - Background Job Processing
 * Central export for all background workers in the C1 Northstar platform
 */

// Import Workers
export {
  ImportWorker,
  getImportWorker,
  startImportWorker,
} from './import-worker';

// File Processing Worker (existing)
export * from './file-processor-worker';

import { logger } from '@/lib/logger';
import { getImportWorker } from './import-worker';

/**
 * Start all workers
 */
export async function startAllWorkers() {
  const workers = [];
  
  try {
    // Start import worker
    const importWorker = getImportWorker();
    workers.push(importWorker);
    
    logger.info('Workers: All workers started successfully', {
      workerCount: workers.length,
      workers: workers.map(w => w.getWorkerStatus?.() || 'Unknown'),
    });
    
    return workers;
    
  } catch (error) {
    logger.error('Workers: Failed to start workers', { error });
    throw error;
  }
}

/**
 * Stop all workers gracefully
 */
export async function stopAllWorkers() {
  const workers = [
    getImportWorker(),
  ];
  
  logger.info('Workers: Stopping all workers...');
  
  const shutdownPromises = workers.map(async (worker) => {
    try {
      await worker.close?.();
    } catch (error) {
      logger.error('Workers: Error stopping worker', { error });
    }
  });
  
  await Promise.all(shutdownPromises);
  logger.info('Workers: All workers stopped');
}

/**
 * Get status of all workers
 */
export function getWorkersStatus() {
  const workers = [
    getImportWorker(),
  ];
  
  return {
    timestamp: new Date().toISOString(),
    workers: workers.map(worker => ({
      ...worker.getWorkerStatus?.(),
      healthy: !worker.worker?.closing,
    })),
  };
}

// Graceful shutdown handling
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    logger.info('Workers: Received SIGINT, shutting down gracefully...');
    await stopAllWorkers();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    logger.info('Workers: Received SIGTERM, shutting down gracefully...');
    await stopAllWorkers();
    process.exit(0);
  });
}