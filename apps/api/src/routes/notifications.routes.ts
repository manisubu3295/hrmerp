import { Router, Request, Response, NextFunction } from 'express';
import prisma, { prismaUnscoped } from '../lib/prisma';
import { parsePagination, buildPaginationMeta } from '../lib/pagination';
import { AppError } from '../middleware/error.middleware';
import { NotificationType, NotificationPriority, WORK_PASS_ALERT_DAYS } from '@sankoerp/shared';
import { onEvent } from '../lib/events';

const router = Router();

// Uses prismaUnscoped + an explicit organizationId: these event listeners fire
// from system/cron code with no request context (see lib/events.ts), so the
// tenant-scoped default client isn't usable here — organizationId must come
// from the event payload instead.
async function createNotification(data: {
  organizationId: string;
  userId?: string;
  projectId?: string;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
}) {
  return prismaUnscoped.notification.create({
    data: {
      organizationId: data.organizationId,
      userId: data.userId,
      projectId: data.projectId,
      type: data.type,
      title: data.title,
      message: data.message,
      priority: data.priority ?? 'MEDIUM',
      metadata: data.metadata as object ?? undefined,
      sentAt: new Date(),
    },
  });
}

async function getAdminUserIds(organizationId: string): Promise<string[]> {
  const admins = await prismaUnscoped.user.findMany({
    where: { organizationId, role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

// Register event listeners
onEvent('workpass.expiring', async (payload: {
  organizationId: string; workPassId: string; employeeId: string; employeeName: string;
  daysToExpiry: number; expiryDate: Date; passType: string;
}) => {
  let type: NotificationType;
  let priority: NotificationPriority;

  if (payload.daysToExpiry <= WORK_PASS_ALERT_DAYS.CRITICAL) {
    type = NotificationType.WORK_PASS_EXPIRING_7;
    priority = NotificationPriority.CRITICAL;
  } else if (payload.daysToExpiry <= WORK_PASS_ALERT_DAYS.URGENT) {
    type = NotificationType.WORK_PASS_EXPIRING_15;
    priority = NotificationPriority.URGENT;
  } else {
    type = NotificationType.WORK_PASS_EXPIRING_30;
    priority = NotificationPriority.HIGH;
  }

  const admins = await getAdminUserIds(payload.organizationId);
  for (const userId of admins) {
    await createNotification({
      organizationId: payload.organizationId,
      userId, type,
      title: `Work Pass Expiring in ${payload.daysToExpiry} Days`,
      message: `${payload.employeeName}'s ${payload.passType} expires on ${(payload.expiryDate as Date).toLocaleDateString('en-SG')}. Initiate renewal now.`,
      priority,
      metadata: { workPassId: payload.workPassId, employeeId: payload.employeeId },
    });
  }
});

onEvent('project.budget.threshold', async (payload: { organizationId: string; projectId: string; projectCode: string; usedPercent: number }) => {
  const admins = await getAdminUserIds(payload.organizationId);
  for (const userId of admins) {
    await createNotification({
      organizationId: payload.organizationId,
      userId, projectId: payload.projectId,
      type: NotificationType.PROJECT_BUDGET_80,
      title: `Project Budget Alert: ${payload.projectCode}`,
      message: `Project ${payload.projectCode} has used ${payload.usedPercent}% of its quoted budget. Review expenses immediately.`,
      priority: NotificationPriority.URGENT,
      metadata: { projectId: payload.projectId },
    });
  }
});

onEvent('project.completed', async (payload: { organizationId: string; projectId: string; projectCode: string }) => {
  const admins = await getAdminUserIds(payload.organizationId);
  for (const userId of admins) {
    await createNotification({
      organizationId: payload.organizationId,
      userId, projectId: payload.projectId,
      type: NotificationType.PROJECT_COMPLETED,
      title: `Project Completed: ${payload.projectCode}`,
      message: `Project ${payload.projectCode} has been marked as completed. Review final profit report.`,
      priority: NotificationPriority.LOW,
      metadata: { projectId: payload.projectId },
    });
  }
});

onEvent('payment.received', async (payload: { organizationId: string; invoiceId: string; invoiceCode: string; amount: number }) => {
  const admins = await getAdminUserIds(payload.organizationId);
  for (const userId of admins) {
    await createNotification({
      organizationId: payload.organizationId,
      userId,
      type: NotificationType.PAYMENT_RECEIVED,
      title: `Payment Received: ${payload.invoiceCode}`,
      message: `Payment of SGD $${(payload.amount as number).toFixed(2)} received for invoice ${payload.invoiceCode}.`,
      priority: NotificationPriority.LOW,
      metadata: { invoiceId: payload.invoiceId },
    });
  }
});

onEvent('inventory.low_stock', async (payload: { organizationId: string; itemId: string; itemName: string; availableQuantity: number; minStockLevel: number }) => {
  const admins = await getAdminUserIds(payload.organizationId);
  for (const userId of admins) {
    await createNotification({
      organizationId: payload.organizationId,
      userId,
      type: NotificationType.INVENTORY_LOW_STOCK,
      title: `Low Stock Alert: ${payload.itemName}`,
      message: `${payload.itemName} stock is low (${payload.availableQuantity} remaining, minimum: ${payload.minStockLevel}). Consider reordering.`,
      priority: NotificationPriority.MEDIUM,
      metadata: { itemId: payload.itemId },
    });
  }
});

onEvent('equipment.maintenance_due', async (payload: {
  organizationId: string; itemId?: string; assetUnitId?: string; assetTag?: string; itemName: string; dueDate: Date;
}) => {
  const admins = await getAdminUserIds(payload.organizationId);
  const label = payload.assetTag ? `${payload.itemName} (${payload.assetTag})` : payload.itemName;
  for (const userId of admins) {
    await createNotification({
      organizationId: payload.organizationId,
      userId,
      type: NotificationType.EQUIPMENT_MAINTENANCE_DUE,
      title: `Maintenance Due: ${label}`,
      message: `${label} is due for maintenance on ${new Date(payload.dueDate).toLocaleDateString('en-SG')}.`,
      priority: NotificationPriority.MEDIUM,
      metadata: { itemId: payload.itemId, assetUnitId: payload.assetUnitId },
    });
  }
});

// GET /notifications
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.sub;
    const { skip, take, page, limit } = parsePagination(req.query as Record<string, unknown>);
    const isReadParam = req.query['isRead'];
    const isRead = isReadParam === 'true' ? true : isReadParam === 'false' ? false : undefined;

    const where = {
      userId,
      ...(isRead !== undefined && { isRead }),
      isResolved: false,
    };

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.notification.count({ where }),
    ]);

    res.json({ success: true, data: { data: notifications, meta: buildPaginationMeta(total, page, limit) } });
  } catch (e) { next(e); }
});

// GET /notifications/unread-count
router.get('/unread-count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user!.sub, isRead: false, isResolved: false },
    });
    res.json({ success: true, data: count });
  } catch (e) { next(e); }
});

// PATCH /notifications/read-all
router.patch('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.sub, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true, data: { message: 'All notifications marked as read' } });
  } catch (e) { next(e); }
});

// PATCH /notifications/:id/read
router.patch('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const n = await prisma.notification.update({
      where: { id: req.params['id'] }, data: { isRead: true },
    });
    res.json({ success: true, data: n });
  } catch (e) { next(e); }
});

// PATCH /notifications/:id/resolve
router.patch('/:id/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { note } = req.body as { note?: string };
    const n = await prisma.notification.update({
      where: { id: req.params['id'] },
      data: { isResolved: true, resolvedAt: new Date(), resolvedNote: note },
    });
    res.json({ success: true, data: n });
  } catch (e) { next(e); }
});

export default router;
