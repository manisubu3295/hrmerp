import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { parsePagination, buildPaginationMeta } from '../lib/pagination';
import { AppError } from '../middleware/error.middleware';
import { requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { createProjectSchema, updateProjectSchema } from '../schemas/projects.schema';
import { UserRole, ProjectStatus } from '@sankoerp/shared';
import { Prisma } from '@prisma/client';
import { emitEvent } from '../lib/events';

const router = Router();

async function generateProjectCode(): Promise<string> {
  const count = await prisma.project.count();
  const year = new Date().getFullYear();
  return `PRJ-${year}-${String(count + 1).padStart(4, '0')}`;
}

async function findProjectOrFail(id: string) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      employees: {
        where: { isActive: true },
        include: { employee: { select: { id: true, firstName: true, lastName: true, jobTitle: true, dailyRate: true } } },
      },
      expenses: { where: { status: 'APPROVED' }, orderBy: { date: 'desc' } },
      equipmentIssues: { include: { item: { select: { id: true, name: true, itemCode: true } } } },
      invoices: { orderBy: { issueDate: 'desc' } },
    },
  });
  if (!project) throw new AppError(404, `Project ${id} not found`);
  return project;
}

// GET /projects
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query as Record<string, unknown>);
    const { search, status, clientId } = req.query as unknown as Record<string, string | undefined>;

    const where: Prisma.ProjectWhereInput = {
      ...(status && { status: status as ProjectStatus }),
      ...(clientId && { clientId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { projectCode: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where, skip, take,
        include: {
          client: { select: { id: true, name: true } },
          employees: {
            where: { isActive: true },
            include: { employee: { select: { id: true, firstName: true, lastName: true } } },
          },
          _count: { select: { expenses: true, invoices: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.count({ where }),
    ]);

    res.json({ success: true, data: { data: projects, meta: buildPaginationMeta(total, page, limit) } });
  } catch (e) { next(e); }
});

// POST /projects
router.post('/', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER), validate(createProjectSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = req.body;
    const projectCode = await generateProjectCode();
    const project = await prisma.project.create({
      data: {
        ...dto,
        projectCode,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        quotedBudget: dto.quotedBudget ?? 0,
        targetMargin: dto.targetMargin ?? 0.15,
        overheadPercent: dto.overheadPercent ?? 0,
      },
      include: { client: { select: { id: true, name: true } } },
    });
    res.status(201).json({ success: true, data: project });
  } catch (e) { next(e); }
});

// GET /projects/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await findProjectOrFail(req.params['id']!);
    res.json({ success: true, data: project });
  } catch (e) { next(e); }
});

// PATCH /projects/:id
router.patch('/:id', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER), validate(updateProjectSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await findProjectOrFail(req.params['id']!);
    const dto = req.body;
    const project = await prisma.project.update({
      where: { id: req.params['id'] },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
    res.json({ success: true, data: project });
  } catch (e) { next(e); }
});

// PATCH /projects/:id/status
router.patch('/:id/status', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body as { status: ProjectStatus };
    if (!status) throw new AppError(400, 'status is required');
    const project = await findProjectOrFail(req.params['id']!);
    const updated = await prisma.project.update({
      where: { id: req.params['id'] },
      data: {
        status,
        actualEndDate: status === 'COMPLETED' ? new Date() : undefined,
      },
    });
    if (status === 'COMPLETED') {
      emitEvent('project.completed', { projectId: req.params['id'], projectCode: project.projectCode });
    }
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// POST /projects/:id/employees
router.post('/:id/employees', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params['id']!;
    await findProjectOrFail(projectId);
    const { employees } = req.body as { employees: Array<{ employeeId: string; role?: string; dailyRate?: number }> };

    const ops = employees.map((e) =>
      prisma.projectEmployee.upsert({
        where: { projectId_employeeId: { projectId, employeeId: e.employeeId } },
        create: { projectId, employeeId: e.employeeId, role: e.role, dailyRate: e.dailyRate ?? 0, isActive: true },
        update: { role: e.role, dailyRate: e.dailyRate ?? 0, isActive: true, removedAt: null },
      }),
    );
    await prisma.$transaction(ops);
    const updated = await findProjectOrFail(projectId);
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// DELETE /projects/:id/employees/:employeeId
router.delete('/:id/employees/:employeeId', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.projectEmployee.update({
      where: { projectId_employeeId: { projectId: req.params['id']!, employeeId: req.params['employeeId']! } },
      data: { isActive: false, removedAt: new Date() },
    });
    res.json({ success: true, data: { message: 'Employee removed from project' } });
  } catch (e) { next(e); }
});

// GET /projects/:id/profit
router.get('/:id/profit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']!;
    const project = await findProjectOrFail(id);

    const invoices = await prisma.invoice.findMany({ where: { projectId: id } });
    const revenue = invoices.reduce((s, i) => s + Number(i.paidAmount), 0);
    const totalBilled = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);

    const attendances = await prisma.attendance.findMany({ where: { projectId: id } });
    const salaryCost = attendances.reduce((s, a) => s + Number(a.dailyWage) + Number(a.overtimePay), 0);

    const expenses = await prisma.expense.findMany({ where: { projectId: id, status: 'APPROVED' } });
    const expenseCost = expenses.reduce((s, e) => s + Number(e.amount), 0);

    const equipment = await prisma.equipmentIssue.findMany({ where: { projectId: id } });
    const equipmentCost = equipment.reduce((s, e) => s + Number(e.totalCost), 0);

    const totalCostBeforeOverhead = salaryCost + expenseCost + equipmentCost;
    const overheadCost = totalCostBeforeOverhead * Number(project.overheadPercent);
    const totalCost = totalCostBeforeOverhead + overheadCost;
    const netProfit = revenue - totalCost;
    const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const budgetUsed = Number(project.quotedBudget) > 0
      ? (totalCost / Number(project.quotedBudget)) * 100 : 0;

    res.json({
      success: true,
      data: {
        projectId: id, projectCode: project.projectCode, projectName: project.name,
        quotedBudget: Number(project.quotedBudget), targetMargin: Number(project.targetMargin) * 100,
        totalBilled, revenue,
        breakdown: { salaryCost, expenseCost, equipmentCost, overheadCost, totalCost },
        netProfit, profitMargin: Math.round(profitMargin * 100) / 100,
        budgetUsedPercent: Math.round(budgetUsed * 100) / 100,
        isBelowTargetMargin: profitMargin < Number(project.targetMargin) * 100,
        isOverBudget: budgetUsed > 100,
      },
    });
  } catch (e) { next(e); }
});

export default router;
