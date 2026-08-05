import { Router, Request, Response, NextFunction } from 'express';
import prisma, { prismaUnscoped } from '../lib/prisma';
import { parsePagination, buildPaginationMeta } from '../lib/pagination';
import { AppError } from '../middleware/error.middleware';
import { requirePermission } from '../middleware/auth.middleware';
import { WorkPassStatus, WORK_PASS_ALERT_DAYS } from '@sankoerp/shared';
import { Prisma } from '@prisma/client';
import { emitEvent } from '../lib/events';

const router = Router();

// GET /compliance/work-passes
router.get('/work-passes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query as Record<string, unknown>);
    const { search, status, employeeId } = req.query as unknown as Record<string, string | undefined>;

    const where: Prisma.WorkPassWhereInput = {
      ...(status && { status: status as WorkPassStatus }),
      ...(employeeId && { employeeId }),
      ...(search && {
        OR: [
          { passNumber: { contains: search, mode: 'insensitive' } },
          { employee: { firstName: { contains: search, mode: 'insensitive' } } },
          { employee: { lastName: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [passes, total] = await Promise.all([
      prisma.workPass.findMany({
        where, skip, take,
        include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, nationality: true } } },
        orderBy: { expiryDate: 'asc' },
      }),
      prisma.workPass.count({ where }),
    ]);

    const today = new Date();
    const enriched = passes.map((p) => ({
      ...p,
      daysToExpiry: Math.ceil((p.expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    }));

    res.json({ success: true, data: { data: enriched, meta: buildPaginationMeta(total, page, limit) } });
  } catch (e) { next(e); }
});

// POST /compliance/work-passes
router.post('/work-passes', requirePermission('compliance:create'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = req.body;
    const employee = await prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee) throw new AppError(404, 'Employee not found');

    const existing = await prisma.workPass.findFirst({
      where: { employeeId: dto.employeeId, status: { in: ['ACTIVE', 'EXPIRING_SOON'] } },
    });
    if (existing) throw new AppError(400, 'Employee already has an active work pass');

    const pass = await prisma.workPass.create({
      data: {
        organizationId: req.organizationId as string,
        employeeId: dto.employeeId, passType: dto.passType, passNumber: dto.passNumber,
        issueDate: new Date(dto.issueDate), expiryDate: new Date(dto.expiryDate),
        documentUrl: dto.documentUrl, status: 'ACTIVE',
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
    });
    res.status(201).json({ success: true, data: pass });
  } catch (e) { next(e); }
});

// GET /compliance/dashboard
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in15Days = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000);
    const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [active, expiring30, expiring15, expiring7, expired] = await Promise.all([
      prisma.workPass.count({ where: { status: 'ACTIVE', expiryDate: { gt: in30Days } } }),
      prisma.workPass.count({ where: { status: { in: ['ACTIVE', 'EXPIRING_SOON'] }, expiryDate: { lte: in30Days, gt: in15Days } } }),
      prisma.workPass.count({ where: { status: { in: ['ACTIVE', 'EXPIRING_SOON'] }, expiryDate: { lte: in15Days, gt: in7Days } } }),
      prisma.workPass.count({ where: { status: { in: ['ACTIVE', 'EXPIRING_SOON'] }, expiryDate: { lte: in7Days, gt: today } } }),
      prisma.workPass.count({ where: { status: 'EXPIRED' } }),
    ]);

    const criticalPasses = await prisma.workPass.findMany({
      where: { status: { in: ['ACTIVE', 'EXPIRING_SOON'] }, expiryDate: { lte: in7Days } },
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
      orderBy: { expiryDate: 'asc' },
    });

    res.json({
      success: true,
      data: {
        summary: { active, expiring30, expiring15, expiring7, expired },
        criticalPasses: criticalPasses.map((p) => ({
          ...p,
          daysToExpiry: Math.ceil((p.expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
        })),
      },
    });
  } catch (e) { next(e); }
});

// GET /compliance/work-passes/:id
router.get('/work-passes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pass = await prisma.workPass.findUnique({
      where: { id: req.params['id'] },
      include: { employee: true, renewalHistory: { orderBy: { renewedAt: 'desc' } } },
    });
    if (!pass) throw new AppError(404, `Work pass ${req.params['id']} not found`);
    const daysToExpiry = Math.ceil((pass.expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    res.json({ success: true, data: { ...pass, daysToExpiry } });
  } catch (e) { next(e); }
});

