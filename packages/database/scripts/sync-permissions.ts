import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, ROLE_PERMISSIONS } from '@sankoerp/shared';

const prisma = new PrismaClient();

// Idempotent (upsert-based) — safe to re-run whenever packages/shared's
// PERMISSIONS/ROLE_PERMISSIONS catalog changes, without re-running the full
// seed (which would try to recreate demo org/employee data). Mirrors
// seed.ts::seedRbac() exactly.
async function main(): Promise<void> {
  console.log('Syncing RBAC permissions...');

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
      const [resource, action] = permKey.split(/:(.+)/);
      const permission = await prisma.permission.findUnique({ where: { resource_action: { resource, action } } });
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  console.log(`Synced ${PERMISSIONS.length} permissions across ${Object.keys(ROLE_PERMISSIONS).length} roles.`);
}

main()
  .catch((e) => {
    console.error('Permission sync failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
