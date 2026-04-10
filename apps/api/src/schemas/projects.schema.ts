import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200),
  description: z.string().optional().nullable(),
  clientId: z.string().min(1, 'Client is required'),
  managerId: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  startDate: z.string({ required_error: 'Start date is required' }),
  endDate: z.string().optional().nullable(),
  quotedBudget: z.number().min(0).optional().default(0),
  targetMargin: z.number().min(0).max(1).optional().default(0.15),
  overheadPercent: z.number().min(0).max(1).optional().default(0),
  status: z.enum(['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional().default('DRAFT'),
  notes: z.string().optional().nullable(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const assignEmployeeSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  role: z.string().optional().nullable(),
  dailyRate: z.number().positive({ message: 'Daily rate must be positive' }),
});
