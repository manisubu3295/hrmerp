import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { requirePermission } from '../middleware/auth.middleware';
import { startInstance, recordAction, getStatus } from '../lib/approval-chain.service';

const router = Router();

// GET /approval-chains?entityType=Expense
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType } = req.query as Record<string, string | undefined>;
    const chains = await prisma.approvalChain.findMany({
      where: { ...(entityType && { entityType }) },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: chains });
  } catch (e) { next(e); }
});

// POST /approval-chains — create a chain with its steps in one call
router.post('/', requirePermission('approval_chain:manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType, name, steps } = req.body as {
      entityType?: string;
      name?: string;
      steps?: Array<{ stepOrder: number; approverRoleId?: string; approverUserId?: string; required?: boolean }>;
    };
    if (!entityType || !name || !steps?.length) throw new AppError(400, 'entityType, name and at least one step are required');
    for (const step of steps) {
      if (!step.approverRoleId && !step.approverUserId) {
        throw new AppError(400, `Step ${step.stepOrder} needs an approverRoleId or approverUserId`);
      }
    }

    const chain = await prisma.approvalChain.create({
      data: {
        organizationId: req.organizationId as string,
        entityType,
        name,
        steps: {
          create: steps.map((s) => ({
            stepOrder: s.stepOrder,
            approverRoleId: s.approverRoleId,
            approverUserId: s.approverUserId,
            required: s.required ?? true,
          })),
        },
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    res.status(201).json({ success: true, data: chain });
  } catch (e) { next(e); }
});

// PATCH /approval-chains/:id — rename or activate/deactivate a chain
router.patch('/:id', requirePermission('approval_chain:manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, isActive } = req.body as { name?: string; isActive?: boolean };
    const chain = await prisma.approvalChain.update({
      where: { id: req.params['id'] },
      data: { ...(name !== undefined && { name }), ...(isActive !== undefined && { isActive }) },
    });
    res.json({ success: true, data: chain });
  } catch (e) { next(e); }
});

// POST /approval-chains/:id/instances — start an approval instance for an entity
router.post('/:id/instances', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType, entityId } = req.body as { entityType?: string; entityId?: string };
    if (!entityType || !entityId) throw new AppError(400, 'entityType and entityId are required');
    const instance = await startInstance(req.params['id']!, entityType, entityId);
    res.status(201).json({ success: true, data: instance });
  } catch (e) { next(e); }
});

// GET /approval-chains/instances/:instanceId
router.get('/instances/:instanceId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instance = await getStatus(req.params['instanceId']!);
    res.json({ success: true, data: instance });
  } catch (e) { next(e); }
});

// POST /approval-chains/instances/:instanceId/actions — approve or reject the current step
router.post('/instances/:instanceId/actions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { decision, comment } = req.body as { decision?: 'APPROVED' | 'REJECTED'; comment?: string };
    if (decision !== 'APPROVED' && decision !== 'REJECTED') throw new AppError(400, 'decision must be APPROVED or REJECTED');
    const instance = await recordAction(req.params['instanceId']!, req.user!.sub, decision, comment);
    res.json({ success: true, data: instance });
  } catch (e) { next(e); }
});

export default router;
