import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { parsePagination, buildPaginationMeta } from '../lib/pagination';
import { AppError } from '../middleware/error.middleware';
import { requirePermission } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import {
  createRequisitionSchema, updateRequisitionSchema,
  createCandidateSchema, updateCandidateSchema,
  createApplicationSchema, updateApplicationStageSchema,
  hireApplicationSchema,
} from '../schemas/recruitment.schema';
import { createEmployeeFromDto } from './employees.routes';
import { materializeChecklistInstance } from '../lib/checklists';
import { dispatchWebhookEvent } from '../lib/webhooks';

const router = Router();

// ─── Job Requisitions ─────────────────────────────────────────────────────

router.get('/requisitions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query as Record<string, unknown>);
    const status = req.query['status'] as string | undefined;

    const where = { ...(status && { status: status as never }) };
    const [data, total] = await Promise.all([
      prisma.jobRequisition.findMany({
        where, skip, take,
        include: { requestedBy: { select: { id: true, firstName: true, lastName: true } }, _count: { select: { applications: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.jobRequisition.count({ where }),
    ]);

    res.json({ success: true, data: { data, meta: buildPaginationMeta(total, page, limit) } });
  } catch (e) { next(e); }
});

router.post('/requisitions', requirePermission('requisition:create'), validate(createRequisitionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await prisma.jobRequisition.count();
    const code = `REQ-${String(count + 1).padStart(4, '0')}`;
    const requisition = await prisma.jobRequisition.create({
      data: { ...req.body, code, organizationId: req.organizationId as string },
    });
    res.status(201).json({ success: true, data: requisition });
  } catch (e) { next(e); }
});

router.get('/requisitions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requisition = await prisma.jobRequisition.findUnique({
      where: { id: req.params['id'] },
      include: {
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        applications: {
          include: { candidate: true },
          orderBy: { appliedAt: 'desc' },
        },
      },
    });
    if (!requisition) throw new AppError(404, `Requisition ${req.params['id']} not found`);
    res.json({ success: true, data: requisition });
  } catch (e) { next(e); }
});

router.patch('/requisitions/:id', requirePermission('requisition:update'), validate(updateRequisitionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.jobRequisition.findUnique({ where: { id: req.params['id'] } });
    if (!existing) throw new AppError(404, `Requisition ${req.params['id']} not found`);
    const requisition = await prisma.jobRequisition.update({
      where: { id: req.params['id'] },
      data: {
        ...req.body,
        closedAt: req.body.status && req.body.status !== 'OPEN' && req.body.status !== 'ON_HOLD' ? new Date() : undefined,
      },
    });
    res.json({ success: true, data: requisition });
  } catch (e) { next(e); }
});

// ─── Candidates ─────────────────────────────────────────────────────────

router.get('/candidates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query as Record<string, unknown>);
    const search = req.query['search'] as string | undefined;

    const where = {
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };
    const [data, total] = await Promise.all([
      prisma.candidate.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.candidate.count({ where }),
    ]);

    res.json({ success: true, data: { data, meta: buildPaginationMeta(total, page, limit) } });
  } catch (e) { next(e); }
});

router.post('/candidates', requirePermission('candidate:create'), validate(createCandidateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const candidate = await prisma.candidate.create({
      data: { ...req.body, organizationId: req.organizationId as string },
    });
    res.status(201).json({ success: true, data: candidate });
  } catch (e) { next(e); }
});

router.patch('/candidates/:id', requirePermission('candidate:update'), validate(updateCandidateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.candidate.findUnique({ where: { id: req.params['id'] } });
    if (!existing) throw new AppError(404, `Candidate ${req.params['id']} not found`);
    const candidate = await prisma.candidate.update({ where: { id: req.params['id'] }, data: req.body });
    res.json({ success: true, data: candidate });
  } catch (e) { next(e); }
});

// ─── Applications (pipeline) ───────────────────────────────────────────────

router.get('/applications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requisitionId = req.query['requisitionId'] as string | undefined;
    const stage = req.query['stage'] as string | undefined;
    const applications = await prisma.application.findMany({
      where: { ...(requisitionId && { requisitionId }), ...(stage && { stage: stage as never }) },
      include: {
        candidate: true,
        requisition: { select: { id: true, code: true, title: true } },
      },
      orderBy: { appliedAt: 'desc' },
    });
    res.json({ success: true, data: applications });
  } catch (e) { next(e); }
});

router.post('/requisitions/:id/applications', requirePermission('application:manage'), validate(createApplicationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requisition = await prisma.jobRequisition.findUnique({ where: { id: req.params['id'] } });
    if (!requisition) throw new AppError(404, `Requisition ${req.params['id']} not found`);
    const candidate = await prisma.candidate.findUnique({ where: { id: req.body.candidateId } });
    if (!candidate) throw new AppError(404, `Candidate ${req.body.candidateId} not found`);

    const application = await prisma.application.create({
      data: {
        organizationId: req.organizationId as string,
        requisitionId: requisition.id,
        candidateId: candidate.id,
      },
      include: { candidate: true },
    });
    res.status(201).json({ success: true, data: application });
  } catch (e) { next(e); }
});

router.patch('/applications/:id/stage', requirePermission('application:manage'), validate(updateApplicationStageSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.application.findUnique({ where: { id: req.params['id'] } });
    if (!existing) throw new AppError(404, `Application ${req.params['id']} not found`);
    if (existing.stage === 'HIRED') throw new AppError(400, 'This application already resulted in a hire — stage cannot change');

    const application = await prisma.application.update({
      where: { id: req.params['id'] },
      data: { stage: req.body.stage, rejectionReason: req.body.rejectionReason },
    });
    res.json({ success: true, data: application });
  } catch (e) { next(e); }
});

// POST /recruitment/applications/:id/hire — converts a candidate into an
// Employee. Reuses createEmployeeFromDto (employees.routes.ts) so employee
// code generation + identity-doc encryption stay in one place. Best-effort
// auto-starts the org's onboarding checklist and fires employee.hired.
router.post('/applications/:id/hire', requirePermission('application:manage'), validate(hireApplicationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const application = await prisma.application.findUnique({
      where: { id: req.params['id'] },
      include: { requisition: true, candidate: true },
    });
    if (!application) throw new AppError(404, `Application ${req.params['id']} not found`);
    if (application.stage === 'HIRED') throw new AppError(400, 'This application has already resulted in a hire');

    const employee = await createEmployeeFromDto(req.body);

    const updatedRequisition = await prisma.jobRequisition.update({
      where: { id: application.requisitionId },
      data: {
        status: application.requisition.headcount <= 1 ? 'FILLED' : undefined,
        headcount: { decrement: 1 },
        closedAt: application.requisition.headcount <= 1 ? new Date() : undefined,
      },
    });

    const finalApplication = await prisma.application.update({
      where: { id: application.id },
      data: { stage: 'HIRED', hiredEmployeeId: employee.id },
    });

    const checklistInstance = await materializeChecklistInstance(
      req.organizationId as string,
      employee.id,
      'ONBOARDING',
      new Date(req.body.joinDate as string),
    );

    dispatchWebhookEvent(req.organizationId as string, 'employee.hired', {
      employeeId: employee.id,
      applicationId: application.id,
      requisitionId: application.requisitionId,
      checklistInstanceId: checklistInstance?.id ?? null,
    });

    res.status(201).json({ success: true, data: { employee, application: finalApplication, requisition: updatedRequisition, checklistInstance } });
  } catch (e) { next(e); }
});

export default router;
