import type { IndustryPreset } from '@sankoerp/shared';

export const manufacturingPreset: IndustryPreset = {
  key: 'manufacturing',
  name: 'Manufacturing',
  leavePolicies: [
    { name: 'Annual Leave', leaveType: 'ANNUAL', daysPerYear: 14, carryForwardMax: 7, isPaidLeave: true, applicableTo: 'ALL' },
    { name: 'Sick Leave', leaveType: 'SICK', daysPerYear: 14, isPaidLeave: true, applicableTo: 'ALL' },
    { name: 'Maternity Leave', leaveType: 'MATERNITY', daysPerYear: 112, isPaidLeave: true, applicableTo: 'ALL' },
    { name: 'Paternity Leave', leaveType: 'PATERNITY', daysPerYear: 14, isPaidLeave: true, applicableTo: 'ALL' },
  ],
  customFields: [
    { entityType: 'Employee', fieldKey: 'shiftPattern', label: 'Shift Pattern', fieldType: 'SELECT', options: ['Day', 'Night', 'Rotating'], sortOrder: 1 },
    { entityType: 'Employee', fieldKey: 'machineCertifications', label: 'Machine Certifications', fieldType: 'MULTI_SELECT', options: ['Forklift', 'CNC', 'Press Brake', 'Welding'], sortOrder: 2 },
    { entityType: 'EquipmentItem', fieldKey: 'assetTag', label: 'Asset Tag', fieldType: 'TEXT', sortOrder: 1 },
  ],
  roles: [
    { key: 'PRODUCTION_SUPERVISOR', name: 'Production Supervisor' },
    { key: 'QUALITY_INSPECTOR', name: 'Quality Inspector' },
  ],
  statutorySchemes: [],
  documentTypes: [],
};
