import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Idempotent: only touches rows where organizationId is currently null,
// so re-running this script after new nullable data appears is safe.
const TENANT_SCOPED_MODELS = [
  'employee',
  'employeeCertification',
  'attendance',
  'payrollRecord',
  'leavePolicy',
  'leaveBalance',
  'leaveRequest',
  'client',
  'project',
  'projectEmployee',
  'expense',
  'supplier',
  'equipmentCategory',
  'equipmentItem',
  'equipmentPurchase',
  'equipmentIssue',
  'quotation',
  'quotationLineItem',
  'invoice',
  'invoiceLineItem',
  'payment',
  'workPass',
  'workPassRenewal',
  'notification',
  'notificationPreference',
  'holiday',
] as const;

async function main(): Promise<void> {
  console.log('Backfilling tenancy...');

  const defaultOrg = await prisma.organization.upsert({
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
  console.log(`Default organization: ${defaultOrg.id} (${defaultOrg.name})`);

  const userResult = await prisma.user.updateMany({
    where: { organizationId: null },
    data: { organizationId: defaultOrg.id },
  });
  console.log(`users: backfilled ${userResult.count} row(s)`);

  for (const model of TENANT_SCOPED_MODELS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (prisma as any)[model];
    const result = await delegate.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id },
    });
    console.log(`${model}: backfilled ${result.count} row(s)`);
  }

  console.log('Tenancy backfill complete.');
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
