/**
 * Canonical permission catalog + the seed matrix mapping each system role
 * to its permission set. Derived by walking every requireRoles(...) call
 * site in apps/api/src/routes/*.ts (61 route-level guards across 18 files)
 * and translating resource = route-file domain, action = HTTP verb/route
 * semantic — this reproduces today's access behavior 1:1, just through a
 * different enforcement mechanism (Role -> RolePermission -> Permission
 * instead of a hardcoded role-string check).
 *
 * Routes that have NO requireRoles(...) guard today are left ungated here
 * too (open to any authenticated user) — this migration changes HOW access
 * is checked, not WHAT is currently accessible.
 *
 * Lives in @sankoerp/shared (not apps/api) because both the API's auth
 * middleware and packages/database's seed script need it.
 */

export const PERMISSIONS: ReadonlyArray<{ resource: string; action: string; description: string }> = [
  { resource: 'user', action: 'create', description: 'Create user accounts' },
  { resource: 'user', action: 'read', description: 'List/view user accounts' },
  { resource: 'user', action: 'update', description: 'Update user accounts' },
  { resource: 'user', action: 'reset_password', description: "Reset another user's password" },
  { resource: 'user', action: 'manage_role', description: "Change another user's role" },
  { resource: 'calendar', action: 'read_all', description: 'View all holidays/events unfiltered' },
  { resource: 'calendar', action: 'create', description: 'Create calendar events' },
  { resource: 'calendar', action: 'update', description: 'Update calendar events' },
  { resource: 'calendar', action: 'delete', description: 'Delete calendar events' },
  { resource: 'expense', action: 'approve', description: 'Approve or reject expense claims' },
  { resource: 'dashboard', action: 'read_advanced', description: 'View advanced dashboard analytics (project burndown)' },
  { resource: 'invoice', action: 'create', description: 'Create invoices' },
  { resource: 'invoice', action: 'send', description: 'Send invoices to clients' },
  { resource: 'invoice', action: 'record_payment', description: 'Record a payment against an invoice' },
  { resource: 'invoice', action: 'cancel', description: 'Cancel an invoice' },
  { resource: 'equipment', action: 'manage_category', description: 'Create/manage equipment categories' },
  { resource: 'equipment', action: 'create', description: 'Create equipment items' },
  { resource: 'equipment', action: 'update', description: 'Update equipment items' },
  { resource: 'equipment', action: 'purchase', description: 'Record equipment purchases' },
  { resource: 'equipment', action: 'issue', description: 'Issue equipment to a project/employee' },
  { resource: 'equipment', action: 'return', description: 'Process equipment returns' },
  { resource: 'equipment', action: 'manage_maintenance', description: 'Log maintenance/service records for equipment and asset units' },
  { resource: 'equipment', action: 'run_depreciation', description: 'Run the periodic depreciation batch for asset units' },
  { resource: 'warehouse', action: 'manage', description: 'Create/manage warehouses' },
  { resource: 'employee', action: 'create', description: 'Create employee records' },
  { resource: 'employee', action: 'update', description: 'Update employee records' },
  { resource: 'employee', action: 'delete', description: 'Deactivate employee records' },
  { resource: 'compliance', action: 'create', description: 'Create work pass records' },
  { resource: 'compliance', action: 'renew', description: 'Renew a work pass' },
  { resource: 'compliance', action: 'cancel', description: 'Cancel a work pass' },
  { resource: 'client', action: 'create', description: 'Create client records' },
  { resource: 'client', action: 'update', description: 'Update client records' },
  { resource: 'quotation', action: 'create', description: 'Create quotations' },
  { resource: 'quotation', action: 'update', description: 'Edit draft quotations' },
  { resource: 'quotation', action: 'update_status', description: 'Change quotation status' },
  { resource: 'quotation', action: 'convert', description: 'Convert an approved quotation to a project' },
  { resource: 'timesheet', action: 'delete', description: 'Delete a timesheet/attendance entry' },
  { resource: 'timesheet', action: 'bulk_import', description: 'Bulk-import timesheet entries via CSV' },
  { resource: 'timesheet', action: 'approve', description: 'Approve or reject submitted timesheet entries' },
  { resource: 'leave', action: 'manage_policy', description: 'Create/manage leave policies' },
  { resource: 'leave', action: 'manage_balance', description: 'Initialize/adjust leave balances' },
  { resource: 'leave', action: 'approve', description: 'Approve or reject leave requests' },
  { resource: 'leave', action: 'read_summary', description: 'View organization-wide leave summary' },
  { resource: 'payroll', action: 'run', description: 'Run payroll for a project/period' },
  { resource: 'payroll', action: 'read', description: 'List payroll records' },
  { resource: 'payroll', action: 'mark_paid', description: 'Mark a payroll record as paid' },
  { resource: 'project', action: 'create', description: 'Create projects' },
  { resource: 'project', action: 'update', description: 'Update project details' },
  { resource: 'project', action: 'update_status', description: 'Change project status' },
  { resource: 'project', action: 'manage_team', description: 'Assign/remove employees on a project' },
  { resource: 'settings', action: 'update', description: 'Update organization settings' },
  { resource: 'settings', action: 'sso:update', description: "Configure the organization's SSO connection" },
  { resource: 'supplier', action: 'create', description: 'Create supplier/vendor records' },
  { resource: 'supplier', action: 'update', description: 'Update supplier/vendor records' },
  { resource: 'supplier', action: 'delete', description: 'Deactivate supplier/vendor records' },
  { resource: 'reports', action: 'read', description: 'View reports' },
  { resource: 'reports', action: 'export', description: 'Export report data (CSV)' },
  { resource: 'webhooks', action: 'manage', description: 'Manage webhook subscriptions' },
  { resource: 'custom_field', action: 'manage', description: 'Create/edit/delete custom field definitions' },
  { resource: 'approval_chain', action: 'manage', description: 'Configure approval chains and steps' },
  { resource: 'organization', action: 'apply_preset', description: 'Apply an industry preset to the organization' },
  { resource: 'requisition', action: 'create', description: 'Create job requisitions' },
  { resource: 'requisition', action: 'update', description: 'Update job requisitions' },
  { resource: 'candidate', action: 'create', description: 'Create candidate records' },
  { resource: 'candidate', action: 'update', description: 'Update candidate records' },
  { resource: 'application', action: 'manage', description: 'Manage the recruitment pipeline (stage changes, hiring)' },
  { resource: 'checklist', action: 'manage_template', description: 'Create/edit onboarding & offboarding checklist templates' },
  { resource: 'checklist', action: 'manage_instance', description: 'Start and update onboarding/offboarding checklists for any employee' },
  { resource: 'skill', action: 'manage_catalog', description: 'Create/edit the org skill catalog' },
  { resource: 'skill', action: 'manage_employee', description: "Set any employee's skills (not just your own)" },
  { resource: 'performance', action: 'manage_cycle', description: 'Create/activate/close performance review cycles' },
  { resource: 'performance', action: 'manage_review', description: 'Generate reviews and act as reviewer on behalf of another manager' },
  { resource: 'employee_case', action: 'manage', description: 'View, assign, and resolve any employee case (grievance/disciplinary/helpdesk)' },
  { resource: 'statutory_scheme', action: 'manage', description: 'Configure org statutory contribution schemes (e.g. CPF)' },
];

