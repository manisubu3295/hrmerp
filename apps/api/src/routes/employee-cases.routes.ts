import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { requirePermission, getUserPermissions } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { createEmployeeCaseSchema, updateEmployeeCaseSchema, createCaseCommentSchema } from '../schemas/employee-cases.schema';

const router = Router();

async function resolveEmployeeId(userId: string): Promise<string | null> {
  const employee = await prisma.employee.findFirst({ where: { userId }, select: { id: true } });
  return employee?.id ?? null;
}

async function canManage(req: Request): Promise<boolean> {
  const perms = await getUserPermissions(req.user!.sub);
  return perms.has('employee_case:manage');
}

// GET / — admin/manager (employee_case:manage) sees every case; everyone
// else sees only their own, same self-service-scoping shape as leave.routes.ts.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const manage = await canManage(req);
    let where: Record<string, unknown> = {};
    if (!manage) {
      const employeeId = await resolveEmployeeId(req.user!.sub);
      if (!employeeId) throw new AppError(403, 'No employee profile linked to this account');
      where = { employeeId };
    } else if (req.query['employeeId']) {
      where = { employeeId: req.query['employeeId'] as string };
    }
    const status = req.query['status'] as string | undefined;
    if (status) where['status'] = status;

    const cases = await prisma.employeeCase.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: cases });
  } catch (e) { next(e); }
});

// POST / — ungated (like Expense creation today): any authenticated user can
// raise their own case. employeeId is forced to the caller's own unless the
// caller holds employee_case:manage (so HR can log a case on someone's behalf).
router.post('/', validate(createEmployeeCaseSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const manage = await canManage(req);
    let employeeId = req.body.employeeId as string | undefined;
    if (!manage || !employeeId) {
      const ownEmployeeId = await resolveEmployeeId(req.user!.sub);
      if (!ownEmployeeId) throw new AppError(403, 'No employee profile linked to this account');
      employeeId = ownEmployeeId;
    }

    const count = await prisma.employeeCase.count();
    const caseCode = `CASE-${String(count + 1).padStart(4, '0')}`;

    const employeeCase = await prisma.employeeCase.create({
      data: {
        organizationId: req.organizationId as string,
        caseCode,
        employeeId,
        type: req.body.type,
        category: req.body.category,
        title: req.body.title,
        description: req.body.description,
        priority: req.body.priority,
        confidential: req.body.confidential,
      },
    });
    res.status(201).json({ success: true, data: employeeCase });
  } catch (e) { next(e); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeCase = await prisma.employeeCase.findUnique({
      where: { id: req.params['id'] },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!employeeCase) throw new AppError(404, `Case ${req.params['id']} not found`);

    const manage = await canManage(req);
    if (!manage) {
      const ownEmployeeId = await resolveEmployeeId(req.user!.sub);
      if (ownEmployeeId !== employeeCase.employeeId) throw new AppError(403, 'Access denied');
    }

    res.json({ success: true, data: employeeCase });
  } catch (e) { next(e); }
});

router.patch('/:id', requirePermission('employee_case:manage'), validate(updateEmployeeCaseSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.employeeCase.findUnique({ where: { id: req.params['id'] } });
    if (!existing) throw new AppError(404, `Case ${req.params['id']} not found`);

    const isResolving = req.body.status === 'RESOLVED' || req.body.status === 'CLOSED';
    const employeeCase = await prisma.employeeCase.update({
      where: { id: req.params['id'] },
      data: {
        ...req.body,
        resolvedAt: isResolving && !existing.resolvedAt ? new Date() : undefined,
      },
    });
    res.json({ success: true, data: employeeCase });
  } catch (e) { next(e); }
});

// ─── Comments ────────────────────────────────────────────────────────────

router.get('/:id/comments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeCase = await prisma.employeeCase.findUnique({ where: { id: req.params['id'] } });
    if (!employeeCase) throw new AppError(404, `Case ${req.params['id']} not found`);

    const manage = await canManage(req);
    if (!manage) {
      const ownEmployeeId = await resolveEmployeeId(req.user!.sub);
      if (ownEmployeeId !== employeeCase.employeeId) throw new AppError(403, 'Access denied');
    }

    const comments = await prisma.employeeCaseComment.findMany({
      where: { caseId: req.params['id'], ...(manage ? {} : { isInternal: false }) },
      include: { authorUser: { select: { id: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: comments });
  } catch (e) { next(e); }
});

router.post('/:id/comments', validate(createCaseCommentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeCase = await prisma.employeeCase.findUnique({ where: { id: req.params['id'] } });
    if (!employeeCase) throw new AppError(404, `Case ${req.params['id']} not found`);

    const manage = await canManage(req);
    if (!manage) {
      const ownEmployeeId = await resolveEmployeeId(req.user!.sub);
      if (ownEmployeeId !== employeeCase.employeeId) throw new AppError(403, 'Access denied');
    }

    const comment = await prisma.employeeCaseComment.create({
      data: {
        caseId: req.params['id'] as string,
        authorUserId: req.user!.sub,
        body: req.body.body,
        // non-managers can only ever post employee-visible comments
        isInternal: manage ? req.body.isInternal : false,
      },
    });
    res.status(201).json({ success: true, data: comment });
  } catch (e) { next(e); }
});

export default router;
