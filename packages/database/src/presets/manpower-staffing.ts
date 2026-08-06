import type { IndustryPreset } from '@sankoerp/shared';

// The vertical Aadhirai HRM OS originally shipped for (Singapore manpower/staffing
// agencies) — now just one configurable preset instead of hardcoded logic.
export const manpowerStaffingPreset: IndustryPreset = {
  key: 'manpower-staffing',
  name: 'Manpower / Staffing Agency',
  leavePolicies: [
    { name: 'Annual Leave', leaveType: 'ANNUAL', daysPerYear: 14, carryForwardMax: 7, isPaidLeave: true, applicableTo: 'ALL' },
    { name: 'Sick Leave', leaveType: 'SICK', daysPerYear: 14, isPaidLeave: true, applicableTo: 'ALL' },
    { name: 'Maternity Leave', leaveType: 'MATERNITY', daysPerYear: 112, isPaidLeave: true, applicableTo: 'ALL' },
    { name: 'Paternity Leave', leaveType: 'PATERNITY', daysPerYear: 14, isPaidLeave: true, applicableTo: 'ALL' },
    { name: 'Compassionate Leave', leaveType: 'COMPASSIONATE', daysPerYear: 3, isPaidLeave: true, applicableTo: 'ALL' },
    { name: 'Unpaid Leave', leaveType: 'UNPAID', daysPerYear: 0, isPaidLeave: false, applicableTo: 'ALL' },
  ],
  customFields: [
    { entityType: 'Employee', fieldKey: 'workPermitCategory', label: 'Work Permit Category', fieldType: 'SELECT', options: ['Work Permit', 'S Pass', 'Employment Pass', 'Training Work Permit', 'Letter of Consent'], sortOrder: 1 },
    { entityType: 'Employee', fieldKey: 'siteSafetyCertNumber', label: 'Site Safety Certification No.', fieldType: 'TEXT', sortOrder: 2 },
  ],
  roles: [
    { key: 'SITE_SUPERVISOR', name: 'Site Supervisor' },
    { key: 'HR_COORDINATOR', name: 'HR Coordinator' },
  ],
  statutorySchemes: [
    { code: 'SG_CPF', name: 'CPF (Singapore)', strategy: 'SG_CPF' },
  ],
  documentTypes: [],
};
