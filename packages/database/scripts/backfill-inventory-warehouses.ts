import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Idempotent: only creates what's missing, safe to re-run (e.g. after a new
// org signs up, or a new BULK item is created before this ever ran for it).
// Creates one default "Main Warehouse" per organization and a WarehouseStock
// row (starting at 0) for every existing BULK-tracked item that doesn't have
// one yet. Existing EquipmentPurchase/EquipmentIssue rows get backfilled onto
// the org's default warehouse so the now-required warehouseId has somewhere
// to point once that column is flipped from optional to required.
async function main(): Promise<void> {
  console.log('Backfilling inventory warehouses...');

  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  const warehouseIdByOrg = new Map<string, string>();

  for (const org of orgs) {
    const warehouse = await prisma.warehouse.upsert({
      where: { organizationId_code: { organizationId: org.id, code: 'MAIN' } },
      update: {},
      create: {
        organizationId: org.id,
        code: 'MAIN',
        name: 'Main Warehouse',
        isDefault: true,
      },
    });
    warehouseIdByOrg.set(org.id, warehouse.id);
    console.log(`org ${org.id} (${org.name}): default warehouse ${warehouse.id}`);
  }

  const items = await prisma.equipmentItem.findMany({
    where: { trackingMode: 'BULK' },
    select: { id: true, organizationId: true, itemCode: true },
  });
  for (const item of items) {
    const warehouseId = warehouseIdByOrg.get(item.organizationId);
    if (!warehouseId) continue;
    await prisma.warehouseStock.upsert({
      where: { itemId_warehouseId: { itemId: item.id, warehouseId } },
      update: {},
      create: { organizationId: item.organizationId, itemId: item.id, warehouseId, quantityOnHand: 0 },
    });
  }
  console.log(`equipment_items: ensured WarehouseStock row for ${items.length} BULK item(s)`);

  const purchaseResult = await prisma.$executeRaw`
    UPDATE equipment_purchases p
    SET "warehouseId" = w.id
    FROM warehouses w
    WHERE p."warehouseId" IS NULL AND w."organizationId" = p."organizationId" AND w."isDefault" = true
  `;
  console.log(`equipment_purchases: backfilled warehouseId for ${purchaseResult} row(s)`);

  const issueResult = await prisma.$executeRaw`
    UPDATE equipment_issues i
    SET "warehouseId" = w.id
    FROM warehouses w
    WHERE i."warehouseId" IS NULL AND w."organizationId" = i."organizationId" AND w."isDefault" = true
  `;
  console.log(`equipment_issues: backfilled warehouseId for ${issueResult} row(s)`);

  console.log('Inventory warehouse backfill complete.');
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
