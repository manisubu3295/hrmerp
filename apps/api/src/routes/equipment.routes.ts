import { Router, Request, Response, NextFunction } from 'express';
import prisma, { prismaUnscoped } from '../lib/prisma';
import { parsePagination, buildPaginationMeta } from '../lib/pagination';
import { AppError } from '../middleware/error.middleware';
import { requirePermission } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { Prisma, EquipmentTrackingMode, AssetUnitStatus } from '@prisma/client';
import { emitEvent } from '../lib/events';
import { nextSequentialCode, withCodeRetry } from '../lib/codes';
import {
  createWarehouseSchema,
  createCategorySchema,
  createEquipmentItemSchema,
  updateEquipmentItemSchema,
  createPurchaseSchema,
  createIssueSchema,
  returnIssueSchema,
  createMaintenanceRecordSchema,
  runDepreciationSchema,
} from '../schemas/equipment.schema';

const router = Router();

// ─── Warehouses ────────────────────────────────────────────────────────────
router.get('/warehouses', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouses = await prisma.warehouse.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data: warehouses });
  } catch (e) { next(e); }
});

router.post('/warehouses', requirePermission('warehouse:manage'), validate(createWarehouseSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouse = await prisma.warehouse.create({
      data: { organizationId: req.organizationId as string, ...req.body },
    });
    res.status(201).json({ success: true, data: warehouse });
  } catch (e) { next(e); }
});

// ─── Categories ──────────────────────────────────────────────────────────────
router.get('/categories', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.equipmentCategory.findMany({
      include: { _count: { select: { items: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: categories });
  } catch (e) { next(e); }
});

router.post('/categories', requirePermission('equipment:manage_category'), validate(createCategorySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await prisma.equipmentCategory.create({
      data: { organizationId: req.organizationId as string, ...req.body },
    });
    res.status(201).json({ success: true, data: category });
  } catch (e) { next(e); }
});

// ─── helpers ────────────────────────────────────────────────────────────────

async function generateItemCode(): Promise<string> {
  return nextSequentialCode({
    prefix: 'ITM-',
    padLength: 4,
    findLatestCode: async (p) => {
      const row = await prisma.equipmentItem.findFirst({
        where: { itemCode: { startsWith: p } },
        orderBy: { itemCode: 'desc' },
        select: { itemCode: true },
      });
      return row?.itemCode ?? null;
    },
  });
}

async function generateAssetTag(itemCode: string): Promise<string> {
  const prefix = `${itemCode}-`;
  return nextSequentialCode({
    prefix,
    padLength: 4,
    findLatestCode: async (p) => {
      const row = await prisma.assetUnit.findFirst({
        where: { assetTag: { startsWith: p } },
        orderBy: { assetTag: 'desc' },
        select: { assetTag: true },
      });
      return row?.assetTag ?? null;
    },
  });
}

/** On-hand quantity for a BULK item across all warehouses (or one). */
async function bulkOnHand(itemId: string, warehouseId?: string): Promise<number> {
  const stocks = await prisma.warehouseStock.findMany({
    where: { itemId, ...(warehouseId && { warehouseId }) },
    select: { quantityOnHand: true },
  });
  return stocks.reduce((s, w) => s + w.quantityOnHand, 0);
}

// ─── Items ──────────────────────────────────────────────────────────────────
router.get('/items', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query as Record<string, unknown>);
    const { search, categoryId, trackingMode, isActive } = req.query as unknown as Record<string, string | undefined>;

    const where: Prisma.EquipmentItemWhereInput = {
      isActive: isActive === 'false' ? false : true,
      ...(categoryId && { categoryId }),
      ...(trackingMode && { trackingMode: trackingMode as EquipmentTrackingMode }),
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
        include: {
          category: { select: { id: true, name: true } },
          warehouseStocks: { select: { quantityOnHand: true } },
          assetUnits: { where: { status: 'IN_STOCK' }, select: { id: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.equipmentItem.count({ where }),
    ]);

    const enriched = items.map((item) => {
      const { warehouseStocks, assetUnits, ...rest } = item;
      const onHand = item.trackingMode === 'SERIALIZED'
        ? assetUnits.length
        : warehouseStocks.reduce((s, w) => s + w.quantityOnHand, 0);
      return { ...rest, onHand };
    });

    res.json({ success: true, data: { data: enriched, meta: buildPaginationMeta(total, page, limit) } });
  } catch (e) { next(e); }
});

