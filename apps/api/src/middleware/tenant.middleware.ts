import { Request, Response, NextFunction } from 'express';
import { runWithTenantContext, TenantContext } from '../lib/tenant-context';

declare global {
  namespace Express {
    interface Request {
      organizationId?: string | null;
      persona?: TenantContext['persona'];
    }
  }
}

/**
 * Establishes tenant context for the rest of the request pipeline, sourced
 * from req.user (already populated by jwtMiddleware — no extra DB lookup).
 * Must run AFTER jwtMiddleware. Public/unauthenticated routes pass through
 * with no context; any tenant-scoped Prisma query reached without one will
 * throw (see lib/prisma.ts) — fail closed, not open.
 *
 * Persona is derived from role rather than a separate table: EMPLOYEE-role
 * users are the "Employee self-service" persona, everyone else (ADMIN/
 * MANAGER/SUPERVISOR/SUPER_ADMIN) is "Employer". Vendor/Client personas
 * authenticate through their own login endpoints (see auth.routes.ts) and
 * carry their persona directly in their JWT.
 */
export function tenantMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user || !req.user.organizationId) {
    next();
    return;
  }

  const persona: TenantContext['persona'] = req.user.role === 'EMPLOYEE' ? 'EMPLOYEE' : 'EMPLOYER';
  req.organizationId = req.user.organizationId;
  req.persona = persona;

  runWithTenantContext({ organizationId: req.user.organizationId, userId: req.user.sub, persona }, () => next());
}
