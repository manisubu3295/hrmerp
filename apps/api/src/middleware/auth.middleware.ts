import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  organizationId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      userPermissions?: Set<string>;
    }
  }
}

const PUBLIC_ROUTES: Array<{ method: string; path: RegExp }> = [
  { method: 'POST', path: /^\/api\/v1\/auth\/login$/ },
  { method: 'POST', path: /^\/api\/v1\/auth\/refresh$/ },
  { method: 'POST', path: /^\/api\/v1\/auth\/logout$/ },
  { method: 'POST', path: /^\/api\/v1\/auth\/vendor\/login$/ },
  { method: 'POST', path: /^\/api\/v1\/auth\/client\/login$/ },
  { method: 'GET', path: /^\/api\/v1\/auth\/sso\/[^/]+\/login$/ },
  { method: 'GET', path: /^\/api\/v1\/auth\/sso\/[^/]+\/callback$/ },
  { method: 'POST', path: /^\/api\/v1\/auth\/forgot-password$/ },
  { method: 'POST', path: /^\/api\/v1\/auth\/reset-password\/[^/]+$/ },
  { method: 'GET', path: /^\/api\/v1\/quotations\/portal\/[^/]+$/ },
  { method: 'POST', path: /^\/api\/v1\/quotations\/portal\/[^/]+\/(approve|reject)$/ },
  { method: 'GET', path: /^\/health$/ },
];

export function jwtMiddleware(req: Request, res: Response, next: NextFunction): void {
  const isPublic = PUBLIC_ROUTES.some(
    (r) => r.method === req.method && r.path.test(req.path),
  );
  if (isPublic) return next();

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    res.status(500).json({ success: false, message: 'Server configuration error' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;

    // Async validate user is still active. Also fetches organizationId here
    // (one query) so tenant.middleware doesn't need a second lookup.
    prisma.user
      .findUnique({ where: { id: payload.sub }, select: { id: true, email: true, role: true, isActive: true, organizationId: true } })
      .then((user) => {
        if (!user || !user.isActive) {
          res.status(401).json({ success: false, message: 'User not found or inactive' });
          return;
        }
        req.user = { sub: user.id, email: user.email, role: user.role, organizationId: user.organizationId };
        next();
      })
      .catch(() => {
        res.status(500).json({ success: false, message: 'Internal server error' });
      });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

/**
 * Fetches the caller's effective permission set via
 * UserRoleAssignment -> Role -> RolePermission -> Permission.
 * Superseded requireRoles as the real RBAC mechanism — see lib/permissions.ts
 * for the catalog and the seed matrix that reproduces the old role gating.
 */
export async function getUserPermissions(userId: string): Promise<Set<string>> {
  const assignments = await prisma.userRoleAssignment.findMany({
    where: { userId },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });
  const perms = new Set<string>();
  for (const a of assignments) {
    for (const rp of a.role.rolePermissions) {
      perms.add(`${rp.permission.resource}:${rp.permission.action}`);
    }
  }
  return perms;
}

export function requirePermission(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const check = (perms: Set<string>): void => {
      if (!permissions.some((p) => perms.has(p))) {
        res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
        return;
      }
      next();
    };

    if (req.userPermissions) {
      check(req.userPermissions);
      return;
    }

    getUserPermissions(req.user.sub)
      .then((perms) => {
        req.userPermissions = perms;
        check(perms);
      })
      .catch((e) => next(e));
  };
}
