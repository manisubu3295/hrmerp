import { z } from 'zod';

export const createSkillDefinitionSchema = z.object({
  name: z.string().min(1).max(150),
  category: z.string().optional().nullable(),
});

export const updateSkillDefinitionSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  category: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const setEmployeeSkillSchema = z.object({
  proficiency: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).optional().default('BEGINNER'),
  yearsExperience: z.number().min(0).optional().nullable(),
  certifiedAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
