/**
 * Singapore CPF (Central Provident Fund) Calculator
 * Rates as per CPF Board — effective 1 Jan 2024
 *
 * Employee categories:
 *   SG Citizen / PR (year 1-3 have reduced rates for PR)
 *   Employees ≥ 55 years have graduated reduced rates
 *   Ordinary Wage (OW) ceiling: SGD 6,800/month
 *   Additional Wage (AW) ceiling: SGD 102,000 - OW contributed for the year
 */

export interface CpfInput {
  grossSalary: number;       // monthly ordinary wage
  age: number;                // employee age in years
  citizenshipStatus: 'SC_PR' | 'FOREIGNER'; // simplified: SC/PR pay CPF; foreigners don't
  prYear?: 1 | 2 | 3;        // for PR: year 1, 2, or 3+ since becoming PR (3+ = full rate)
}

export interface CpfResult {
  employeeContribution: number;
  employerContribution: number;
  totalCpf: number;
  takeHomePay: number;
  ordinaryWage: number;     // capped OW used for calculation
  applicableSalary: number;
}

// OW ceiling
const OW_CEILING = 6800;

// Rates table: [ageGroup, employeeRate, employerRate]
// Age groups: <55, 55-60, 60-65, 65-70, >70
type RateRow = { maxAge: number; employee: number; employer: number };

const SC_PR_FULL_RATES: RateRow[] = [
  { maxAge: 55,  employee: 0.20, employer: 0.17 },
  { maxAge: 60,  employee: 0.15, employer: 0.15 },
  { maxAge: 65,  employee: 0.105, employer: 0.115 },
  { maxAge: 70,  employee: 0.075, employer: 0.09 },
  { maxAge: 999, employee: 0.05,  employer: 0.075 },
];

// PR Year 1 (graduated rates — lower)
const PR_YEAR1_RATES: RateRow[] = [
  { maxAge: 55,  employee: 0.05, employer: 0.04 },
  { maxAge: 60,  employee: 0.05, employer: 0.04 },
  { maxAge: 65,  employee: 0.05, employer: 0.04 },
  { maxAge: 70,  employee: 0.05, employer: 0.04 },
  { maxAge: 999, employee: 0.05, employer: 0.04 },
];

// PR Year 2
const PR_YEAR2_RATES: RateRow[] = [
  { maxAge: 55,  employee: 0.15, employer: 0.09 },
  { maxAge: 60,  employee: 0.125, employer: 0.075 },
  { maxAge: 65,  employee: 0.075, employer: 0.065 },
  { maxAge: 70,  employee: 0.05,  employer: 0.05 },
  { maxAge: 999, employee: 0.05,  employer: 0.05 },
];

function getRates(input: CpfInput): { employee: number; employer: number } {
  if (input.citizenshipStatus === 'FOREIGNER') {
    return { employee: 0, employer: 0 };
  }

  let table: RateRow[];
  if (input.prYear === 1) {
    table = PR_YEAR1_RATES;
  } else if (input.prYear === 2) {
    table = PR_YEAR2_RATES;
  } else {
    table = SC_PR_FULL_RATES;
  }

  const row = table.find((r) => input.age < r.maxAge)!;
  return { employee: row.employee, employer: row.employer };
}

/**
 * Calculate CPF contributions for a given month.
 */
export function calculateCpf(input: CpfInput): CpfResult {
  const rates = getRates(input);

  // Ordinary wage is capped at OW_CEILING
  const ordinaryWage = Math.min(input.grossSalary, OW_CEILING);

  // CPF is not applicable on gross > SGD 500
  if (ordinaryWage < 500) {
    return {
      employeeContribution: 0,
      employerContribution: 0,
      totalCpf: 0,
      takeHomePay: input.grossSalary,
      ordinaryWage,
      applicableSalary: input.grossSalary,
    };
  }

  // Round to nearest dollar (CPF rules)
  const employeeContribution = Math.round(ordinaryWage * rates.employee);
  const employerContribution = Math.round(ordinaryWage * rates.employer);
  const totalCpf = employeeContribution + employerContribution;
  const takeHomePay = input.grossSalary - employeeContribution;

  return {
    employeeContribution,
    employerContribution,
    totalCpf,
    takeHomePay,
    ordinaryWage,
    applicableSalary: ordinaryWage,
  };
}
