import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PERMISSIONS, ROLE_PERMISSIONS } from '@sankoerp/shared';

const prisma = new PrismaClient();

// System roles + their permission sets (see packages/shared/src/permissions.ts).
// organizationId: null marks these as system-defined role templates shared
// across all tenants, not a per-org custom role.
async function seedRbac(): Promise<void> {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { resource_action: { resource: p.resource, action: p.action } },
      update: { description: p.description },
      create: { resource: p.resource, action: p.action, description: p.description },
    });
  }

  for (const roleKey of Object.keys(ROLE_PERMISSIONS) as Array<keyof typeof ROLE_PERMISSIONS>) {
    const role = await prisma.role.upsert({
      where: { id: `system-${roleKey.toLowerCase()}` },
      update: {},
      create: { id: `system-${roleKey.toLowerCase()}`, organizationId: null, key: roleKey, name: roleKey, isSystem: true },
    });

    for (const permKey of ROLE_PERMISSIONS[roleKey]) {
      const [resource, action] = permKey.split(/:(.+)/); // split on first ':' only (settings:sso:update has two colons)
      const permission = await prisma.permission.findUnique({ where: { resource_action: { resource, action } } });
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
}

// Backfills a UserRoleAssignment for every user (seeded or otherwise
// pre-existing) that doesn't already have one for their current `role`
// field's matching system role. Safe to re-run.
async function backfillUserRoleAssignments(): Promise<void> {
  const users = await prisma.user.findMany();
  for (const user of users) {
    const roleId = `system-${user.role.toLowerCase()}`;
    const existing = await prisma.userRoleAssignment.findFirst({ where: { userId: user.id, roleId } });
    if (existing) continue;
    await prisma.userRoleAssignment.create({
      data: { userId: user.id, roleId, organizationId: user.organizationId },
    });
  }
}

// Phase 1 HR Core sample data: the default statutory scheme, a few sample
// skills, and one onboarding + one offboarding checklist template so the
// new HR Core pages have non-empty data on first run. Idempotent (upserts).
async function seedHrCoreDefaults(org: { id: string }): Promise<void> {
  await prisma.statutoryScheme.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'SG_CPF' } },
    update: {},
    create: {
      organizationId: org.id,
      code: 'SG_CPF',
      name: 'CPF (Singapore)',
      strategy: 'SG_CPF',
      isActive: true,
    },
  });

  const skillNames = [
    { name: 'Cable Splicing', category: 'Technical' },
    { name: 'Forklift Operation', category: 'Equipment' },
    { name: 'First Aid Certified', category: 'Safety' },
  ];
  for (const s of skillNames) {
    await prisma.skillDefinition.upsert({
      where: { organizationId_name: { organizationId: org.id, name: s.name } },
      update: {},
      create: { organizationId: org.id, name: s.name, category: s.category },
    });
  }

  const onboardingTemplate = await prisma.checklistTemplate.upsert({
    where: { id: `${org.id}-onboarding-default` },
    update: {},
    create: {
      id: `${org.id}-onboarding-default`,
      organizationId: org.id,
      purpose: 'ONBOARDING',
      name: 'Standard Onboarding',
    },
  });
  const onboardingTasks = ['IT account setup', 'Issue equipment', 'HR orientation briefing'];
  for (let i = 0; i < onboardingTasks.length; i++) {
    await prisma.checklistTemplateTask.upsert({
      where: { id: `${onboardingTemplate.id}-task-${i}` },
      update: {},
      create: { id: `${onboardingTemplate.id}-task-${i}`, templateId: onboardingTemplate.id, title: onboardingTasks[i]!, sortOrder: i },
    });
  }

  const offboardingTemplate = await prisma.checklistTemplate.upsert({
    where: { id: `${org.id}-offboarding-default` },
    update: {},
    create: {
      id: `${org.id}-offboarding-default`,
      organizationId: org.id,
      purpose: 'OFFBOARDING',
      name: 'Standard Offboarding',
    },
  });
  const offboardingTasks = ['Return equipment', 'Revoke system access', 'Exit interview'];
  for (let i = 0; i < offboardingTasks.length; i++) {
    await prisma.checklistTemplateTask.upsert({
      where: { id: `${offboardingTemplate.id}-task-${i}` },
      update: {},
      create: { id: `${offboardingTemplate.id}-task-${i}`, templateId: offboardingTemplate.id, title: offboardingTasks[i]!, sortOrder: i },
    });
  }
}

