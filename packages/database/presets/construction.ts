import type { IndustryPreset } from '@sankoerp/shared';

export const constructionPreset: IndustryPreset = {
  key: 'construction',
  name: 'Construction & Contracting',
  leavePolicies: [
    { name: 'Annual Leave', leaveType: 'ANNUAL', daysPerYear: 14, carryForwardMax: 7, isPaidLeave: true, applicableTo: 'ALL' },
    { name: 'Sick Leave', leaveType: 'SICK', daysPerYear: 14, isPaidLeave: true, applicableTo: 'ALL' },
    { name: 'Emergency Leave', leaveType: 'EMERGENCY', daysPerYear: 3, isPaidLeave: true, applicableTo: 'ALL' },
    { name: 'Compassionate Leave', leaveType: 'COMPASSIONATE', daysPerYear: 3, isPaidLeave: true, applicableTo: 'ALL' },
    { name: 'Off in Lieu', leaveType: 'OFF_IN_LIEU', daysPerYear: 0, isPaidLeave: true, applicableTo: 'ALL' },
  ],
  customFields: [
    { entityType: 'Employee', fieldKey: 'safetyInductionDate', label: 'Safety Induction Date', fieldType: 'DATE', sortOrder: 1 },
    { entityType: 'Employee', fieldKey: 'craneOperatorLicense', label: 'Crane Operator License', fieldType: 'BOOLEAN', sortOrder: 2 },
    { entityType: 'Project', fieldKey: 'siteAddress', label: 'Site Address', fieldType: 'TEXT', sortOrder: 1 },
    { entityType: 'Project', fieldKey: 'permitNumber', label: 'Building Permit Number', fieldType: 'TEXT', sortOrder: 2 },
  ],
  roles: [
    { key: 'SITE_FOREMAN', name: 'Site Foreman' },
    { key: 'SAFETY_OFFICER', name: 'Safety Officer' },
  ],
  statutorySchemes: [],
  documentTypes: [],
};
