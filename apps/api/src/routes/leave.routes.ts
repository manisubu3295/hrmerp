import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { parsePagination, buildPaginationMeta } from '../lib/pagination';
import { AppError } from '../middleware/error.middleware';
import { requireRoles } from '../middleware/auth.middleware';
import { UserRole } from '@sankoerp/shared';

const router = Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

const db = prisma as any;

async function resolveEmployeeId(userId: string): Promise<string> {
  const employee = await prisma.employee.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (!employee) throw new AppError(403, 'No employee profile linked to this account');
  return employee.id;
}

function isAdminRole(role: UserRole) {
  return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN || role === UserRole.MANAGER;
}

async function generateLeaveCode(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.leaveRequest.count();
  return `LV-${year}-${String(count + 1).padStart(6, '0')}`;
}

function calcWorkingDays(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// ─── GET /leave/policies ─────────────────────────────────────────────────────
router.get('/policies', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const policies = await db.leavePolicy.findMany({
      where: { isActive: true },
      orderBy: { leaveType: 'asc' },
    });
    res.json({ success: true, data: policies });
  } catch (e) { next(e); }
});

// ─── POST /leave/policies ─────────────────────────────────────────────────────
router.post('/policies', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leaveType, name, daysPerYear, carryForwardMax, isPaidLeave, applicableTo } = req.body;
    if (!leaveType || !name || daysPerYear == null) {
      throw new AppError(400, 'leaveType, name, and daysPerYear are required');
    }
    const policy = await db.leavePolicy.upsert({
      where: { leaveType },
      update: { name, daysPerYear, carryForwardMax: carryForwardMax ?? 0, isPaidLeave: isPaidLeave ?? true, applicableTo },
      create: { leaveType, name, daysPerYear, carryForwardMax: carryForwardMax ?? 0, isPaidLeave: isPaidLeave ?? true, applicableTo },
    });
    res.status(201).json({ success: true, data: policy });
  } catch (e) { next(e); }
});

// ─── GET /leave/balances ──────────────────────────────────────────────────────
router.get('/balances', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerRole = req.user!.role as UserRole;
    const year = Number(req.query['year']) || new Date().getFullYear();

    let employeeId: string;
    if (isAdminRole(callerRole) && req.query['employeeId']) {
      employeeId = req.query['employeeId'] as string;
    } else {
      employeeId = await resolveEmployeeId(req.user!.sub);
    }

    const balances = await db.leaveBalance.findMany({
      where: { employeeId, year },
      orderBy: { leaveType: 'asc' },
    });
    res.json({ success: true, data: balances });
  } catch (e) { next(e); }
});

// ─── POST /leave/balances/init ────────────────────────────────────────────────
router.post('/balances/init', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId, year } = req.body;
    if (!employeeId || !year) throw new AppError(400, 'employeeId and year are required');

    const policies = await db.leavePolicy.findMany({ where: { isActive: true } });

    const results = await Promise.all(
      policies.map((p: any) =>
        db.leaveBalance.upsert({
          where: { employeeId_year_leaveType: { employeeId, year, leaveType: p.leaveType } },
          update: {},
          create: {
            employeeId,
            year,
            leaveType: p.leaveType,
            entitled: p.daysPerYear,
            used: 0,
            pending: 0,
            carriedOver: 0,
          },
        })
      )
    );
    res.status(201).json({ success: true, data: results });
  } catch (e) { next(e); }
});