async function main() {
  console.log('🌱 Seeding database...');

  // Default tenant — every seeded row below belongs to this organization
  const org = await prisma.organization.upsert({
    where: { code: 'DEFAULT' },
    update: {},
    create: {
      code: 'DEFAULT',
      name: 'Default Organization',
      defaultCurrency: 'SGD',
      locale: 'en-SG',
      timezone: 'Asia/Singapore',
    },
  });

  await seedRbac();
  await seedHrCoreDefaults(org);

  // Admin user
  const passwordHash = await bcrypt.hash('Admin@123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@aadhirai.com' },
    update: {},
    create: {
      email: 'admin@aadhirai.com',
      passwordHash,
      role: 'SUPER_ADMIN',
      organizationId: org.id,
    },
  });

  // Manager user
  const mgr = await prisma.user.upsert({
    where: { email: 'manager@aadhirai.com' },
    update: {},
    create: {
      email: 'manager@aadhirai.com',
      passwordHash: await bcrypt.hash('Manager@123!', 12),
      role: 'MANAGER',
      organizationId: org.id,
    },
  });

  // Sample client
  const client = await prisma.client.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'CLI-0001' } },
    update: {},
    create: {
      organizationId: org.id,
      code: 'CLI-0001',
      name: 'Singtel Infra Solutions',
      contactName: 'John Tan',
      contactEmail: 'john.tan@singtel.com',
      contactPhone: '+65 9123 4567',
      uen: '200012345A',
      gstRegistered: true,
      creditTermDays: 30,
    },
  });

  // Default warehouse — equipment stock is tracked per-warehouse, not as a
  // flat count on the item.
  const mainWarehouse = await prisma.warehouse.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'MAIN' } },
    update: {},
    create: { organizationId: org.id, code: 'MAIN', name: 'Main Warehouse', isDefault: true },
  });

  // Equipment categories
  const safetyCategory = await prisma.equipmentCategory.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Safety Equipment' } },
    update: {},
    create: { organizationId: org.id, name: 'Safety Equipment', description: 'PPE and safety gear' },
  });

  const toolsCategory = await prisma.equipmentCategory.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Tools & Equipment' } },
    update: {},
    create: { organizationId: org.id, name: 'Tools & Equipment', description: 'Electrical and mechanical tools' },
  });

  // Sample employees
  const emp1 = await prisma.employee.upsert({
    where: { organizationId_employeeCode: { organizationId: org.id, employeeCode: 'EMP-0001' } },
    update: {},
    create: {
      organizationId: org.id,
      employeeCode: 'EMP-0001',
      firstName: 'Ali',
      lastName: 'Hassan',
      nationality: 'Malaysian',
      jobTitle: 'Site Supervisor',
      employmentType: 'FOREIGN_WORKER',
      dailyRate: 140,
      joinDate: new Date('2023-01-15'),
      isActive: true,
    },
  });

  const emp2 = await prisma.employee.upsert({
    where: { organizationId_employeeCode: { organizationId: org.id, employeeCode: 'EMP-0002' } },
    update: {},
    create: {
      organizationId: org.id,
      employeeCode: 'EMP-0002',
      firstName: 'Ramu',
      lastName: 'Kumar',
      nationality: 'Indian',
      jobTitle: 'Cable Technician',
      employmentType: 'FOREIGN_WORKER',
      dailyRate: 95,
      joinDate: new Date('2023-03-01'),
      isActive: true,
    },
  });

  // Work passes
  await prisma.workPass.upsert({
    where: { organizationId_passNumber: { organizationId: org.id, passNumber: 'WP-SG-2024-001' } },
    update: {},
    create: {
      organizationId: org.id,
      employeeId: emp1.id,
      passType: 'WORK_PERMIT',
      passNumber: 'WP-SG-2024-001',
      issueDate: new Date('2024-01-01'),
      expiryDate: new Date('2026-01-01'),
      status: 'ACTIVE',
    },
  });

  await prisma.workPass.upsert({
    where: { organizationId_passNumber: { organizationId: org.id, passNumber: 'WP-SG-2024-002' } },
    update: {},
    create: {
      organizationId: org.id,
      employeeId: emp2.id,
      passType: 'WORK_PERMIT',
      passNumber: 'WP-SG-2024-002',
      issueDate: new Date('2024-03-01'),
      expiryDate: new Date('2026-05-15'), // Expiring soon for demo
      status: 'ACTIVE',
    },
  });

  // Sample equipment items — stock lives on WarehouseStock (below), not on
  // the item itself; trackingMode defaults to BULK for all three.
  const safetyShoes = await prisma.equipmentItem.upsert({
    where: { organizationId_itemCode: { organizationId: org.id, itemCode: 'ITM-0001' } },
    update: {},
    create: {
      organizationId: org.id,
      itemCode: 'ITM-0001',
      name: 'Safety Shoes',
      categoryId: safetyCategory.id,
      unit: 'pair',
      unitCost: 85,
      minStockLevel: 5,
      depreciationRate: 0,
    },
  });

  const hardHat = await prisma.equipmentItem.upsert({
    where: { organizationId_itemCode: { organizationId: org.id, itemCode: 'ITM-0002' } },
    update: {},
    create: {
      organizationId: org.id,
      itemCode: 'ITM-0002',
      name: 'Hard Hat',
      categoryId: safetyCategory.id,
      unit: 'unit',
      unitCost: 25,
      minStockLevel: 10,
      depreciationRate: 0,
    },
  });

  const cableTester = await prisma.equipmentItem.upsert({
    where: { organizationId_itemCode: { organizationId: org.id, itemCode: 'ITM-0003' } },
    update: {},
    create: {
      organizationId: org.id,
      itemCode: 'ITM-0003',
      name: 'Cable Tester',
      categoryId: toolsCategory.id,
      unit: 'unit',
      unitCost: 350,
      minStockLevel: 2,
      depreciationRate: 0.2,
      usefulLifeDays: 1825,
    },
  });

  for (const [item, quantityOnHand] of [[safetyShoes, 14], [hardHat, 22], [cableTester, 3]] as const) {
    await prisma.warehouseStock.upsert({
      where: { itemId_warehouseId: { itemId: item.id, warehouseId: mainWarehouse.id } },
      update: {},
      create: { organizationId: org.id, itemId: item.id, warehouseId: mainWarehouse.id, quantityOnHand },
    });
  }

  // Employee user accounts linked to emp1 and emp2
  await prisma.user.upsert({
    where: { email: 'ali.hassan@aadhirai.com' },
    update: {},
    create: {
      email: 'ali.hassan@aadhirai.com',
      passwordHash: await bcrypt.hash('Employee@123!', 12),
      role: 'EMPLOYEE',
      organizationId: org.id,
      employee: { connect: { id: emp1.id } },
    },
  });

  await prisma.user.upsert({
    where: { email: 'ramu.kumar@aadhirai.com' },
    update: {},
    create: {
      email: 'ramu.kumar@aadhirai.com',
      passwordHash: await bcrypt.hash('Employee@123!', 12),
      role: 'EMPLOYEE',
      organizationId: org.id,
      employee: { connect: { id: emp2.id } },
    },
  });

  await backfillUserRoleAssignments();

  console.log('✅ Database seeded successfully!');
  console.log('');
  console.log('🔑 Login credentials:');
  console.log('   Admin:   admin@aadhirai.com / Admin@123!');
  console.log('   Manager: manager@aadhirai.com / Manager@123!');
  console.log('   Employee (Ali):  ali.hassan@aadhirai.com / Employee@123!');
  console.log('   Employee (Ramu): ramu.kumar@aadhirai.com / Employee@123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
