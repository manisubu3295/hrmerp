import prisma from './prisma';

/**
 * Write an audit log entry.
 * Non-blocking — failures are logged but not thrown.
 */
export async function writeAuditLog(opts: {
  organizationId?: string | null;
  userId?: string | null;
  action: string;     // e.g. 'CREATE', 'UPDATE', 'DELETE'
  entity: string;     // e.g. 'Invoice', 'Employee'
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: opts.organizationId ?? undefined,
        userId: opts.userId ?? undefined,
        action: opts.action,
        entity: opts.entity,
        entityId: opts.entityId ?? undefined,
        oldValues: (opts.oldValues ?? undefined) as object | undefined,
        newValues: (opts.newValues ?? undefined) as object | undefined,
        ipAddress: opts.ipAddress ?? undefined,
        userAgent: opts.userAgent ?? undefined,
      },
    });
  } catch (err) {
    // Never block the main request due to audit log failure
    console.error('[AuditLog] Failed to write audit log:', err);
  }
}