router.post('/items', requirePermission('equipment:create'), validate(createEquipmentItemSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = req.body;
    const item = await withCodeRetry(async () => {
      const itemCode = await generateItemCode();
      return prisma.equipmentItem.create({
        data: { organizationId: req.organizationId as string, itemCode, ...dto },
        include: { category: true },
      });
    }, 'itemCode');
    res.status(201).json({ success: true, data: item });
  } catch (e) { next(e); }
});

router.get('/items/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.equipmentItem.findUnique({
      where: { id: req.params['id'] },
      include: {
        category: true,
        warehouseStocks: { include: { warehouse: { select: { id: true, code: true, name: true } } } },
        assetUnits: {
          include: { warehouse: { select: { id: true, code: true, name: true } } },
          orderBy: { assetTag: 'asc' },
        },
        purchases: { orderBy: { purchaseDate: 'desc' }, take: 10 },
        issues: {
          where: { returnedAt: null },
          include: {
            project: { select: { id: true, projectCode: true, name: true } },
            employee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        maintenanceRecords: { orderBy: { performedAt: 'desc' }, take: 10 },
      },
    });
    if (!item) throw new AppError(404, `Equipment item ${req.params['id']} not found`);
    res.json({ success: true, data: item });
  } catch (e) { next(e); }
});

router.patch('/items/:id', requirePermission('equipment:update'), validate(updateEquipmentItemSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.equipmentItem.findUnique({ where: { id: req.params['id'] } });
    if (!existing) throw new AppError(404, `Equipment item ${req.params['id']} not found`);
    const item = await prisma.equipmentItem.update({
      where: { id: req.params['id'] },
      data: req.body,
      include: { category: true },
    });
    res.json({ success: true, data: item });
  } catch (e) { next(e); }
});

// PATCH /equipment/items/:id/status — toggles isActive (RETIRED = inactive).
// Only meaningful for BULK items: SERIALIZED items track status per unit —
// see PATCH /asset-units/:id/status instead.
router.patch('/items/:id/status', requirePermission('equipment:update'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body as { status: string };
    const valid = ['AVAILABLE', 'RETIRED'];
    if (!valid.includes(status)) throw new AppError(400, `Invalid status. Must be one of: ${valid.join(', ')}`);
    const item = await prisma.equipmentItem.update({
      where: { id: req.params['id'] },
      data: { isActive: status !== 'RETIRED' },
      include: { category: true },
    });
    res.json({ success: true, data: item });
  } catch (e) { next(e); }
});

