import { z } from 'zod';
import { EquipmentTrackingMode } from '@prisma/client';

export const createWarehouseSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  address: z.string().optional().nullable(),
  isDefault: z.boolean().optional().default(false),
});

export const createCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
});

export const createEquipmentItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  categoryId: z.string().min(1),
  unit: z.string().optional().default('unit'),
  unitCost: z.number().min(0),
  trackingMode: z.nativeEnum(EquipmentTrackingMode).optional().default(EquipmentTrackingMode.BULK),
  minStockLevel: z.number().int().min(0).optional().default(5),
  reorderQty: z.number().int().min(0).optional().nullable(),
  depreciationRate: z.number().min(0).max(1).optional().default(0),
  usefulLifeDays: z.number().int().min(0).optional().nullable(),
  supplierName: z.string().optional().nullable(),
  supplierContact: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
});

export const updateEquipmentItemSchema = createEquipmentItemSchema.partial();

export const createPurchaseSchema = z
  .object({
    itemId: z.string().min(1),
    warehouseId: z.string().min(1),
    quantity: z.number().int().positive(),
    unitCost: z.number().min(0),
    purchaseDate: z.string(),
    supplierId: z.string().optional().nullable(),
    supplierName: z.string().optional().nullable(),
    invoiceRef: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    serialNumbers: z.array(z.string().min(1)).optional(),
  })
  .refine((d) => !d.serialNumbers || d.serialNumbers.length === d.quantity, {
    message: 'serialNumbers must have exactly `quantity` entries for a serialized item',
    path: ['serialNumbers'],
  });

export const createIssueSchema = z.object({
  itemId: z.string().min(1),
  warehouseId: z.string().min(1),
  assetUnitId: z.string().optional().nullable(),
  projectId: z.string().min(1),
  employeeId: z.string().min(1),
  quantity: z.number().int().positive().optional().default(1),
  notes: z.string().optional().nullable(),
});

export const returnIssueSchema = z.object({
  returnedQty: z.number().int().min(0),
  lostDamagedQty: z.number().int().min(0).optional().default(0),
  condition: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const createMaintenanceRecordSchema = z
  .object({
    itemId: z.string().optional().nullable(),
    assetUnitId: z.string().optional().nullable(),
    performedAt: z.string(),
    performedBy: z.string().optional().nullable(),
    description: z.string().min(1),
    cost: z.number().min(0).optional().default(0),
    vendorId: z.string().optional().nullable(),
    nextDueDate: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .refine((d) => (!!d.itemId) !== (!!d.assetUnitId), {
    message: 'Exactly one of itemId or assetUnitId must be set',
    path: ['assetUnitId'],
  });

export const runDepreciationSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
});
