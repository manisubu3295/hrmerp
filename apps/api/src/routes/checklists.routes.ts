import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { requirePermission, getUserPermissions } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import {
  createChecklistTemplateSchema, updateChecklistTemplateSchema,
  createChecklistTemplateTaskSchema, updateChecklistTemplateTaskSchema,
  createChecklistInstanceSchema, updateChecklistInstanceTaskSchema,
} from '../schemas/checklists.schema';
import { materializeChecklistInstance } from '../lib/checklists';

const router = Router();

async function resolveEmployeeId(userId: string): Promise<string | null> {
  const employee = await prisma.employee.findFirst({ where: { userId }, select: { id: true } });
  return employee?.id ?? null;
}

// ─── Templates (ONBOARDING or OFFBOARDING, one file handles both) ─────────

router.get('/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const purpose = req.query['purpose'] as string | undefined;
    const templates = await prisma.checklistTemplate.findMany({
      where: { ...(purpose && { purpose: purpose as never }) },
      include: { tasks: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: templates });
  } catch (e) { next(e); }
});

router.post('/templates', requirePermission('checklist:manage_template'), validate(createChecklistTemplateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.checklistTemplate.create({
      data: { ...req.body, organizationId: req.organizationId as string },
    });
    res.status(201).json({ success: true, data: template });
  } catch (e) { next(e); }
});

router.patch('/templates/:id', requirePermission('checklist:manage_template'), validate(updateChecklistTemplateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.checklistTemplate.findUnique({ where: { id: req.params['id'] } });
    if (!existing) throw new AppError(404, `Template ${req.params['id']} not found`);
    const template = await prisma.checklistTemplate.update({ where: { id: req.params['id'] }, data: req.body });
    res.json({ success: true, data: template });
  } catch (e) { next(e); }
});

router.post('/templates/:id/tasks', requirePermission('checklist:manage_template'), validate(createChecklistTemplateTaskSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.checklistTemplate.findUnique({ where: { id: req.params['id'] } });
    if (!template) throw new AppError(404, `Template ${req.params['id']} not found`);
    const task = await prisma.checklistTemplateTask.create({ data: { ...req.body, templateId: template.id } });
    res.status(201).json({ success: true, data: task });
  } catch (e) { next(e); }
});

router.patch('/templates/:id/tasks/:taskId', requirePermission('checklist:manage_template'), validate(updateChecklistTemplateTaskSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.checklistTemplateTask.findUnique({ where: { id: req.params['taskId'] } });
    if (!existing || existing.templateId !== req.params['id']) throw new AppError(404, 'Template task not found');
    const task = await prisma.checklistTemplateTask.update({ where: { id: req.params['taskId'] }, data: req.body });
    res.json({ success: true, data: task });
  } catch (e) { next(e); }
});

router.delete('/templates/:id/tasks/:taskId', requirePermission('checklist:manage_template'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.checklistTemplateTask.findUnique({ where: { id: req.params['taskId'] } });
    if (!existing || existing.templateId !== req.params['id']) throw new AppError(404, 'Template task not found');
    await prisma.checklistTemplateTask.delete({ where: { id: req.params['taskId'] } });
    res.json({ success: true, data: { message: 'Template task deleted' } });
  } catch (e) { next(e); }
});

// ─── Instances ──────────────────────────────────────────────────────────

router.post('/instances', requirePermission('checklist:manage_instance'), validate(createChecklistInstanceSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.checklistTemplate.findUnique({ where: { id: req.body.templateId } });
    if (!template) throw new AppError(404, `Template ${req.body.templateId} not found`);
    const instance = await materializeChecklistInstance(
      req.organizationId as string,
      req.body.employeeId,
      template.purpose,
      new Date(req.body.startDate),
      template.id,
    );
    res.status(201).json({ success: true, data: instance });
  } catch (e) { next(e); }
});

router.get('/instances', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.query['employeeId'] as string | undefined;
    const purpose = req.query['purpose'] as string | undefined;
    const instances = await prisma.checklistInstance.findMany({
      where: { ...(employeeId && { employeeId }), ...(purpose && { purpose: purpose as never }) },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        template: { select: { id: true, name: true } },
        tasks: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: instances });
  } catch (e) { next(e); }
});

router.get('/instances/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instance = await prisma.checklistInstance.findUnique({
      where: { id: req.params['id'] },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        template: { select: { id: true, name: true } },
        tasks: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!instance) throw new AppError(404, `Checklist instance ${req.params['id']} not found`);
    res.json({ success: true, data: instance });
  } catch (e) { next(e); }
});

router.patch('/instances/:id/tasks/:taskId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isDone } = updateChecklistInstanceTaskSchema.parse(req.body);
    const task = await prisma.checklistInstanceTask.findUnique({ where: { id: req.params['taskId'] } });
    if (!task || task.instanceId !== req.params['id']) throw new AppError(404, 'Checklist task not found');

    const instance = await prisma.checklistInstance.findUnique({ where: { id: req.params['id'] } });
    if (!instance) throw new AppError(404, 'Checklist instance not found');

    const callerEmployeeId = await resolveEmployeeId(req.user!.sub);
    const isOwner = callerEmployeeId === instance.employeeId;
    if (!isOwner) {
      // anyone who can start a checklist can also update its tasks on
      // someone else's behalf
      const perms = await getUserPermissions(req.user!.sub);
      if (!perms.has('checklist:manage_instance')) {
        throw new AppError(403, 'Forbidden: insufficient permissions');
      }
    }

    const updated = await prisma.checklistInstanceTask.update({
      where: { id: req.params['taskId'] },
      data: { isDone, doneAt: isDone ? new Date() : null, doneById: isDone ? req.user!.sub : null },
    });

    const remaining = await prisma.checklistInstanceTask.count({ where: { instanceId: instance.id, isDone: false } });
    if (remaining === 0 && instance.status === 'IN_PROGRESS') {
      await prisma.checklistInstance.update({ where: { id: instance.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    } else if (remaining > 0 && instance.status === 'COMPLETED') {
      await prisma.checklistInstance.update({ where: { id: instance.id }, data: { status: 'IN_PROGRESS', completedAt: null } });
    }

    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

export default router;
