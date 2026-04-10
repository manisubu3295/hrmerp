import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { parsePagination, buildPaginationMeta } from '../lib/pagination';
import { AppError } from '../middleware/error.middleware';
import { requireRoles } from '../middleware/auth.middleware';
import { UserRole } from '@sankoerp/shared';
import { Prisma } from '@prisma/client';
import { emitEvent } from '../lib/events';

const router = Router();

// GET /equipment/categories
router.get('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.equipmentCategory.findMany({
      include: { _count: { select: { items: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: categories });
  } catch (e) { next(e); }
});

// POST /equipment/categories
router.post('/categories', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await prisma.equipmentCategory.create({ data: req.body });
    res.status(201).json({ success: true, data: category });
  } catch (e) { next(e); }
});

// GET /equipment/items
router.get('/items', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query as Record<string, unknown>);
    const { search, categoryId } = req.query as unknown as Record<string, string | undefined>;

    const where: Prisma.EquipmentItemWhereInput = {
      isActive: true,
      ...(categoryId && { categoryId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { itemCode: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.equipmentItem.findMany({
        where, skip, take,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
      }),
      prisma.equipmentItem.count({ where }),
    ]);

    res.json({ success: true, data: { data: items, meta: buildPaginationMeta(total, page, limit) } });
  } catch (e) { next(e); }
});

// POST /equipment/items
router.post('/items', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await prisma.equipmentItem.count();
    const itemCode = `ITM-${String(count + 1).padStart(4, '0')}`;
    const dto = req.body;
    const item = await prisma.equipmentItem.create({
      data: {
        itemCode, name: dto.name, description: dto.description,
        categoryId: dto.categoryId, unit: dto.unit ?? 'unit',
        unitCost: dto.unitCost, depreciationRate: dto.depreciationRate ?? 0,
        usefulLifeDays: dto.usefulLifeDays, minStockLevel: dto.minStockLevel ?? 5,
        supplierName: dto.supplierName, supplierContact: dto.supplierContact,
      },
      include: { category: true },
    });
    res.status(201).json({ success: true, data: item });
  } catch (e) { next(e); }
});

// GET /equipment/items/:id
router.get('/items/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.equipmentItem.findUnique({
      where: { id: req.params['id'] },
      include: {
        category: true,
        purchases: { orderBy: { purchaseDate: 'desc' }, take: 10 },
        issues: {
          where: { returnedAt: null },
          include: {
            project: { select: { id: true, projectCode: true, name: true } },
            employee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!item) throw new AppError(404, `Equipment item ${req.params['id']} not found`);
    res.json({ success: true, data: item });
  } catch (e) { next(e); }
});

// POST /equipment/purchases
router.post('/purchases', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = req.body;
    const item = await prisma.equipmentItem.findUnique({ where: { id: dto.itemId } });
    if (!item) throw new AppError(404, 'Equipment item not found');

    const purchase = await prisma.equipmentPurchase.create({
      data: {
        itemId: dto.itemId, quantity: dto.quantity, unitCost: dto.unitCost,
        totalCost: dto.quantity * dto.unitCost,
        purchaseDate: new Date(dto.purchaseDate),
        supplierName: dto.supplierName, invoiceRef: dto.invoiceRef, notes: dto.notes,
      },
    });

    await prisma.equipmentItem.update({
      where: { id: dto.itemId },
      data: {
        totalQuantity: { increment: dto.quantity },
        availableQuantity: { increment: dto.quantity },
        unitCost: dto.unitCost,
      },
    });

    res.status(201).json({ success: true, data: purchase });
  } catch (e) { next(e); }
});

// POST /equipment/issues
router.post('/issues', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = req.body;
    const item = await prisma.equipmentItem.findUnique({ where: { id: dto.itemId } });
    if (!item) throw new AppError(404, 'Equipment item not found');
    if (item.availableQuantity < dto.quantity) {
      throw new AppError(400, `Insufficient stock. Available: ${item.availableQuantity}, Requested: ${dto.quantity}`);
    }

    const totalCost = dto.quantity * Number(item.unitCost);
    const issue = await prisma.equipmentIssue.create({
      data: {
        itemId: dto.itemId, projectId: dto.projectId, employeeId: dto.employeeId,
        quantity: dto.quantity, unitCost: item.unitCost, totalCost, type: 'ISSUE', notes: dto.notes,
      },
      include: {
        item: { select: { id: true, name: true, itemCode: true } },
        project: { select: { id: true, projectCode: true, name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await prisma.equipmentItem.update({
      where: { id: dto.itemId },
      data: { availableQuantity: { decrement: dto.quantity } },
    });

    const updated = await prisma.equipmentItem.findUnique({ where: { id: dto.itemId } });
    if (updated && updated.availableQuantity <= updated.minStockLevel) {
      emitEvent('inventory.low_stock', {
        itemId: dto.itemId, itemName: item.name,
        availableQuantity: updated.availableQuantity, minStockLevel: updated.minStockLevel,
      });
    }

    res.status(201).json({ success: true, data: issue });
  } catch (e) { next(e); }
});

// PATCH /equipment/issues/:id/return
router.patch('/issues/:id/return', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const issue = await prisma.equipmentIssue.findUnique({
      where: { id: req.params['id'] }, include: { item: true },
    });
    if (!issue) throw new AppError(404, 'Issue record not found');
    if (issue.returnedAt) throw new AppError(400, 'Equipment already returned');

    const dto = req.body as { returnedQty: number; lostDamagedQty?: number; condition?: string; notes?: string };
    const totalReturnQty = dto.returnedQty + (dto.lostDamagedQty ?? 0);
    if (totalReturnQty > issue.quantity) {
      throw new AppError(400, 'Return quantity exceeds issued quantity');
    }

    const lostCost = (dto.lostDamagedQty ?? 0) * Number(issue.unitCost);

    await prisma.equipmentItem.update({
      where: { id: issue.itemId },
      data: { availableQuantity: { increment: dto.returnedQty } },
    });

    const updated = await prisma.equipmentIssue.update({
      where: { id: req.params['id'] },
      data: {
        returnedAt: new Date(), returnedQty: dto.returnedQty,
        lostDamagedQty: dto.lostDamagedQty ?? 0, lostDamagedCost: lostCost,
        condition: dto.condition, notes: dto.notes,
        type: (dto.lostDamagedQty ?? 0) > 0 ? 'DAMAGE' : 'RETURN',
      },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// GET /equipment/summary
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [items, lowStock, totalValue] = await Promise.all([
      prisma.equipmentItem.count({ where: { isActive: true } }),
      prisma.equipmentItem.count({ where: { isActive: true, availableQuantity: { lte: 5 } } }),
      prisma.equipmentItem.aggregate({ _sum: { availableQuantity: true } }),
    ]);
    res.json({
      success: true,
      data: { totalItems: items, lowStockItems: lowStock, totalUnitsInStock: totalValue._sum.availableQuantity ?? 0 },
    });
  } catch (e) { next(e); }
});

// PATCH /equipment/items/:id/status — toggles isActive (RETIRED = inactive)
router.patch('/items/:id/status', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body as { status: string };
    const valid = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED'];
    if (!valid.includes(status)) throw new AppError(400, `Invalid status. Must be one of: ${valid.join(', ')}`);
    // RETIRED maps to isActive=false; all others set isActive=true
    const item = await prisma.equipmentItem.update({
      where: { id: req.params['id'] },
      data: { isActive: status !== 'RETIRED' },
      include: { category: true },
    });
    res.json({ success: true, data: item });
  } catch (e) { next(e); }
});

export default router;
