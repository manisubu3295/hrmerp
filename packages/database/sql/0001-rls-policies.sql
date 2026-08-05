-- Row-Level Security policies for tenant-scoped tables.
--
-- IMPORTANT — current limitation (found while applying this script):
-- the app connects to Postgres as the `postgres` role, which is a
-- SUPERUSER. Postgres superusers unconditionally bypass Row-Level
-- Security regardless of policies defined here (this is a hard Postgres
-- guarantee, not a bug) — confirmed via:
--   SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;
--   -> postgres | t | t
-- So today, RLS is enabled and the policies below ARE created, but they
-- currently have NO effect on the running application. Tenant isolation
-- is enforced entirely by the Prisma Client Extension in
-- apps/api/src/lib/prisma.ts. Before RLS provides real defense-in-depth:
--   1. Create a non-superuser app role (e.g. `aadhirai_app`) with only
--      the DML grants it needs, and point DATABASE_URL at it instead of
--      `postgres`.
--   2. Wire a per-request `SET LOCAL app.current_org_id = ...` — this
--      requires routing each request's Prisma calls through a single
--      interactive transaction (`prisma.$transaction(async (tx) => ...)`)
--      held open for the request, since `SET LOCAL` only applies within
--      the transaction it's issued in. That's a materially larger change
--      to how routes access Prisma (today they import a global singleton)
--      and is intentionally NOT done in this pass — see the Phase 0 plan.
--
-- Applied via: npx prisma db execute --file ./sql/0001-rls-policies.sql --schema prisma/schema.prisma
--
-- Deliberately excludes:
--   - users: login resolves by email BEFORE any org is known (that's the
--     whole point of login) — a blanket policy here would break identity
--     resolution once RLS is actually enforced. Needs a special-cased
--     policy (or a SECURITY DEFINER function) when the non-superuser role
--     work happens, not a copy-paste of the pattern below.
--   - organizations, roles, permissions, role_permissions, audit_logs,
--     password_reset_tokens, refresh_tokens: global/cross-tenant reference
--     tables, or tables with optional/no organizationId by design.
--   - approval_steps, approval_instances, approval_actions,
--     webhook_deliveries: no organizationId of their own — they inherit
--     scoping from their parent (approval_chains / webhook_subscriptions).

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'employees', 'employee_certifications', 'attendances', 'payroll_records',
    'leave_policies', 'leave_balances', 'leave_requests', 'clients', 'projects',
    'project_employees', 'expenses', 'suppliers', 'equipment_categories',
    'equipment_items', 'equipment_purchases', 'equipment_issues', 'quotations',
    'quotation_line_items', 'invoices', 'invoice_line_items', 'payments',
    'work_passes', 'work_pass_renewals', 'notifications', 'notification_preferences',
    'holidays', 'user_role_assignments', 'vendor_portal_users', 'client_portal_users',
    'organization_sso_configs', 'custom_field_definitions', 'custom_field_values',
    'approval_chains', 'webhook_subscriptions'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("organizationId" = current_setting(''app.current_org_id'', true))',
      t
    );
  END LOOP;
END $$;
