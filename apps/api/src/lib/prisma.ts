import { PrismaClient } from '@prisma/client';
import { getTenantContext } from './tenant-context';

// Models that carry organizationId and must always be scoped to the
// caller's tenant. Deliberately excludes: User/RefreshToken/PasswordResetToken
// (identity lookups happen BEFORE tenant context exists — you can't scope
// the query that establishes the org), Organization/Role/Permission/
// RolePermission (global or cross-tenant reference tables), AuditLog
// (organizationId is optional there by design), and join/log tables with
// no organizationId of their own (ApprovalStep/Instance/Action, RolePermission,
// WebhookDelivery, ChecklistTemplateTask, ChecklistInstanceTask,
// EmployeeCaseComment) which inherit scoping from their parent.
const TENANT_SCOPED_MODELS = new Set([
  'Employee',
  'EmployeeCertification',
  'Attendance',
  'PayrollRecord',
  'LeavePolicy',
  'LeaveBalance',
  'LeaveRequest',
  'Client',
  'Project',
  'ProjectEmployee',
  'Expense',
  'Supplier',
  'EquipmentCategory',
  'EquipmentItem',
  'EquipmentPurchase',
  'EquipmentIssue',
  'Warehouse',
  'WarehouseStock',
  'AssetUnit',
  'MaintenanceRecord',
  'DepreciationEntry',
  'Quotation',
  'QuotationLineItem',
  'Invoice',
  'InvoiceLineItem',
  'Payment',
  'WorkPass',
  'WorkPassRenewal',
  'Notification',
  'NotificationPreference',
  'Holiday',
  'UserRoleAssignment',
  'VendorPortalUser',
  'ClientPortalUser',
  'OrganizationSsoConfig',
  'CustomFieldDefinition',
  'CustomFieldValue',
  'ApprovalChain',
  'WebhookSubscription',
  'StatutoryScheme',
  'JobRequisition',
  'Candidate',
  'Application',
  'ChecklistTemplate',
  'ChecklistInstance',
  'SkillDefinition',
  'EmployeeSkill',
  'PerformanceReviewCycle',
  'PerformanceReview',
  'EmployeeCase',
  'PayrollRun',
]);

const READ_OPS = new Set(['findFirst', 'findFirstOrThrow', 'findMany', 'findUnique', 'findUniqueOrThrow', 'count', 'aggregate', 'groupBy']);
const WHERE_MANY_OPS = new Set(['updateMany', 'deleteMany']);
const WHERE_SINGLE_OPS = new Set(['update', 'delete']);

// Raw, unscoped client — a deliberate escape hatch for background jobs
// (cron tasks) that legitimately run outside any single request/tenant
// context and need cross-tenant reach (e.g. "check every org's expiring
// work passes"). Use this ONLY for such system-level jobs, never for
// request-handling code — request handlers must use the default export.
export const prismaUnscoped = new PrismaClient();

const prisma = prismaUnscoped.$extends({
  name: 'tenant-scoping',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!TENANT_SCOPED_MODELS.has(model)) {
          return query(args);
        }

        const ctx = getTenantContext();
        if (!ctx) {
          throw new Error(
            `Tenant-scoped query ${model}.${operation} ran with no tenant context. ` +
              `Wrap this call with runWithTenantContext(), or use prismaUnscoped explicitly for a ` +
              `legitimate cross-tenant system job.`,
          );
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a = args as any;

        if (operation === 'create') {
          a.data = { ...a.data, organizationId: ctx.organizationId };
        } else if (operation === 'createMany') {
          a.data = Array.isArray(a.data)
            ? a.data.map((d: object) => ({ ...d, organizationId: ctx.organizationId }))
            : { ...a.data, organizationId: ctx.organizationId };
        } else if (operation === 'upsert') {
          a.where = { ...a.where, organizationId: ctx.organizationId };
          a.create = { ...a.create, organizationId: ctx.organizationId };
        } else if (READ_OPS.has(operation) || WHERE_MANY_OPS.has(operation) || WHERE_SINGLE_OPS.has(operation)) {
          a.where = { ...a.where, organizationId: ctx.organizationId };
        }

        return query(a);
      },
    },
  },
});

export default prisma;
