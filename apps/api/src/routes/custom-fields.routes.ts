import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { requirePermission } from '../middleware/auth.middleware';

const router = Router();

const FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'MULTI_SELECT'] as const;

// GET /custom-fields?entityType=Employee — list field definitions for an entity type
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType } = req.query as Record<string, string | undefined>;
    const definitions = await prisma.customFieldDefinition.findMany({
      where: { ...(entityType && { entityType }) },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ success: true, data: definitions });
  } catch (e) { next(e); }
});

// POST /custom-fields — create a field definition
router.post('/', requirePermission('custom_field:manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType, fieldKey, label, fieldType, options, required, sortOrder } = req.body as {
      entityType?: string; fieldKey?: string; label?: string; fieldType?: string;
      options?: unknown; required?: boolean; sortOrder?: number;
    };
    if (!entityType || !fieldKey || !label || !fieldType) {
      throw new AppError(400, 'entityType, fieldKey, label and fieldType are required');
    }
    if (!FIELD_TYPES.includes(fieldType as (typeof FIELD_TYPES)[number])) {
      throw new AppError(400, `fieldType must be one of: ${FIELD_TYPES.join(', ')}`);
    }

    const definition = await prisma.customFieldDefinition.create({
      data: {
        organizationId: req.organizationId as string,
        entityType,
        fieldKey,
        label,
        fieldType: fieldType as (typeof FIELD_TYPES)[number],
        options: options as object | undefined,
        required: required ?? false,
        sortOrder: sortOrder ?? 0,
      },
    });
    res.status(201).json({ success: true, data: definition });
  } catch (e) { next(e); }
});

// PATCH /custom-fields/:id — update a field definition
router.patch('/:id', requirePermission('custom_field:manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { label, options, required, sortOrder } = req.body as {
      label?: string; options?: unknown; required?: boolean; sortOrder?: number;
    };
    const definition = await prisma.customFieldDefinition.update({
      where: { id: req.params['id'] },
      data: {
        ...(label !== undefined && { label }),
        ...(options !== undefined && { options: options as object }),
        ...(required !== undefined && { required }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });
    res.json({ success: true, data: definition });
  } catch (e) { next(e); }
});

// DELETE /custom-fields/:id — remove a field definition (cascades to its values)
router.delete('/:id', requirePermission('custom_field:manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.customFieldDefinition.delete({ where: { id: req.params['id'] } });
    res.json({ success: true, data: { message: 'Custom field deleted' } });
  } catch (e) { next(e); }
});

// GET /custom-fields/values?entityType=Employee&entityId=abc — all values set for one entity
router.get('/values', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType, entityId } = req.query as Record<string, string | undefined>;
    if (!entityType || !entityId) throw new AppError(400, 'entityType and entityId are required');

    const values = await prisma.customFieldValue.findMany({
      where: { entityType, entityId },
      include: { fieldDefinition: true },
    });
    res.json({ success: true, data: values });
  } catch (e) { next(e); }
});

// PUT /custom-fields/values — upsert a single field's value for an entity
router.put('/values', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType, entityId, fieldDefinitionId, value } = req.body as {
      entityType?: string; entityId?: string; fieldDefinitionId?: string; value?: unknown;
    };
    if (!entityType || !entityId || !fieldDefinitionId || value === undefined) {
      throw new AppError(400, 'entityType, entityId, fieldDefinitionId and value are required');
    }

    const definition = await prisma.customFieldDefinition.findUnique({ where: { id: fieldDefinitionId } });
    if (!definition || definition.entityType !== entityType) {
      throw new AppError(404, 'Custom field definition not found for this entity type');
    }

    const saved = await prisma.customFieldValue.upsert({
      where: { entityType_entityId_fieldDefinitionId: { entityType, entityId, fieldDefinitionId } },
      update: { value: value as object },
      create: { organizationId: req.organizationId as string, entityType, entityId, fieldDefinitionId, value: value as object },
    });
    res.json({ success: true, data: saved });
  } catch (e) { next(e); }
});

export default router;
