/**
 * Structured logging configuration for C1 Northstar
 * Provides consistent logging across the application with proper formatting
 */

export interface LogContext {
  userId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  error?: Error | string;
  [key: string]: any;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private logLevel: LogLevel;
  private environment: string;

  constructor() {
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
    this.environment = process.env.NODE_ENV || 'development';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    return requestedLevelIndex >= currentLevelIndex;
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      environment: this.environment,
      service: 'c1-northstar-app',
      ...context,
    };

    // In development, format nicely for console
    if (this.environment === 'development') {
      const contextStr = context ? ` - ${JSON.stringify(context, null, 2)}` : '';
      return `[${level.toUpperCase()}] ${timestamp} - ${message}${contextStr}`;
    }

    // In production, use structured JSON
    return JSON.stringify(logEntry);
  }

  debug(message: string, context?: LogContext) {
    if (this.shouldLog('debug')) {
      console.log(this.formatLog('debug', message, context));
    }
  }

  info(message: string, context?: LogContext) {
    if (this.shouldLog('info')) {
      console.log(this.formatLog('info', message, context));
    }
  }

  warn(message: string, context?: LogContext) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatLog('warn', message, context));
    }
  }

  error(message: string, context?: LogContext) {
    if (this.shouldLog('error')) {
      console.error(this.formatLog('error', message, context));
    }
  }

  // HTTP request logging
  logRequest(method: string, url: string, statusCode: number, duration: number, context?: LogContext) {
    const level = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'info';
    
    this[level](`${method} ${url} ${statusCode}`, {
      method,
      url,
      statusCode,
      duration,
      ...context,
    });
  }

  // Database operation logging
  logDatabase(operation: string, table: string, duration: number, context?: LogContext) {
    this.debug(`Database ${operation} on ${table}`, {
      operation,
      table,
      duration,
      type: 'database',
      ...context,
    });
  }

  // Job processing logging
  logJob(jobId: string, jobType: string, status: 'started' | 'completed' | 'failed', context?: LogContext) {
    const level = status === 'failed' ? 'error' : 'info';
    
    this[level](`Job ${jobId} (${jobType}) ${status}`, {
      jobId,
      jobType,
      status,
      type: 'job',
      ...context,
    });
  }

  // Authentication logging
  logAuth(event: 'login' | 'logout' | 'failed_login', userId?: string, context?: LogContext) {
    const level = event === 'failed_login' ? 'warn' : 'info';
    
    this[level](`Authentication ${event}`, {
      event,
      userId,
      type: 'auth',
      ...context,
    });
  }

  // Security event logging
  logSecurity(event: string, severity: 'low' | 'medium' | 'high' | 'critical', context?: LogContext) {
    const level = severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'info';
    
    this[level](`Security event: ${event}`, {
      event,
      severity,
      type: 'security',
      ...context,
    });
  }

  // Performance logging
  logPerformance(metric: string, value: number, unit: string, context?: LogContext) {
    this.debug(`Performance metric: ${metric} = ${value}${unit}`, {
      metric,
      value,
      unit,
      type: 'performance',
      ...context,
    });
  }
}

// Export singleton instance
export const logger = new Logger();

// Express middleware for request logging
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || `req_${Math.random().toString(36).substr(2, 9)}`;
  
  // Add request ID to request object
  req.requestId = requestId;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const context: LogContext = {
      requestId,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
    };
    
    logger.logRequest(req.method, req.originalUrl, res.statusCode, duration, context);
  });
  
  next();
};

// Error logging helper
export const logError = (error: Error, context?: LogContext) => {
  logger.error(error.message, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  });
};

// Async error wrapper
export const withErrorLogging = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: LogContext
): T => {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(error as Error, context);
      throw error;
    }
  }) as T;
};

export default logger;