import { z } from 'zod';

export const createRequisitionSchema = z.object({
  title: z.string().min(1).max(150),
  department: z.string().optional().nullable(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'FOREIGN_WORKER']).optional().default('FULL_TIME'),
  headcount: z.number().int().positive().optional().default(1),
  description: z.string().optional().nullable(),
  requestedById: z.string().optional().nullable(),
});

export const updateRequisitionSchema = createRequisitionSchema.partial().extend({
  status: z.enum(['OPEN', 'ON_HOLD', 'FILLED', 'CANCELLED']).optional(),
});

export const createCandidateSchema = z.object({
  fullName: z.string().min(1).max(150),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  resumeUrl: z.string().url().optional().nullable(),
  source: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateCandidateSchema = createCandidateSchema.partial();

export const createApplicationSchema = z.object({
  candidateId: z.string().min(1),
});

export const updateApplicationStageSchema = z.object({
  stage: z.enum(['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN']),
  rejectionReason: z.string().optional().nullable(),
});

// Same shape as createEmployeeSchema (apps/api/src/schemas/employees.schema.ts)
// — the hire endpoint reuses createEmployeeFromDto(), so its input contract
// must match.
export const hireApplicationSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  identityDocType: z.string().optional().nullable(),
  identityDocNumber: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'FOREIGN_WORKER']).optional().default('FULL_TIME'),
  jobTitle: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  dailyRate: z.number({ required_error: 'Daily rate is required' }).positive(),
  hourlyRate: z.number().positive().optional().nullable(),
  overtimeRate: z.number().positive().optional().nullable(),
  allowances: z.number().min(0).optional().default(0),
  statutorySchemeId: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankAccountNo: z.string().optional().nullable(),
  joinDate: z.string({ required_error: 'Join date is required' }),
});
