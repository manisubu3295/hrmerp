import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { requirePermission, getUserPermissions } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { createSkillDefinitionSchema, updateSkillDefinitionSchema, setEmployeeSkillSchema } from '../schemas/skills.schema';

const router = Router();

const PROFICIENCY_RANK: Record<string, number> = { BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3, EXPERT: 4 };

async function resolveEmployeeId(userId: string): Promise<string | null> {
  const employee = await prisma.employee.findFirst({ where: { userId }, select: { id: true } });
  return employee?.id ?? null;
}

async function requireOwnerOrPermission(req: Request, employeeId: string): Promise<void> {
  const callerEmployeeId = await resolveEmployeeId(req.user!.sub);
  if (callerEmployeeId === employeeId) return;
  const perms = await getUserPermissions(req.user!.sub);
  if (!perms.has('skill:manage_employee')) throw new AppError(403, 'Forbidden: insufficient permissions');
}

// ─── Skill catalog ──────────────────────────────────────────────────────

router.get('/catalog', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const skills = await prisma.skillDefinition.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    res.json({ success: true, data: skills });
  } catch (e) { next(e); }
});

router.post('/catalog', requirePermission('skill:manage_catalog'), validate(createSkillDefinitionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const skill = await prisma.skillDefinition.create({ data: { ...req.body, organizationId: req.organizationId as string } });
    res.status(201).json({ success: true, data: skill });
  } catch (e) { next(e); }
});

router.patch('/catalog/:id', requirePermission('skill:manage_catalog'), validate(updateSkillDefinitionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.skillDefinition.findUnique({ where: { id: req.params['id'] } });
    if (!existing) throw new AppError(404, `Skill ${req.params['id']} not found`);
    const skill = await prisma.skillDefinition.update({ where: { id: req.params['id'] }, data: req.body });
    res.json({ success: true, data: skill });
  } catch (e) { next(e); }
});

// ─── Per-employee skill matrix ──────────────────────────────────────────

router.get('/employees/:employeeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const skills = await prisma.employeeSkill.findMany({
      where: { employeeId: req.params['employeeId'] },
      include: { skill: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: skills });
  } catch (e) { next(e); }
});

router.post('/employees/:employeeId/:skillId', validate(setEmployeeSkillSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await requireOwnerOrPermission(req, req.params['employeeId'] as string);
    const skill = await prisma.skillDefinition.findUnique({ where: { id: req.params['skillId'] } });
    if (!skill) throw new AppError(404, `Skill ${req.params['skillId']} not found`);

    const employeeSkill = await prisma.employeeSkill.upsert({
      where: { employeeId_skillId: { employeeId: req.params['employeeId'] as string, skillId: req.params['skillId'] as string } },
      update: {
        ...req.body,
        certifiedAt: req.body.certifiedAt ? new Date(req.body.certifiedAt) : undefined,
      },
      create: {
        organizationId: req.organizationId as string,
        employeeId: req.params['employeeId'] as string,
        skillId: req.params['skillId'] as string,
        ...req.body,
        certifiedAt: req.body.certifiedAt ? new Date(req.body.certifiedAt) : undefined,
      },
    });
    res.status(201).json({ success: true, data: employeeSkill });
  } catch (e) { next(e); }
});

router.patch('/employees/:employeeId/:skillId', validate(setEmployeeSkillSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await requireOwnerOrPermission(req, req.params['employeeId'] as string);
    const existing = await prisma.employeeSkill.findUnique({
      where: { employeeId_skillId: { employeeId: req.params['employeeId'] as string, skillId: req.params['skillId'] as string } },
    });
    if (!existing) throw new AppError(404, 'Employee skill not found');

    const employeeSkill = await prisma.employeeSkill.update({
      where: { id: existing.id },
      data: { ...req.body, certifiedAt: req.body.certifiedAt ? new Date(req.body.certifiedAt) : undefined },
    });
    res.json({ success: true, data: employeeSkill });
  } catch (e) { next(e); }
});

router.delete('/employees/:employeeId/:skillId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await requireOwnerOrPermission(req, req.params['employeeId'] as string);
    const existing = await prisma.employeeSkill.findUnique({
      where: { employeeId_skillId: { employeeId: req.params['employeeId'] as string, skillId: req.params['skillId'] as string } },
    });
    if (!existing) throw new AppError(404, 'Employee skill not found');
    await prisma.employeeSkill.delete({ where: { id: existing.id } });
    res.json({ success: true, data: { message: 'Employee skill removed' } });
  } catch (e) { next(e); }
});

// GET /skills/matrix?skillId=&minProficiency= — groundwork for future
// skill-matched allocation (blueprint module 6); kept simple this pass.
router.get('/matrix', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const skillId = req.query['skillId'] as string | undefined;
    const minProficiency = req.query['minProficiency'] as string | undefined;

    const rows = await prisma.employeeSkill.findMany({
      where: { ...(skillId && { skillId }) },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, department: true } },
        skill: true,
      },
      orderBy: { proficiency: 'desc' },
    });

    const minRank = minProficiency ? PROFICIENCY_RANK[minProficiency] ?? 0 : 0;
    const filtered = rows.filter((r) => (PROFICIENCY_RANK[r.proficiency] ?? 0) >= minRank);

    res.json({ success: true, data: filtered });
  } catch (e) { next(e); }
});

export default router;
