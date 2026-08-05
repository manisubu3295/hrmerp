import { z } from 'zod';

export const createChecklistTemplateSchema = z.object({
  purpose: z.enum(['ONBOARDING', 'OFFBOARDING']),
  name: z.string().min(1).max(150),
});

export const updateChecklistTemplateSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  isActive: z.boolean().optional(),
});

export const createChecklistTemplateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
  dueOffsetDays: z.number().int().optional().nullable(),
  assigneeRoleId: z.string().optional().nullable(),
});

export const updateChecklistTemplateTaskSchema = createChecklistTemplateTaskSchema.partial();

export const createChecklistInstanceSchema = z.object({
  employeeId: z.string().min(1),
  templateId: z.string().min(1),
  startDate: z.string({ required_error: 'Start date is required' }),
});

export const updateChecklistInstanceTaskSchema = z.object({
  isDone: z.boolean(),
});
