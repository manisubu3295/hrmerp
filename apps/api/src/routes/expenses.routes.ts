import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { parsePagination, buildPaginationMeta } from '../lib/pagination';
import { AppError } from '../middleware/error.middleware';
import { requirePermission } from '../middleware/auth.middleware';
import { ExpenseStatus, ExpenseCategory } from '@sankoerp/shared';
import { Prisma } from '@prisma/client';
import { emitEvent } from '../lib/events';

const router = Router();

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
    const dto = req.body;
    const count = await prisma.expense.count();
    const expenseCode = `EXP-${String(count + 1).padStart(5, '0')}`;

    const expense = await prisma.expense.create({
      data: {
        organizationId: req.organizationId as string,
        expenseCode,
        projectId: dto.projectId,
        submittedById: dto.submittedById,
        category: dto.category,
        amount: dto.amount,
        description: dto.description,
        date: new Date(dto.date),
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
