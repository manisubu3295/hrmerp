import { Request, Response, NextFunction } from 'express';
import { writeAuditLog } from '../lib/audit';

const AUDITED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Audit middleware — automatically logs all write operations.
 * Must be placed AFTER jwtMiddleware so req.user is available.
 * Logs are written asynchronously and do not block the response.
 */
export function auditMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (!AUDITED_METHODS.has(req.method)) {
    next();
    return;
  }

  // Parse entity from URL path: /api/v1/ENTITY/...
  const segments = req.path.split('/').filter(Boolean);
  // segments: ['api', 'v1', 'employees', ...]
  // but this middleware is applied after prefix — path may be /employees/:id
  const entity = segments[0] ?? 'unknown';
  const entityId = segments[1] ?? undefined;

  // Fire-and-forget audit write — don't await
  void writeAuditLog({
    userId: req.user?.sub ?? null,
    action: req.method,
    entity,
    entityId: entityId !== undefined ? entityId : null,
    newValues: req.body && typeof req.body === 'object' ? req.body : null,
    ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  });

  next();
}