// ─── Purchases ──────────────────────────────────────────────────────────────
router.post('/purchases', requirePermission('equipment:purchase'), validate(createPurchaseSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = req.body;
    const item = await prisma.equipmentItem.findUnique({ where: { id: dto.itemId } });
    if (!item) throw new AppError(404, 'Equipment item not found');
    const warehouse = await prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse) throw new AppError(404, 'Warehouse not found');

    if (item.trackingMode === 'SERIALIZED' && !dto.serialNumbers) {
      throw new AppError(400, 'serialNumbers is required when purchasing a serialized item');
    }

    const totalCost = dto.quantity * dto.unitCost;

    const purchase = await withCodeRetry(async () => {
      const receiptCode = await nextSequentialCode({
        prefix: `GRN-${new Date().getFullYear()}-`,
        padLength: 4,
        findLatestCode: async (p) => {
          const row = await prisma.equipmentPurchase.findFirst({
            where: { receiptCode: { startsWith: p } },
            orderBy: { receiptCode: 'desc' },
            select: { receiptCode: true },
          });
          return row?.receiptCode ?? null;
        },
      });
      return prisma.equipmentPurchase.create({
        data: {
          organizationId: req.organizationId as string,
          itemId: dto.itemId, warehouseId: dto.warehouseId, receiptCode,
          quantity: dto.quantity, unitCost: dto.unitCost, totalCost,
          purchaseDate: new Date(dto.purchaseDate),
          supplierId: dto.supplierId, supplierName: dto.supplierName,
          invoiceRef: dto.invoiceRef, notes: dto.notes,
        },
      });
    }, 'receiptCode');

    if (item.trackingMode === 'SERIALIZED') {
      for (const serialNumber of dto.serialNumbers as string[]) {
        const assetTag = await generateAssetTag(item.itemCode);
        await prisma.assetUnit.create({
          data: {
            organizationId: req.organizationId as string,
            itemId: dto.itemId, warehouseId: dto.warehouseId,
            assetTag, serialNumber, status: 'IN_STOCK',
            purchaseCost: dto.unitCost, purchaseDate: new Date(dto.purchaseDate),
          },
        });
      }
    } else {
      await prisma.warehouseStock.upsert({
        where: { itemId_warehouseId: { itemId: dto.itemId, warehouseId: dto.warehouseId } },
        update: { quantityOnHand: { increment: dto.quantity } },
        create: { organizationId: req.organizationId as string, itemId: dto.itemId, warehouseId: dto.warehouseId, quantityOnHand: dto.quantity },
      });
    }

    // Last-purchase-price costing (not weighted-average) — matches the
    // pre-existing behavior of this module, not a new simplification.
    await prisma.equipmentItem.update({ where: { id: dto.itemId }, data: { unitCost: dto.unitCost } });

    res.status(201).json({ success: true, data: purchase });
  } catch (e) { next(e); }
});

