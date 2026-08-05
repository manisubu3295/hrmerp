import { z } from 'zod';

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  identityDocType: z.string().optional().nullable(),
  identityDocNumber: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'FOREIGN_WORKER']).optional().default('FULL_TIME'),
  jobTitle: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  skills: z.array(z.string()).optional().default([]),
  dailyRate: z.number({ required_error: 'Daily rate is required' }).positive(),
  hourlyRate: z.number().positive().optional().nullable(),
  overtimeRate: z.number().positive().optional().nullable(),
  allowances: z.number().min(0).optional().default(0),
  statutorySchemeId: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankAccountNo: z.string().optional().nullable(),
  joinDate: z.string({ required_error: 'Join date is required' }),
  resignDate: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
  userId: z.string().optional().nullable(),
  managerId: z.string().optional().nullable(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();
