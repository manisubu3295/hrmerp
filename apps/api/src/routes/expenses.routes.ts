import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { parsePagination, buildPaginationMeta } from '../lib/pagination';
import { AppError } from '../middleware/error.middleware';
import { requirePermission } from '../middleware/auth.middleware';
import { ExpenseStatus, ExpenseCategory, UserRole } from '@sankoerp/shared';
import { Prisma } from '@prisma/client';
import { emitEvent } from '../lib/events';

const router = Router();

/** Resolve employeeId for the calling user (throws 403 if not found). */
async function resolveEmployeeId(userId: string): Promise<string> {
  const employee = await prisma.employee.findFirst({ where: { userId }, select: { id: true } });
  if (!employee) throw new AppError(403, 'No employee profile linked to this account');
  return employee.id;
}

// Same admin bypass used by leave/employee-case routes: admins/managers act
// on behalf of any employee (e.g. logging an expense for a field worker),
// everyone else can only submit for themselves.
function isAdminRole(role: UserRole) {
  return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN || role === UserRole.MANAGER;
}

async function checkBudget(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || Number(project.quotedBudget) === 0) return;

  const agg = await prisma.expense.aggregate({
    where: { projectId, status: 'APPROVED' },
    _sum: { amount: true },
  });
  const total = Number(agg._sum.amount ?? 0);
  const pct = total / Number(project.quotedBudget);
  if (pct >= 0.8) {
    emitEvent('project.budget.threshold', {
      organizationId: project.organizationId, projectId, projectCode: project.projectCode, usedPercent: Math.round(pct * 100),
    });
  }
}

// GET /expenses
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query as Record<string, unknown>);
    const { search, projectId, status, category } = req.query as unknown as Record<string, string | undefined>;

    const where: Prisma.ExpenseWhereInput = {
      ...(projectId && { projectId }),
      ...(status && { status: status as ExpenseStatus }),
      ...(category && { category: category as ExpenseCategory }),
      ...(search && {
        OR: [
          { description: { contains: search, mode: 'insensitive' } },
          { expenseCode: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where, skip, take,
        include: {
          project: { select: { id: true, projectCode: true, name: true } },
          submittedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { date: 'desc' },
      }),
      prisma.expense.count({ where }),
    ]);

    res.json({ success: true, data: { data: expenses, meta: buildPaginationMeta(total, page, limit) } });
  } catch (e) { next(e); }
});

// POST /expenses
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = req.body as {
      projectId?: string;
      category?: string;
      amount?: number | string;
      description?: string;
      date?: string;
      expenseDate?: string;
      receiptUrl?: string;
      submittedById?: string;
    };

    if (!dto.projectId) throw new AppError(400, 'projectId is required');
    if (!dto.category || !Object.values(ExpenseCategory).includes(dto.category as ExpenseCategory)) {
      throw new AppError(400, `category must be one of: ${Object.values(ExpenseCategory).join(', ')}`);
    }
    if (!dto.description?.trim()) throw new AppError(400, 'description is required');

    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new AppError(400, 'amount must be a number greater than 0');

    // Frontend form field is `expenseDate`; accept either key.
    const date = new Date(dto.date ?? dto.expenseDate ?? '');
    if (Number.isNaN(date.getTime())) throw new AppError(400, 'A valid date is required');

    const project = await prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new AppError(404, `Project ${dto.projectId} not found`);

    // Regular users can only submit for themselves. Admins/managers may log
    // an expense on behalf of any employee by passing submittedById; if they
    // don't, it falls back to their own linked employee profile (if any).
    const callerRole = req.user!.role as UserRole;
    let submittedById: string;
    if (isAdminRole(callerRole) && dto.submittedById) {
      const submitter = await prisma.employee.findUnique({ where: { id: dto.submittedById }, select: { id: true } });
      if (!submitter) throw new AppError(404, `Employee ${dto.submittedById} not found`);
      submittedById = submitter.id;
    } else {
      submittedById = await resolveEmployeeId(req.user!.sub);
    }

    const count = await prisma.expense.count();
    const expenseCode = `EXP-${String(count + 1).padStart(5, '0')}`;

    const expense = await prisma.expense.create({
      data: {
        organizationId: req.organizationId as string,
        expenseCode,
        projectId: dto.projectId,
        submittedById,
        category: dto.category as ExpenseCategory,
        amount,
        description: dto.description,
        date,
        receiptUrl: dto.receiptUrl,
        status: 'PENDING',
      },
      include: {
        project: { select: { id: true, projectCode: true, name: true, quotedBudget: true } },
        submittedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await checkBudget(dto.projectId);
    res.status(201).json({ success: true, data: expense });
  } catch (e) { next(e); }
});

// GET /expenses/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: req.params['id'] },
      include: {
        project: true,
        submittedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!expense) throw new AppError(404, `Expense ${req.params['id']} not found`);
    res.json({ success: true, data: expense });
  } catch (e) { next(e); }
});

// PATCH /expenses/:id/approve
router.patch('/:id/approve', requirePermission('expense:approve'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const expense = await prisma.expense.findUnique({ where: { id: req.params['id'] } });
    if (!expense) throw new AppError(404, `Expense ${req.params['id']} not found`);
    if (expense.status !== 'PENDING') throw new AppError(400, 'Only pending expenses can be actioned');
    const { approvedById } = req.body as { approvedById?: string };
    const updated = await prisma.expense.update({
      where: { id: req.params['id'] },
      data: { status: 'APPROVED', approvedById, approvedAt: new Date(), rejectionReason: null },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// PATCH /expenses/:id/reject
router.patch('/:id/reject', requirePermission('expense:approve'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const expense = await prisma.expense.findUnique({ where: { id: req.params['id'] } });
    if (!expense) throw new AppError(404, `Expense ${req.params['id']} not found`);
    if (expense.status !== 'PENDING') throw new AppError(400, 'Only pending expenses can be actioned');
    const { approvedById, rejectionReason } = req.body as { approvedById?: string; rejectionReason?: string };
    const updated = await prisma.expense.update({
      where: { id: req.params['id'] },
      data: { status: 'REJECTED', approvedById, approvedAt: new Date(), rejectionReason: rejectionReason ?? null },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// GET /expenses/project/:projectId/summary
router.get('/project/:projectId/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const expenses = await prisma.expense.findMany({
      where: { projectId: req.params['projectId'], status: 'APPROVED' },
    });
    const byCategory = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount);
      return acc;
    }, {} as Record<string, number>);
    const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
    res.json({ success: true, data: { total, byCategory, count: expenses.length } });
  } catch (e) { next(e); }
});

export default router;
