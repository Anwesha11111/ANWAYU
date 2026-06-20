import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const isProduction = process.env.NODE_ENV === 'production';

  logger.error('Unhandled error', {
    statusCode,
    message: err.message,
    code: err.code,
    path: req.path,
    method: req.method,
    stack: isProduction ? undefined : err.stack,
  });

  res.status(statusCode).json({
    success: false,
    error: err.code ?? 'INTERNAL_SERVER_ERROR',
    message: isProduction && statusCode === 500
      ? 'An unexpected error occurred. Our team has been notified.'
      : err.message,
    timestamp: new Date().toISOString(),
    ...(isProduction ? {} : { stack: err.stack }),
  });
}

export function createError(message: string, statusCode: number, code?: string): AppError {
  const err = new Error(message) as AppError;
  err.statusCode    = statusCode;
  err.code          = code;
  err.isOperational = true;
  return err;
}
