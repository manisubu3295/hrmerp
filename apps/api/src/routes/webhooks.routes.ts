import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { requirePermission } from '../middleware/auth.middleware';

const router = Router();

router.use(requirePermission('webhooks:manage'));

// GET /webhooks — list this org's subscriptions (secret omitted)
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const subscriptions = await prisma.webhookSubscription.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: subscriptions.map(({ secret: _secret, ...s }) => s) });
  } catch (e) { next(e); }
});

// POST /webhooks — create a subscription. secret is generated if not supplied
// and only ever returned in this create response — treat it like a password.
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, eventTypes } = req.body as { url?: string; eventTypes?: string[] };
    if (!url || !eventTypes?.length) throw new AppError(400, 'url and eventTypes are required');

    const secret = crypto.randomBytes(24).toString('hex');
    const subscription = await prisma.webhookSubscription.create({
      data: { organizationId: req.organizationId as string, url, eventTypes, secret },
    });
    res.status(201).json({ success: true, data: subscription });
  } catch (e) { next(e); }
});

// PATCH /webhooks/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, eventTypes, isActive } = req.body as { url?: string; eventTypes?: string[]; isActive?: boolean };
    const subscription = await prisma.webhookSubscription.update({
      where: { id: req.params['id'] },
      data: {
        ...(url !== undefined && { url }),
        ...(eventTypes !== undefined && { eventTypes }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    const { secret: _secret, ...safe } = subscription;
    res.json({ success: true, data: safe });
  } catch (e) { next(e); }
});

// DELETE /webhooks/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.webhookSubscription.delete({ where: { id: req.params['id'] } });
    res.json({ success: true, data: { message: 'Webhook subscription deleted' } });
  } catch (e) { next(e); }
});

// GET /webhooks/:id/deliveries — recent delivery attempts, for debugging
router.get('/:id/deliveries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { subscriptionId: req.params['id'] },
      orderBy: { attemptedAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: deliveries });
  } catch (e) { next(e); }
});

export default router;
