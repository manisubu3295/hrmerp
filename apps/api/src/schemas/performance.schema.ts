import { z } from 'zod';

export const createReviewCycleSchema = z.object({
  name: z.string().min(1).max(150),
  periodStart: z.string({ required_error: 'Period start is required' }),
  periodEnd: z.string({ required_error: 'Period end is required' }),
});

export const updateReviewCycleSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED']).optional(),
});

export const generateReviewsSchema = z.object({
  employeeId: z.string().optional(),
  reviewerId: z.string().optional(),
});

export const submitSelfAssessmentSchema = z.object({
  selfAssessment: z.string().min(1),
  selfRating: z.number().int().min(1).max(5),
});

export const submitManagerReviewSchema = z.object({
  managerAssessment: z.string().min(1),
  managerRating: z.number().int().min(1).max(5),
});
