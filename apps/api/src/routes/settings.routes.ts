import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { requireRoles } from '../middleware/auth.middleware';
import { UserRole } from '@sankoerp/shared';

const router = Router();

// GET /settings — returns the single organisation record (creates a default if none exists)
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    let org = await prisma.organization.findFirst();
    if (!org) {
      org = await prisma.organization.create({
        data: { name: 'My Company', code: 'DEFAULT' },
      });
    }
    res.json({ success: true, data: org });
  } catch (e) {
    next(e);
  }
});

// PATCH /settings — update organisation details (admin only)
router.patch(
  '/',
  requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, uen, gstNo, email, phone, address } = req.body as Record<string, string | undefined>;

      let org = await prisma.organization.findFirst();
      if (!org) {
        const code = (name ?? 'DEFAULT').toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 20);
        org = await prisma.organization.create({
          data: { name: name ?? 'My Company', code },
        });
      }

      org = await prisma.organization.update({
        where: { id: org.id },
        data: {
          ...(name !== undefined && { name }),
          ...(uen !== undefined && { uen }),
          ...(gstNo !== undefined && { gstNo }),
          ...(email !== undefined && { email }),
          ...(phone !== undefined && { phone }),
          ...(address !== undefined && { address }),
        },
      });

      res.json({ success: true, data: org });
    } catch (e) {
      next(e);
    }
  },
);

export default router;
