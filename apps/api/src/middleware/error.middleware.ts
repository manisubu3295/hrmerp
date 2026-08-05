import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { logger } from '../lib/logger';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  logger.error({ err }, 'Unhandled request error');

  let status = 500;
  let message = 'Internal server error';
  let errors: Record<string, string[]> | undefined;

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      status = 409;
      message = `Duplicate entry: ${String(err.meta?.['target'])} already exists`;
    } else if (err.code === 'P2025') {
      status = 404;
      message = 'Record not found';
    }
  } else if (err instanceof AppError) {
    status = err.status;
    message = err.message;
  } else if (err instanceof Error) {
    message = process.env['NODE_ENV'] === 'production' ? 'Internal server error' : err.message;
  }

  res.status(status).json({
    success: false,
    message,
    errors,
    timestamp: new Date().toISOString(),
    path: req.url,
  });
}

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ success: false, message: 'Route not found' });
}
