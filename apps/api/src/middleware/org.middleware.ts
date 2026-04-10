import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

declare global {
  namespace Express {
    interface Request {
      organizationId?: string | null;
    }
  }
}

/**
 * Attaches req.organizationId from the authenticated user's organization.
 * Must be placed AFTER jwtMiddleware.
 *
 * NOTE: Full multi-tenancy enforcement (filtering by orgId on Employees, Projects, etc.)
 * requires adding organizationId to those Prisma models via migration.
 * This middleware sets the context so routes can use it once models are updated.
 */
export function orgContext(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next();
    return;
  }

  prisma.user
    .findUnique({
      where: { id: req.user.sub },
      select: { organizationId: true },
    })
    .then((user) => {
      req.organizationId = user?.organizationId ?? null;
      next();
    })
    .catch(() => next());
}