// ─── Issues ─────────────────────────────────────────────────────────────────
router.post('/issues', requirePermission('equipment:issue'), validate(createIssueSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = req.body;
    const item = await prisma.equipmentItem.findUnique({ where: { id: dto.itemId } });
    if (!item) throw new AppError(404, 'Equipment item not found');

    let unitCost: number;
    let quantity: number;

    if (dto.assetUnitId) {
      const assetUnit = await prisma.assetUnit.findUnique({ where: { id: dto.assetUnitId } });
      if (!assetUnit) throw new AppError(404, 'Asset unit not found');
      if (assetUnit.status !== 'IN_STOCK') throw new AppError(400, `Asset unit is not available (status: ${assetUnit.status})`);
      if (assetUnit.warehouseId !== dto.warehouseId) throw new AppError(400, 'Asset unit is not at the specified warehouse');
      unitCost = Number(assetUnit.purchaseCost);
      quantity = 1;
      await prisma.assetUnit.update({
        where: { id: dto.assetUnitId },
        data: { status: 'ISSUED', currentEmployeeId: dto.employeeId, currentProjectId: dto.projectId },
      });
    } else {
      quantity = dto.quantity;
      const onHand = await bulkOnHand(dto.itemId, dto.warehouseId);
      if (onHand < quantity) {
        throw new AppError(400, `Insufficient stock at this warehouse. Available: ${onHand}, Requested: ${quantity}`);
      }
      unitCost = Number(item.unitCost);
      await prisma.warehouseStock.update({
        where: { itemId_warehouseId: { itemId: dto.itemId, warehouseId: dto.warehouseId } },
        data: { quantityOnHand: { decrement: quantity } },
      });
    }

    const totalCost = quantity * unitCost;
    const issue = await prisma.equipmentIssue.create({
      data: {
        organizationId: req.organizationId as string,
        itemId: dto.itemId, warehouseId: dto.warehouseId, assetUnitId: dto.assetUnitId ?? undefined,
        projectId: dto.projectId, employeeId: dto.employeeId,
        quantity, unitCost, totalCost, type: 'ISSUE', notes: dto.notes,
      },
      include: {
        item: { select: { id: true, name: true, itemCode: true } },
        project: { select: { id: true, projectCode: true, name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!dto.assetUnitId) {
      const remaining = await bulkOnHand(dto.itemId, dto.warehouseId);
      if (remaining <= item.minStockLevel) {
        emitEvent('inventory.low_stock', {
          organizationId: req.organizationId, itemId: dto.itemId, itemName: item.name,
          availableQuantity: remaining, minStockLevel: item.minStockLevel,
        });
      }
    }

    res.status(201).json({ success: true, data: issue });
  } catch (e) { next(e); }
});

// PATCH /equipment/issues/:id/return
router.patch('/issues/:id/return', requirePermission('equipment:return'), validate(returnIssueSchema), async (req: Request, res: Response, next: NextFunction) => {
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

    if (issue.assetUnitId) {
      const isLostOrDamaged = (dto.lostDamagedQty ?? 0) >= 1;
      const nextStatus: AssetUnitStatus = isLostOrDamaged
        ? (dto.condition?.toUpperCase() === 'LOST' ? 'LOST' : 'DAMAGED')
        : 'IN_STOCK';
      await prisma.assetUnit.update({
        where: { id: issue.assetUnitId },
        data: { status: nextStatus, currentEmployeeId: null, currentProjectId: null },
      });
    } else {
      await prisma.warehouseStock.update({
        where: { itemId_warehouseId: { itemId: issue.itemId, warehouseId: issue.warehouseId } },
        data: { quantityOnHand: { increment: dto.returnedQty } },
      });
    }

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

// ─── Asset Units ────────────────────────────────────────────────────────────
router.get('/asset-units', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query as Record<string, unknown>);
    const { itemId, warehouseId, status } = req.query as Record<string, string | undefined>;
    const where: Prisma.AssetUnitWhereInput = {
      ...(itemId && { itemId }),
      ...(warehouseId && { warehouseId }),
      ...(status && { status: status as AssetUnitStatus }),
    };
    const [units, total] = await Promise.all([
      prisma.assetUnit.findMany({
        where, skip, take,
        include: {
          item: { select: { id: true, name: true, itemCode: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          currentEmployee: { select: { id: true, firstName: true, lastName: true } },
          currentProject: { select: { id: true, projectCode: true, name: true } },
        },
        orderBy: { assetTag: 'asc' },
      }),
      prisma.assetUnit.count({ where }),
    ]);
    res.json({ success: true, data: { data: units, meta: buildPaginationMeta(total, page, limit) } });
  } catch (e) { next(e); }
});

router.get('/asset-units/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const unit = await prisma.assetUnit.findUnique({
      where: { id: req.params['id'] },
      include: {
        item: { select: { id: true, name: true, itemCode: true, depreciationRate: true, usefulLifeDays: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        currentEmployee: { select: { id: true, firstName: true, lastName: true } },
        currentProject: { select: { id: true, projectCode: true, name: true } },
        maintenanceRecords: { orderBy: { performedAt: 'desc' } },
        depreciationEntries: { orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }] },
      },
    });
    if (!unit) throw new AppError(404, `Asset unit ${req.params['id']} not found`);
    res.json({ success: true, data: unit });
  } catch (e) { next(e); }
});

