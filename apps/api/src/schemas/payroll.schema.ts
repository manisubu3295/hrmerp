import { z } from 'zod';

export const runPayrollSchema = z.object({
  projectId: z.string().optional(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
});
