import { INDUSTRY_PRESETS } from '@sankoerp/database';
import prisma from './prisma';
import { AppError } from '../middleware/error.middleware';

/**
 * Applies an industry vertical preset to an organization: seeds default
 * leave policies, custom field definitions, and extra org-custom roles.
 * Idempotent (safe to re-run / re-apply). DocumentType seeding is a no-op
 * for every preset right now — that's Phase 2 (compliance engine) work.
 */
export async function applyPreset(organizationId: string, presetKey: string): Promise<void> {
  const preset = INDUSTRY_PRESETS[presetKey];
  if (!preset) {
    throw new AppError(400, `Unknown preset "${presetKey}". Available: ${Object.keys(INDUSTRY_PRESETS).join(', ')}`);
  }

  for (const lp of preset.leavePolicies) {
    await prisma.leavePolicy.upsert({
      where: { organizationId_leaveType: { organizationId, leaveType: lp.leaveType as never } },
      update: {},
      create: {
        organizationId,
        name: lp.name,
        leaveType: lp.leaveType as never,
        daysPerYear: lp.daysPerYear,
        carryForwardMax: lp.carryForwardMax ?? 0,
        isPaidLeave: lp.isPaidLeave ?? true,
        applicableTo: lp.applicableTo,
      },
    });
  }

  for (const cf of preset.customFields) {
    await prisma.customFieldDefinition.upsert({
      where: { organizationId_entityType_fieldKey: { organizationId, entityType: cf.entityType, fieldKey: cf.fieldKey } },
      update: {},
      create: {
        organizationId,
        entityType: cf.entityType,
        fieldKey: cf.fieldKey,
        label: cf.label,
        fieldType: cf.fieldType,
        options: cf.options as object | undefined,
        required: cf.required ?? false,
        sortOrder: cf.sortOrder ?? 0,
      },
    });
  }

  for (const role of preset.roles) {
    const existing = await prisma.role.findFirst({ where: { organizationId, key: role.key } });
    if (!existing) {
      await prisma.role.create({ data: { organizationId, key: role.key, name: role.name, isSystem: false } });
    }
  }

  for (const scheme of preset.statutorySchemes) {
    await prisma.statutoryScheme.upsert({
      where: { organizationId_code: { organizationId, code: scheme.code } },
      update: {},
      create: {
        organizationId,
        code: scheme.code,
        name: scheme.name,
        strategy: scheme.strategy,
        employeeRate: scheme.employeeRate,
        employerRate: scheme.employerRate,
        wageCeiling: scheme.wageCeiling,
      },
    });
  }

  await prisma.organization.update({ where: { id: organizationId }, data: { industryVertical: presetKey } });
}