router.patch('/asset-units/:id/status', requirePermission('equipment:update'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body as { status: AssetUnitStatus };
    const valid: AssetUnitStatus[] = ['IN_STOCK', 'IN_MAINTENANCE', 'RETIRED', 'DISPOSED'];
    if (!valid.includes(status)) throw new AppError(400, `Invalid status. Must be one of: ${valid.join(', ')}`);
    const unit = await prisma.assetUnit.findUnique({ where: { id: req.params['id'] } });
    if (!unit) throw new AppError(404, 'Asset unit not found');
    if (unit.status === 'ISSUED' && status !== 'IN_MAINTENANCE') {
      throw new AppError(400, 'Cannot change status of an issued asset — return it first');
    }
    const updated = await prisma.assetUnit.update({ where: { id: req.params['id'] }, data: { status } });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// ─── Maintenance ────────────────────────────────────────────────────────────
router.post('/maintenance-records', requirePermission('equipment:manage_maintenance'), validate(createMaintenanceRecordSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = req.body;
    const record = await prisma.maintenanceRecord.create({
      data: {
        organizationId: req.organizationId as string,
        itemId: dto.itemId ?? undefined, assetUnitId: dto.assetUnitId ?? undefined,
        performedAt: new Date(dto.performedAt), performedBy: dto.performedBy,
        description: dto.description, cost: dto.cost, vendorId: dto.vendorId,
        nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : undefined, notes: dto.notes,
      },
    });

    if (dto.nextDueDate) {
      if (dto.assetUnitId) {
        await prisma.assetUnit.update({ where: { id: dto.assetUnitId }, data: { nextMaintenanceAt: new Date(dto.nextDueDate) } });
      } else if (dto.itemId) {
        await prisma.equipmentItem.update({ where: { id: dto.itemId }, data: { nextMaintenanceAt: new Date(dto.nextDueDate) } });
      }
    }

    res.status(201).json({ success: true, data: record });
  } catch (e) { next(e); }
});

router.get('/maintenance-records', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query as Record<string, unknown>);
    const { itemId, assetUnitId } = req.query as Record<string, string | undefined>;
    const where: Prisma.MaintenanceRecordWhereInput = { ...(itemId && { itemId }), ...(assetUnitId && { assetUnitId }) };
    const [records, total] = await Promise.all([
      prisma.maintenanceRecord.findMany({
        where, skip, take,
        include: {
          item: { select: { id: true, name: true, itemCode: true } },
          assetUnit: { select: { id: true, assetTag: true } },
          vendor: { select: { id: true, name: true } },
        },
        orderBy: { performedAt: 'desc' },
      }),
      prisma.maintenanceRecord.count({ where }),
    ]);
    res.json({ success: true, data: { data: records, meta: buildPaginationMeta(total, page, limit) } });
  } catch (e) { next(e); }
});

// ─── Depreciation ───────────────────────────────────────────────────────────
// Straight-line depreciation, assuming zero residual value: prefers
// usefulLifeDays (monthly amount = cost / (usefulLifeDays/30)) over
// depreciationRate (annual %, monthly amount = cost * rate / 12) when both
// are set on the item. Serialized assets only — see WS0 context note.
router.post('/depreciation/run', requirePermission('equipment:run_depreciation'), validate(runDepreciationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month, year } = req.body as { month: number; year: number };

    const units = await prisma.assetUnit.findMany({
      where: { status: { notIn: ['RETIRED', 'DISPOSED'] } },
      include: { item: { select: { depreciationRate: true, usefulLifeDays: true } } },
    });

    const entries: unknown[] = [];
    for (const unit of units) {
      const cost = Number(unit.purchaseCost);
      let monthlyDep = 0;
      if (unit.item.usefulLifeDays && unit.item.usefulLifeDays > 0) {
        monthlyDep = cost / (unit.item.usefulLifeDays / 30);
      } else if (Number(unit.item.depreciationRate) > 0) {
        monthlyDep = (cost * Number(unit.item.depreciationRate)) / 12;
      } else {
        continue; // nothing configured to depreciate this asset against
      }

      const priorEntries = await prisma.depreciationEntry.findMany({
        where: {
          assetUnitId: unit.id,
          OR: [{ periodYear: { lt: year } }, { periodYear: year, periodMonth: { lt: month } }],
        },
        select: { depreciationAmount: true },
      });
      const openingAccumulated = priorEntries.reduce((s, e) => s + Number(e.depreciationAmount), 0);
      if (openingAccumulated >= cost) continue; // fully depreciated already

      const cappedMonthlyDep = Math.min(monthlyDep, cost - openingAccumulated);
      const accumulatedDepreciation = openingAccumulated + cappedMonthlyDep;
      const bookValue = Math.max(0, cost - accumulatedDepreciation);

      const entry = await prisma.depreciationEntry.upsert({
        where: { assetUnitId_periodMonth_periodYear: { assetUnitId: unit.id, periodMonth: month, periodYear: year } },
        update: { depreciationAmount: cappedMonthlyDep, accumulatedDepreciation, bookValue },
        create: {
          organizationId: req.organizationId as string,
          assetUnitId: unit.id, periodMonth: month, periodYear: year,
          depreciationAmount: cappedMonthlyDep, accumulatedDepreciation, bookValue,
        },
      });
      entries.push(entry);
    }

    res.json({ success: true, data: { month, year, entriesGenerated: entries.length, entries } });
  } catch (e) { next(e); }
});