// PATCH /compliance/work-passes/:id/renew
router.patch('/work-passes/:id/renew', requirePermission('compliance:renew'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']!;
    const pass = await prisma.workPass.findUnique({ where: { id } });
    if (!pass) throw new AppError(404, `Work pass ${id} not found`);

    const dto = req.body as { newPassNumber: string; newExpiryDate: string; documentUrl?: string; notes?: string };

    await prisma.workPassRenewal.create({
      data: {
        organizationId: req.organizationId as string,
        workPassId: id,
        oldPassNumber: pass.passNumber,
        oldExpiryDate: pass.expiryDate,
        newPassNumber: dto.newPassNumber,
        newExpiryDate: new Date(dto.newExpiryDate),
        documentUrl: dto.documentUrl,
        notes: dto.notes,
      },
    });

    const updated = await prisma.workPass.update({
      where: { id },
      data: {
        passNumber: dto.newPassNumber,
        expiryDate: new Date(dto.newExpiryDate),
        documentUrl: dto.documentUrl,
        status: 'ACTIVE',
      },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// PATCH /compliance/work-passes/:id/cancel
router.patch('/work-passes/:id/cancel', requirePermission('compliance:cancel'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.workPass.findUnique({ where: { id: req.params['id'] } });
    if (!existing) throw new AppError(404, `Work pass ${req.params['id']} not found`);
    const { reason } = req.body as { reason?: string };
    const updated = await prisma.workPass.update({
      where: { id: req.params['id'] },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// GET /compliance/employees/:employeeId/can-deploy
router.get('/employees/:employeeId/can-deploy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activePass = await prisma.workPass.findFirst({
      where: { employeeId: req.params['employeeId'], status: { in: ['ACTIVE', 'EXPIRING_SOON'] } },
    });
    if (!activePass) {
      res.json({ success: true, data: { canDeploy: false, reason: 'No active work pass found' } });
      return;
    }
    if (activePass.status === 'EXPIRED') {
      res.json({ success: true, data: { canDeploy: false, reason: 'Work pass has expired' } });
      return;
    }
    res.json({ success: true, data: { canDeploy: true } });
  } catch (e) { next(e); }
});

// Exported for cron job
// Cross-tenant system job (cron-triggered, not a request) — uses prismaUnscoped
// deliberately, see lib/prisma.ts.
export async function checkWorkPassExpiries() {
  const today = new Date();
  const alertDays = [WORK_PASS_ALERT_DAYS.CRITICAL, WORK_PASS_ALERT_DAYS.URGENT, WORK_PASS_ALERT_DAYS.WARNING];

  for (const days of alertDays) {
    const targetDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    const startOfDay = new Date(new Date(targetDate).setHours(0, 0, 0, 0));
    const endOfDay = new Date(new Date(targetDate).setHours(23, 59, 59, 999));

    const expiringPasses = await prismaUnscoped.workPass.findMany({
      where: {
        status: { in: ['ACTIVE', 'EXPIRING_SOON'] },
        expiryDate: { gte: startOfDay, lte: endOfDay },
      },
      include: { employee: true },
    });

    for (const pass of expiringPasses) {
      if (days <= WORK_PASS_ALERT_DAYS.URGENT) {
        await prismaUnscoped.workPass.update({ where: { id: pass.id }, data: { status: 'EXPIRING_SOON' } });
      }
      emitEvent('workpass.expiring', {
        organizationId: pass.organizationId,
        workPassId: pass.id,
        employeeId: pass.employeeId,
        employeeName: `${pass.employee.firstName} ${pass.employee.lastName}`,
        daysToExpiry: days,
        expiryDate: pass.expiryDate,
        passType: pass.passType,
      });
    }
  }

  // Mark expired passes
  await prismaUnscoped.workPass.updateMany({
    where: { status: { in: ['ACTIVE', 'EXPIRING_SOON'] }, expiryDate: { lt: today } },
    data: { status: 'EXPIRED' },
  });
}

export default router;