function perm(resource: string, action: string): string {
  return `${resource}:${action}`;
}

const SUPERVISOR_PERMS: string[] = [perm('equipment', 'issue'), perm('equipment', 'return')];

const MANAGER_PERMS: string[] = [
  perm('calendar', 'read_all'),
  perm('expense', 'approve'),
  perm('dashboard', 'read_advanced'),
  perm('invoice', 'create'),
  perm('invoice', 'send'),
  perm('invoice', 'record_payment'),
  perm('equipment', 'create'),
  perm('equipment', 'update'),
  perm('equipment', 'purchase'),
  perm('equipment', 'issue'),
  perm('equipment', 'return'),
  perm('equipment', 'manage_maintenance'),
  perm('employee', 'create'),
  perm('employee', 'update'),
  perm('client', 'create'),
  perm('client', 'update'),
  perm('quotation', 'create'),
  perm('quotation', 'update'),
  perm('quotation', 'update_status'),
  perm('quotation', 'convert'),
  perm('timesheet', 'delete'),
  perm('timesheet', 'bulk_import'),
  perm('timesheet', 'approve'),
  perm('leave', 'manage_balance'),
  perm('leave', 'approve'),
  perm('leave', 'read_summary'),
  perm('payroll', 'run'),
  perm('payroll', 'read'),
  perm('project', 'create'),
  perm('project', 'update'),
  perm('project', 'update_status'),
  perm('project', 'manage_team'),
  perm('supplier', 'create'),
  perm('supplier', 'update'),
  perm('reports', 'read'),
  perm('reports', 'export'),
  perm('requisition', 'create'),
  perm('requisition', 'update'),
  perm('candidate', 'create'),
  perm('candidate', 'update'),
  perm('application', 'manage'),
  perm('checklist', 'manage_instance'),
  perm('skill', 'manage_employee'),
  perm('performance', 'manage_review'),
  perm('employee_case', 'manage'),
];

const ADMIN_ONLY_PERMS: string[] = [
  perm('user', 'create'),
  perm('user', 'read'),
  perm('user', 'update'),
  perm('user', 'reset_password'),
  perm('calendar', 'create'),
  perm('calendar', 'update'),
  perm('calendar', 'delete'),
  perm('invoice', 'cancel'),
  perm('equipment', 'manage_category'),
  perm('equipment', 'run_depreciation'),
  perm('warehouse', 'manage'),
  perm('employee', 'delete'),
  perm('compliance', 'create'),
  perm('compliance', 'renew'),
  perm('compliance', 'cancel'),
  perm('leave', 'manage_policy'),
  perm('payroll', 'mark_paid'),
  perm('settings', 'update'),
  perm('settings', 'sso:update'),
  perm('supplier', 'delete'),
  perm('webhooks', 'manage'),
  perm('custom_field', 'manage'),
  perm('approval_chain', 'manage'),
  perm('organization', 'apply_preset'),
  perm('checklist', 'manage_template'),
  perm('skill', 'manage_catalog'),
  perm('performance', 'manage_cycle'),
  perm('statutory_scheme', 'manage'),
];

const ADMIN_PERMS: string[] = [...MANAGER_PERMS, ...ADMIN_ONLY_PERMS];
const SUPER_ADMIN_PERMS: string[] = [...ADMIN_PERMS, perm('user', 'manage_role')];

export const ROLE_PERMISSIONS: Record<'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'EMPLOYEE', string[]> = {
  SUPER_ADMIN: SUPER_ADMIN_PERMS,
  ADMIN: ADMIN_PERMS,
  MANAGER: MANAGER_PERMS,
  SUPERVISOR: SUPERVISOR_PERMS,
  EMPLOYEE: [],
};
