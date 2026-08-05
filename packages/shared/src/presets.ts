/**
 * Industry vertical preset shape — seeds default leave policies, custom
 * fields, and extra org-custom roles at tenant onboarding. DocumentType
 * presets are deliberately empty (`documentTypes: []`) on every preset:
 * the compliance/document-expiry engine they'd populate doesn't exist yet
 * (Phase 2) — see packages/database/presets/*.ts.
 */

export interface PresetLeavePolicy {
  name: string;
  leaveType: string;
  daysPerYear: number;
  carryForwardMax?: number;
  isPaidLeave?: boolean;
  applicableTo?: string;
}

export interface PresetCustomField {
  entityType: string;
  fieldKey: string;
  label: string;
  fieldType: 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT';
  options?: unknown;
  required?: boolean;
  sortOrder?: number;
}

export interface PresetRole {
  key: string;
  name: string;
}

export interface PresetStatutoryScheme {
  code: string;
  name: string;
  strategy: 'SG_CPF' | 'FLAT_RATE';
  employeeRate?: number;
  employerRate?: number;
  wageCeiling?: number;
}

export interface IndustryPreset {
  key: string;
  name: string;
  leavePolicies: PresetLeavePolicy[];
  customFields: PresetCustomField[];
  roles: PresetRole[];
  statutorySchemes: PresetStatutoryScheme[];
  documentTypes: never[]; // Phase 2 — compliance engine not built yet
}
