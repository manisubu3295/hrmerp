import type { IndustryPreset } from '@sankoerp/shared';

// Minimal defaults for any SME that isn't one of the other named verticals.
export const genericServicesPreset: IndustryPreset = {
  key: 'generic-services',
  name: 'Generic Services / SME',
  leavePolicies: [
    { name: 'Annual Leave', leaveType: 'ANNUAL', daysPerYear: 14, carryForwardMax: 7, isPaidLeave: true, applicableTo: 'ALL' },
    { name: 'Sick Leave', leaveType: 'SICK', daysPerYear: 14, isPaidLeave: true, applicableTo: 'ALL' },
    { name: 'Unpaid Leave', leaveType: 'UNPAID', daysPerYear: 0, isPaidLeave: false, applicableTo: 'ALL' },
  ],
  customFields: [
    { entityType: 'Client', fieldKey: 'industry', label: 'Industry', fieldType: 'TEXT', sortOrder: 1 },
  ],
  roles: [],
  statutorySchemes: [],
  documentTypes: [],
};