router.get('/depreciation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assetUnitId, month, year } = req.query as Record<string, string | undefined>;
    const where: Prisma.DepreciationEntryWhereInput = {
      ...(assetUnitId && { assetUnitId }),
      ...(month && { periodMonth: Number(month) }),
      ...(year && { periodYear: Number(year) }),
    };
    const entries = await prisma.depreciationEntry.findMany({
      where,
      include: { assetUnit: { select: { id: true, assetTag: true, item: { select: { name: true, itemCode: true } } } } },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });
    res.json({ success: true, data: entries });
  } catch (e) { next(e); }
});

// ─── Summary ────────────────────────────────────────────────────────────────
router.get('/summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [items, stocks, serializedInStock] = await Promise.all([
      prisma.equipmentItem.findMany({ where: { isActive: true }, select: { id: true, minStockLevel: true, trackingMode: true } }),
      prisma.warehouseStock.findMany({ select: { itemId: true, quantityOnHand: true } }),
      prisma.assetUnit.count({ where: { status: 'IN_STOCK' } }),
    ]);

    const onHandByItem = new Map<string, number>();
    for (const s of stocks) onHandByItem.set(s.itemId, (onHandByItem.get(s.itemId) ?? 0) + s.quantityOnHand);

    let lowStockItems = 0;
    let totalUnitsInStock = serializedInStock;
    for (const item of items) {
      if (item.trackingMode !== 'BULK') continue;
      const onHand = onHandByItem.get(item.id) ?? 0;
      totalUnitsInStock += onHand;
      if (onHand <= item.minStockLevel) lowStockItems++;
    }

    res.json({ success: true, data: { totalItems: items.length, lowStockItems, totalUnitsInStock } });
  } catch (e) { next(e); }
});

// ─── Scheduled scan (exported for the cron job in main.ts) ──────────────────
// Uses prismaUnscoped: cross-tenant system job, same pattern as
// compliance.routes.ts::checkWorkPassExpiries.
export async function checkEquipmentMaintenanceDue(): Promise<void> {
  const today = new Date();
  const soon = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const dueItems = await prismaUnscoped.equipmentItem.findMany({
    where: { isActive: true, nextMaintenanceAt: { lte: soon } },
    select: { id: true, organizationId: true, name: true, nextMaintenanceAt: true },
  });
  for (const item of dueItems) {
    emitEvent('equipment.maintenance_due', {
      organizationId: item.organizationId, itemId: item.id, itemName: item.name,
      dueDate: item.nextMaintenanceAt,
    });
  }

  const dueUnits = await prismaUnscoped.assetUnit.findMany({
    where: { status: { notIn: ['RETIRED', 'DISPOSED'] }, nextMaintenanceAt: { lte: soon } },
    select: { id: true, organizationId: true, assetTag: true, nextMaintenanceAt: true, item: { select: { name: true } } },
  });
  for (const unit of dueUnits) {
    emitEvent('equipment.maintenance_due', {
      organizationId: unit.organizationId, assetUnitId: unit.id, assetTag: unit.assetTag,
      itemName: unit.item.name, dueDate: unit.nextMaintenanceAt,
    });
  }
}

export default router;