// ─── GET /leave/requests ──────────────────────────────────────────────────────
router.get('/requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query as Record<string, unknown>);
    const callerRole = req.user!.role as UserRole;
    const { status, leaveType, year } = req.query as Record<string, string | undefined>;

    let employeeId: string | undefined;
    if (!isAdminRole(callerRole)) {
      employeeId = await resolveEmployeeId(req.user!.sub);
    } else if (req.query['employeeId']) {
      employeeId = req.query['employeeId'] as string;
    }

    const dateFilter: Record<string, any> = {};
    if (year) {
      dateFilter.startDate = {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${Number(year) + 1}-01-01`),
      };
    }

    const where: Record<string, any> = {
      ...(employeeId && { employeeId }),
      ...(status && { status }),
      ...(leaveType && { leaveType }),
      ...dateFilter,
    };

    const [rows, total] = await Promise.all([
      db.leaveRequest.findMany({
        where, skip, take,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, department: true, jobTitle: true } },
          approver: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.leaveRequest.count({ where }),
    ]);

    res.json({ success: true, data: { data: rows, meta: buildPaginationMeta(total, page, limit) } });
  } catch (e) { next(e); }
});

// ─── POST /leave/requests ─────────────────────────────────────────────────────
router.post('/requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerRole = req.user!.role as UserRole;
    let employeeId: string;

    if (isAdminRole(callerRole) && req.body.employeeId) {
      employeeId = req.body.employeeId;
    } else {
      employeeId = await resolveEmployeeId(req.user!.sub);
    }

    const { leaveType, startDate, endDate, halfDay, reason, attachmentUrl } = req.body;

    if (!leaveType || !startDate || !endDate) {
      throw new AppError(400, 'leaveType, startDate, and endDate are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) throw new AppError(400, 'startDate must be before or equal to endDate');

    let totalDays: number = calcWorkingDays(start, end);
    if (halfDay && totalDays > 0) totalDays = 0.5;

    const leaveCode = await generateLeaveCode();
    const year = start.getFullYear();

    const skipBalanceCheck = ['SICK', 'EMERGENCY', 'UNPAID'].includes(leaveType);
    if (!skipBalanceCheck) {
      const balance = await db.leaveBalance.findUnique({
        where: { employeeId_year_leaveType: { employeeId, year, leaveType } },
      });
      if (balance) {
        const available = balance.entitled + balance.carriedOver - balance.used - balance.pending;
        if (totalDays > available) {
          throw new AppError(400, `Insufficient leave balance. Available: ${available} day(s), Requested: ${totalDays}`);
        }
        await db.leaveBalance.update({
          where: { id: balance.id },
          data: { pending: { increment: Math.ceil(totalDays) } },
        });
      }
    }

    const request = await db.leaveRequest.create({
      data: {
        leaveCode,
        employeeId,
        leaveType,
        startDate: start,
        endDate: end,
        totalDays: Math.ceil(totalDays),
        halfDay: halfDay ?? false,
        reason,
        attachmentUrl,
        status: 'PENDING',
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
    });

    res.status(201).json({ success: true, data: request });
  } catch (e) { next(e); }
});

// ─── GET /leave/requests/:id ──────────────────────────────────────────────────
router.get('/requests/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request = await db.leaveRequest.findUnique({
      where: { id: req.params['id'] },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, department: true, jobTitle: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!request) throw new AppError(404, 'Leave request not found');

    const callerRole = req.user!.role as UserRole;
    if (!isAdminRole(callerRole)) {
      const empId = await resolveEmployeeId(req.user!.sub);
      if (request.employeeId !== empId) throw new AppError(403, 'Access denied');
    }

    res.json({ success: true, data: request });
  } catch (e) { next(e); }
});

// ─── PATCH /leave/requests/:id/approve ───────────────────────────────────────
router.patch('/requests/:id/approve', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request = await db.leaveRequest.findUnique({ where: { id: req.params['id'] } });
    if (!request) throw new AppError(404, 'Leave request not found');
    if (request.status !== 'PENDING') throw new AppError(400, 'Only PENDING requests can be approved');

    const approver = await prisma.employee.findFirst({ where: { userId: req.user!.sub }, select: { id: true } });

    await prisma.$transaction(async (tx: any) => {
      await tx.leaveRequest.update({
        where: { id: request.id },
        data: { status: 'APPROVED', approverId: approver?.id, approvedAt: new Date() },
      });

      const year = new Date(request.startDate).getFullYear();
      await tx.leaveBalance.updateMany({
        where: { employeeId: request.employeeId, year, leaveType: request.leaveType },
        data: {
          pending: { decrement: request.totalDays },
          used: { increment: request.totalDays },
        },
      });
    });

    const updated = await db.leaveRequest.findUnique({
      where: { id: request.id },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// ─── PATCH /leave/requests/:id/reject ────────────────────────────────────────
router.patch('/requests/:id/reject', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rejectionReason } = req.body;
    const request = await db.leaveRequest.findUnique({ where: { id: req.params['id'] } });
    if (!request) throw new AppError(404, 'Leave request not found');
    if (request.status !== 'PENDING') throw new AppError(400, 'Only PENDING requests can be rejected');

    const approver = await prisma.employee.findFirst({ where: { userId: req.user!.sub }, select: { id: true } });

    await prisma.$transaction(async (tx: any) => {
      await tx.leaveRequest.update({
        where: { id: request.id },
        data: {
          status: 'REJECTED',
          approverId: approver?.id,
          rejectedAt: new Date(),
          rejectionReason,
        },
      });

      const year = new Date(request.startDate).getFullYear();
      await tx.leaveBalance.updateMany({
        where: { employeeId: request.employeeId, year, leaveType: request.leaveType },
        data: { pending: { decrement: request.totalDays } },
      });
    });

    const updated = await db.leaveRequest.findUnique({
      where: { id: request.id },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// ─── PATCH /leave/requests/:id/cancel ────────────────────────────────────────
router.patch('/requests/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request = await db.leaveRequest.findUnique({ where: { id: req.params['id'] } });
    if (!request) throw new AppError(404, 'Leave request not found');

    const callerRole = req.user!.role as UserRole;
    if (!isAdminRole(callerRole)) {
      const empId = await resolveEmployeeId(req.user!.sub);
      if (request.employeeId !== empId) throw new AppError(403, 'Access denied');
    }

    if (request.status === 'CANCELLED') throw new AppError(400, 'Request is already cancelled');
    if (request.status === 'REJECTED') throw new AppError(400, 'Request is already rejected');

    await prisma.$transaction(async (tx: any) => {
      await tx.leaveRequest.update({
        where: { id: request.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });

      const year = new Date(request.startDate).getFullYear();
      if (request.status === 'PENDING') {
        await tx.leaveBalance.updateMany({
          where: { employeeId: request.employeeId, year, leaveType: request.leaveType },
          data: { pending: { decrement: request.totalDays } },
        });
      } else if (request.status === 'APPROVED') {
        await tx.leaveBalance.updateMany({
          where: { employeeId: request.employeeId, year, leaveType: request.leaveType },
          data: { used: { decrement: request.totalDays } },
        });
      }
    });

    res.json({ success: true, message: 'Leave request cancelled' });
  } catch (e) { next(e); }
});

// ─── GET /leave/calendar ──────────────────────────────────────────────────────
router.get('/calendar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query as Record<string, string>;
    if (!startDate || !endDate) throw new AppError(400, 'startDate and endDate are required');

    const callerRole = req.user!.role as UserRole;
    let employeeId: string | undefined;
    if (!isAdminRole(callerRole)) {
      employeeId = await resolveEmployeeId(req.user!.sub);
    }

    const where: Record<string, any> = {
      status: 'APPROVED',
      ...(employeeId && { employeeId }),
      OR: [
        { startDate: { gte: new Date(startDate), lte: new Date(endDate) } },
        { endDate: { gte: new Date(startDate), lte: new Date(endDate) } },
        { startDate: { lte: new Date(startDate) }, endDate: { gte: new Date(endDate) } },
      ],
    };

    const leaves = await db.leaveRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
    });

    res.json({ success: true, data: leaves });
  } catch (e) { next(e); }
});

// ─── GET /leave/summary ───────────────────────────────────────────────────────
router.get('/summary', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const year = new Date().getFullYear();

    const [pending, approved, rejected, totalThisYear] = await Promise.all([
      db.leaveRequest.count({ where: { status: 'PENDING' } }),
      db.leaveRequest.count({ where: { status: 'APPROVED' } }),
      db.leaveRequest.count({ where: { status: 'REJECTED' } }),
      db.leaveRequest.count({ where: { startDate: { gte: new Date(`${year}-01-01`) } } }),
    ]);

    res.json({ success: true, data: { pending, approved, rejected, totalThisYear } });
  } catch (e) { next(e); }
});

export default router;
