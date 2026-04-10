import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

const PUBLIC_ROUTES: Array<{ method: string; path: RegExp }> = [
  { method: 'POST', path: /^\/api\/v1\/auth\/login$/ },
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

    // Async validate user is still active
    prisma.user
      .findUnique({ where: { id: payload.sub }, select: { id: true, email: true, role: true, isActive: true } })
      .then((user) => {
        if (!user || !user.isActive) {
          res.status(401).json({ success: false, message: 'User not found or inactive' });
          return;
        }
        req.user = { sub: user.id, email: user.email, role: user.role };
        next();
      })
      .catch(() => {
        res.status(500).json({ success: false, message: 'Internal server error' });
      });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

export function requireRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
      return;
    }
    next();
  };
}
