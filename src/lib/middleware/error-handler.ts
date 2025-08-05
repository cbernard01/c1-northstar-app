import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

// Custom error types
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details?: any) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

// Error response interface
interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: any;
  timestamp: string;
  requestId?: string;
}

// Error handling middleware
export function withErrorHandler(
  handler: (req: NextRequest) => Promise<NextResponse | Response> | NextResponse | Response
) {
  return async (req: NextRequest) => {
    try {
      return await handler(req);
    } catch (error) {
      return handleError(error, req);
    }
  };
}

// Central error handler
export function handleError(error: unknown, req?: NextRequest): NextResponse {
  console.error('API Error:', error);

  // Generate request ID for tracing
  const requestId = req ? `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : undefined;

  let statusCode = 500;
  let message = 'Internal Server Error';
  let code = 'INTERNAL_ERROR';
  let details: any = undefined;

  if (error instanceof AppError) {
    // Custom application errors
    statusCode = error.statusCode;
    message = error.message;
    code = error.code || 'APP_ERROR';
    if (error instanceof ValidationError) {
      details = error.details;
    }
  } else if (error instanceof ZodError) {
    // Zod validation errors
    statusCode = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    details = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Prisma database errors
    switch (error.code) {
      case 'P2002':
        statusCode = 409;
        message = 'A record with this data already exists';
        code = 'DUPLICATE_RECORD';
        details = { field: error.meta?.target };
        break;
      case 'P2025':
        statusCode = 404;
        message = 'Record not found';
        code = 'RECORD_NOT_FOUND';
        break;
      case 'P2003':
        statusCode = 400;
        message = 'Foreign key constraint failed';
        code = 'CONSTRAINT_VIOLATION';
        break;
      case 'P2021':
        statusCode = 500;
        message = 'Database table does not exist';
        code = 'TABLE_NOT_FOUND';
        break;
      default:
        statusCode = 500;
        message = 'Database error';
        code = 'DATABASE_ERROR';
        details = { code: error.code };
    }
  } else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    statusCode = 500;
    message = 'Unknown database error';
    code = 'DATABASE_UNKNOWN_ERROR';
  } else if (error instanceof Prisma.PrismaClientRustPanicError) {
    statusCode = 500;
    message = 'Database connection error';
    code = 'DATABASE_CONNECTION_ERROR';
  } else if (error instanceof Prisma.PrismaClientInitializationError) {
    statusCode = 500;
    message = 'Database initialization error';
    code = 'DATABASE_INIT_ERROR';
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid query parameters';
    code = 'QUERY_VALIDATION_ERROR';
  } else if (error instanceof Error) {
    // Generic errors
    message = error.message;
    
    // Check for specific error patterns
    if (error.message.includes('ENOENT')) {
      statusCode = 404;
      message = 'File not found';
      code = 'FILE_NOT_FOUND';
    } else if (error.message.includes('EACCES')) {
      statusCode = 403;
      message = 'Permission denied';
      code = 'PERMISSION_DENIED';
    } else if (error.message.includes('EMFILE') || error.message.includes('ENFILE')) {
      statusCode = 503;
      message = 'Too many files open';
      code = 'FILE_LIMIT_EXCEEDED';
    }
  }

  const errorResponse: ErrorResponse = {
    error: getErrorTitle(statusCode),
    message,
    code,
    timestamp: new Date().toISOString(),
    ...(details && { details }),
    ...(requestId && { requestId }),
  };

  // Add additional context in development
  if (process.env.NODE_ENV === 'development' && error instanceof Error) {
    (errorResponse as any).stack = error.stack;
  }

  return NextResponse.json(errorResponse, { status: statusCode });
}

// Get error title from status code
function getErrorTitle(statusCode: number): string {
  switch (statusCode) {
    case 400: return 'Bad Request';
    case 401: return 'Unauthorized';
    case 403: return 'Forbidden';
    case 404: return 'Not Found';
    case 409: return 'Conflict';
    case 422: return 'Unprocessable Entity';
    case 429: return 'Too Many Requests';
    case 500: return 'Internal Server Error';
    case 503: return 'Service Unavailable';
    default: return 'Error';
  }
}

// Async error wrapper for route handlers
export function asyncHandler(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: any) => {
    try {
      return await handler(req, context);
    } catch (error) {
      return handleError(error, req);
    }
  };
}

// Validation error helper
export function createValidationError(message: string, details?: any): ValidationError {
  return new ValidationError(message, details);
}

// Database error helpers
export function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export function isNotFoundError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}