import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Idempotent: only touches rows where the *new* column is still unset, so
// re-running this script after further data changes is safe.
async function main(): Promise<void> {
  console.log('Backfilling HR Core (Phase 1)...');

  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  const schemeIdByOrg = new Map<string, string>();

  for (const org of orgs) {
    const scheme = await prisma.statutoryScheme.upsert({
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
    schemeIdByOrg.set(org.id, scheme.id);
    console.log(`org ${org.id} (${org.name}): SG_CPF scheme ${scheme.id}`);
  }

  const identityResult = await prisma.$executeRaw`
    UPDATE employees
    SET "identityDocNumber" = "nricOrFin", "identityDocType" = 'NRIC_FIN'
    WHERE "nricOrFin" IS NOT NULL AND "identityDocNumber" IS NULL
  `;
  console.log(`employees: copied nricOrFin -> identityDocNumber for ${identityResult} row(s)`);

  const employeesNeedingScheme = await prisma.employee.findMany({
    where: { cpfApplicable: true, statutorySchemeId: null },
    select: { id: true, organizationId: true },
  });
  for (const emp of employeesNeedingScheme) {
    const schemeId = schemeIdByOrg.get(emp.organizationId);
    if (!schemeId) continue;
    await prisma.employee.update({ where: { id: emp.id }, data: { statutorySchemeId: schemeId } });
  }
  console.log(`employees: set statutorySchemeId for ${employeesNeedingScheme.length} row(s)`);

  console.log('HR Core backfill complete.');
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
