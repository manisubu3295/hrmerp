import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { requireRoles } from '../middleware/auth.middleware';
import { UserRole } from '@sankoerp/shared';

const router = Router();

// ─── GET /calendar/events ────────────────────────────────────────────────────
// Returns holidays in a date range
router.get('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query as Record<string, string>;
    if (!startDate || !endDate) throw new AppError(400, 'startDate and endDate are required');

    const holidays = await (prisma as any).holiday.findMany({
      where: {
        date: { gte: new Date(startDate), lte: new Date(endDate) },
      },
      orderBy: { date: 'asc' },
    });

    res.json({ success: true, data: holidays });
  } catch (e) { next(e); }
});

// ─── GET /calendar/all ────────────────────────────────────────────────────────
// Returns all holidays (no date filter) — admin
router.get('/all', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const holidays = await (prisma as any).holiday.findMany({
      orderBy: { date: 'asc' },
    });
    res.json({ success: true, data: holidays });
  } catch (e) { next(e); }
});

// ─── GET /calendar/year/:year ─────────────────────────────────────────────────
// Returns all holidays for a given calendar year
router.get('/year/:year', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const year = Number(req.params['year']);
    if (isNaN(year)) throw new AppError(400, 'Invalid year');

    const holidays = await (prisma as any).holiday.findMany({
      where: {
        date: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      },
      orderBy: { date: 'asc' },
    });

    res.json({ success: true, data: holidays });
  } catch (e) { next(e); }
});

// ─── POST /calendar/events ────────────────────────────────────────────────────
router.post('/events', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, date, type, description, isRecurring, country } = req.body;
    if (!name || !date) throw new AppError(400, 'name and date are required');

    const holiday = await (prisma as any).holiday.create({
      data: {
        name,
        date: new Date(date),
        type: type ?? 'PUBLIC_HOLIDAY',
        description: description ?? null,
        isRecurring: isRecurring ?? false,
        country: country ?? 'SG',
      },
    });

    res.status(201).json({ success: true, data: holiday });
  } catch (e) { next(e); }
});

// ─── PATCH /calendar/events/:id ───────────────────────────────────────────────
router.patch('/events/:id', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await (prisma as any).holiday.findUnique({ where: { id: req.params['id'] } });
    if (!existing) throw new AppError(404, 'Event not found');

    const { name, date, type, description, isRecurring, country } = req.body;

    const updated = await (prisma as any).holiday.update({
      where: { id: req.params['id'] },
      data: {
        ...(name !== undefined && { name }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description }),
        ...(isRecurring !== undefined && { isRecurring }),
        ...(country !== undefined && { country }),
      },
    });

    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// ─── DELETE /calendar/events/:id ──────────────────────────────────────────────
router.delete('/events/:id', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await (prisma as any).holiday.findUnique({ where: { id: req.params['id'] } });
    if (!existing) throw new AppError(404, 'Event not found');

    await (prisma as any).holiday.delete({ where: { id: req.params['id'] } });
    res.json({ success: true, message: 'Event deleted' });
  } catch (e) { next(e); }
});

export default router;
