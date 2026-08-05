import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Payroll and project-profit calculations now only count Attendance rows
// with approvalStatus APPROVED (see payroll.routes.ts, projects.routes.ts
// GET /:id/profit). Existing rows default to PENDING, so without this
// backfill any re-run of payroll for a past period would silently zero out.
// Idempotent: only touches rows still PENDING and created before the given
// cutoff, so re-running later doesn't auto-approve genuinely new entries.
async function main(): Promise<void> {
  const cutoff = process.argv[2] ? new Date(process.argv[2]) : new Date();
  if (Number.isNaN(cutoff.getTime())) {
    console.error(`Invalid cutoff date: ${process.argv[2]}`);
    process.exit(1);
  }

  console.log(`Backfilling timesheet approval status (cutoff: ${cutoff.toISOString()})...`);

  const result = await prisma.attendance.updateMany({
    where: { approvalStatus: 'PENDING', createdAt: { lt: cutoff } },
    data: { approvalStatus: 'APPROVED', approvedAt: new Date() },
  });

  console.log(`Marked ${result.count} pre-existing attendance row(s) as APPROVED.`);
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
