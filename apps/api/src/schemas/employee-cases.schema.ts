import { z } from 'zod';

export const createEmployeeCaseSchema = z.object({
  employeeId: z.string().optional(), // ignored/forced to caller's own unless employee_case:manage
  type: z.enum(['GRIEVANCE', 'DISCIPLINARY', 'HELPDESK']),
  category: z.string().optional().nullable(),
  title: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
  confidential: z.boolean().optional().default(true),
});

export const updateEmployeeCaseSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedToId: z.string().optional().nullable(),
  resolutionNotes: z.string().optional().nullable(),
});

export const createCaseCommentSchema = z.object({
  body: z.string().min(1),
  isInternal: z.boolean().optional().default(true),
});
