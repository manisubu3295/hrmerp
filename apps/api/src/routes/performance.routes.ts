import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { requirePermission, getUserPermissions } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import {
  createReviewCycleSchema, updateReviewCycleSchema, generateReviewsSchema,
  submitSelfAssessmentSchema, submitManagerReviewSchema,
} from '../schemas/performance.schema';

const router = Router();

async function resolveEmployeeId(userId: string): Promise<string | null> {
  const employee = await prisma.employee.findFirst({ where: { userId }, select: { id: true } });
  return employee?.id ?? null;
}

// ─── Review cycles ──────────────────────────────────────────────────────

router.get('/cycles', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const cycles = await prisma.performanceReviewCycle.findMany({ orderBy: { periodStart: 'desc' } });
    res.json({ success: true, data: cycles });
  } catch (e) { next(e); }
});

router.post('/cycles', requirePermission('performance:manage_cycle'), validate(createReviewCycleSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cycle = await prisma.performanceReviewCycle.create({
      data: {
        ...req.body,
        periodStart: new Date(req.body.periodStart),
        periodEnd: new Date(req.body.periodEnd),
        organizationId: req.organizationId as string,
      },
    });
    res.status(201).json({ success: true, data: cycle });
  } catch (e) { next(e); }
});

router.patch('/cycles/:id', requirePermission('performance:manage_cycle'), validate(updateReviewCycleSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.performanceReviewCycle.findUnique({ where: { id: req.params['id'] } });
    if (!existing) throw new AppError(404, `Review cycle ${req.params['id']} not found`);
    const cycle = await prisma.performanceReviewCycle.update({ where: { id: req.params['id'] }, data: req.body });
    res.json({ success: true, data: cycle });
  } catch (e) { next(e); }
});

// POST /performance/cycles/:id/reviews — bulk-generate PerformanceReview rows
// for every active employee, or one employeeId if given.
router.post('/cycles/:id/reviews', requirePermission('performance:manage_review'), validate(generateReviewsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cycle = await prisma.performanceReviewCycle.findUnique({ where: { id: req.params['id'] } });
    if (!cycle) throw new AppError(404, `Review cycle ${req.params['id']} not found`);

    const { employeeId, reviewerId } = req.body as { employeeId?: string; reviewerId?: string };
    const employees = employeeId
      ? [await prisma.employee.findUnique({ where: { id: employeeId } })].filter(Boolean)
      : await prisma.employee.findMany({ where: { isActive: true } });

    const reviews = await Promise.all(
      employees.map((emp) =>
        prisma.performanceReview.upsert({
          where: { cycleId_employeeId: { cycleId: cycle.id, employeeId: emp!.id } },
          update: {},
          create: {
            organizationId: req.organizationId as string,
            cycleId: cycle.id,
            employeeId: emp!.id,
            reviewerId: reviewerId ?? null,
            status: 'PENDING_SELF_ASSESSMENT',
          },
        }),
      ),
    );
    res.status(201).json({ success: true, data: reviews });
  } catch (e) { next(e); }
});

// ─── Reviews ─────────────────────────────────────────────────────────────

router.get('/reviews', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.query['employeeId'] as string | undefined;
    const cycleId = req.query['cycleId'] as string | undefined;
    const reviews = await prisma.performanceReview.findMany({
      where: { ...(employeeId && { employeeId }), ...(cycleId && { cycleId }) },
      include: {
        cycle: { select: { id: true, name: true, status: true } },
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        reviewer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: reviews });
  } catch (e) { next(e); }
});

router.get('/reviews/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const review = await prisma.performanceReview.findUnique({
      where: { id: req.params['id'] },
      include: {
        cycle: true,
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        reviewer: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!review) throw new AppError(404, `Review ${req.params['id']} not found`);
    res.json({ success: true, data: review });
  } catch (e) { next(e); }
});

router.patch('/reviews/:id/self-assessment', validate(submitSelfAssessmentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const review = await prisma.performanceReview.findUnique({ where: { id: req.params['id'] } });
    if (!review) throw new AppError(404, `Review ${req.params['id']} not found`);

    const callerEmployeeId = await resolveEmployeeId(req.user!.sub);
    if (callerEmployeeId !== review.employeeId) throw new AppError(403, 'You can only submit your own self-assessment');

    const updated = await prisma.performanceReview.update({
      where: { id: review.id },
      data: {
        ...req.body,
        status: 'PENDING_MANAGER_REVIEW',
        submittedAt: new Date(),
      },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

router.patch('/reviews/:id/manager-review', validate(submitManagerReviewSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const review = await prisma.performanceReview.findUnique({ where: { id: req.params['id'] } });
    if (!review) throw new AppError(404, `Review ${req.params['id']} not found`);

    const callerEmployeeId = await resolveEmployeeId(req.user!.sub);
    if (callerEmployeeId !== review.reviewerId) {
      const perms = await getUserPermissions(req.user!.sub);
      if (!perms.has('performance:manage_review')) throw new AppError(403, 'Forbidden: insufficient permissions');
    }

    const updated = await prisma.performanceReview.update({
      where: { id: review.id },
      data: {
        ...req.body,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

export default router;
