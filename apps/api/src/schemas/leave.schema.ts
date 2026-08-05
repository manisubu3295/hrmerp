import { z } from 'zod';
import { LeaveType } from '@prisma/client';

export const createLeavePolicySchema = z.object({
  leaveType: z.nativeEnum(LeaveType),
  name: z.string().min(1),
  daysPerYear: z.number().int().min(0),
  carryForwardMax: z.number().int().min(0).optional().default(0),
  isPaidLeave: z.boolean().optional().default(true),
  applicableTo: z.string().optional().nullable(),
});

export const initLeaveBalancesSchema = z.object({
  employeeId: z.string().min(1),
  year: z.number().int(),
});

export const createLeaveRequestSchema = z
  .object({
    employeeId: z.string().optional(),
    leaveType: z.nativeEnum(LeaveType),
    startDate: z.string(),
    endDate: z.string(),
    halfDay: z.boolean().optional().default(false),
    reason: z.string().optional().nullable(),
    attachmentUrl: z.string().optional().nullable(),
  })
  .refine((d) => new Date(d.startDate) <= new Date(d.endDate), {
    message: 'startDate must be before or equal to endDate',
    path: ['endDate'],
  });

export const approveLeaveRequestSchema = z.object({
  comment: z.string().optional(),
});

export const rejectLeaveRequestSchema = z.object({
  rejectionReason: z.string().min(1, 'A rejection reason is required'),
});
