import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { parsePagination, buildPaginationMeta } from '../lib/pagination';
import { AppError } from '../middleware/error.middleware';
import { requirePermission } from '../middleware/auth.middleware';
import { Prisma } from '@prisma/client';

const router = Router();

// GET /suppliers
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query as Record<string, unknown>);
    const { search, active } = req.query as Record<string, string | undefined>;

    const where: Prisma.SupplierWhereInput = {
      ...(active !== undefined && { isActive: active === 'true' }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { supplierCode: { contains: search, mode: 'insensitive' } },
          { contactPerson: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where, skip, take,
        include: { _count: { select: { equipmentItems: true } } },
        orderBy: { name: 'asc' },
      }),
      prisma.supplier.count({ where }),
    ]);

    res.json({ success: true, data: { data: suppliers, meta: buildPaginationMeta(total, page, limit) } });
  } catch (e) { next(e); }
});

// GET /suppliers/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.params['id'] },
      include: {
        equipmentItems: {
          select: { id: true, itemCode: true, name: true, trackingMode: true, isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!supplier) throw new AppError(404, 'Supplier not found');
    res.json({ success: true, data: supplier });
  } catch (e) { next(e); }
});

// POST /suppliers
router.post('/', requirePermission('supplier:create'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await prisma.supplier.count();
    const supplierCode = `SUP-${String(count + 1).padStart(4, '0')}`;
    const dto = req.body as {
      name: string; contactPerson?: string; email?: string; phone?: string;
      address?: string; city?: string; country?: string; taxId?: string; notes?: string;
    };

    if (!dto.name?.trim()) throw new AppError(400, 'Supplier name is required');

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: req.organizationId as string,
        supplierCode, name: dto.name.trim(),
        contactPerson: dto.contactPerson, email: dto.email, phone: dto.phone,
        address: dto.address, city: dto.city, country: dto.country,
        taxId: dto.taxId, notes: dto.notes,
      },
    });
    res.status(201).json({ success: true, data: supplier });
  } catch (e) { next(e); }
});

// PATCH /suppliers/:id
router.patch('/:id', requirePermission('supplier:update'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.supplier.findUnique({ where: { id: req.params['id'] } });
    if (!existing) throw new AppError(404, 'Supplier not found');

    const dto = req.body as Partial<{
      name: string; contactPerson: string; email: string; phone: string;
      address: string; city: string; country: string; taxId: string; notes: string; isActive: boolean;
    }>;

    const supplier = await prisma.supplier.update({
      where: { id: req.params['id'] },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.contactPerson !== undefined && { contactPerson: dto.contactPerson }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.taxId !== undefined && { taxId: dto.taxId }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    res.json({ success: true, data: supplier });
  } catch (e) { next(e); }
});

// DELETE /suppliers/:id  (soft-delete by deactivating)
router.delete('/:id', requirePermission('supplier:delete'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.supplier.findUnique({
      where: { id: req.params['id'] },
      include: { _count: { select: { equipmentItems: true } } },
    });
    if (!existing) throw new AppError(404, 'Supplier not found');
    if (existing._count.equipmentItems > 0) {
      throw new AppError(400, `Cannot delete supplier linked to ${existing._count.equipmentItems} equipment item(s). Deactivate instead.`);
    }

    await prisma.supplier.delete({ where: { id: req.params['id'] } });
    res.json({ success: true, message: 'Supplier deleted' });
  } catch (e) { next(e); }
});

export default router;
