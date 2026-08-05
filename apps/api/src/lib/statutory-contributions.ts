import { calculateCpf } from './cpf';
import type { StatutoryScheme } from '@prisma/client';

// Dispatches to the right contribution calculator for an employee's
// StatutoryScheme, replacing the old flat-vs-graduated inconsistency where
// employees.routes.ts and payroll.routes.ts each computed CPF differently.
// SG_CPF delegates to the existing lib/cpf.ts graduated-rate calculator
// unchanged; FLAT_RATE is the generic escape hatch for any other
// country/org, driven entirely by the scheme row's own rate/ceiling fields.

export function deriveCitizenshipStatus(nationality: string | null | undefined): 'SC_PR' | 'FOREIGNER' {
  return ['Singapore', 'Singaporean', 'PR', 'Permanent Resident'].includes(nationality ?? '')
    ? 'SC_PR'
    : 'FOREIGNER';
}

export interface StatutoryInput {
  scheme: StatutoryScheme | null | undefined;
  grossSalary: number;
  age: number;
  nationality?: string | null;
}

export interface StatutoryResult {
  employeeContribution: number;
  employerContribution: number;
}

export function calculateStatutoryContribution(input: StatutoryInput): StatutoryResult {
  if (!input.scheme || !input.scheme.isActive) {
    return { employeeContribution: 0, employerContribution: 0 };
  }

  if (input.scheme.strategy === 'SG_CPF') {
    const cpf = calculateCpf({
      grossSalary: input.grossSalary,
      age: input.age,
      citizenshipStatus: deriveCitizenshipStatus(input.nationality),
    });
    return { employeeContribution: cpf.employeeContribution, employerContribution: cpf.employerContribution };
  }

  // FLAT_RATE
  const wageBase = input.scheme.wageCeiling
    ? Math.min(input.grossSalary, Number(input.scheme.wageCeiling))
    : input.grossSalary;
  return {
    employeeContribution: Math.round(wageBase * Number(input.scheme.employeeRate ?? 0)),
    employerContribution: Math.round(wageBase * Number(input.scheme.employerRate ?? 0)),
  };
}

export function ageFromDob(dateOfBirth: Date | string | null | undefined): number {
  if (!dateOfBirth) return 35;
  return Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000));
}
