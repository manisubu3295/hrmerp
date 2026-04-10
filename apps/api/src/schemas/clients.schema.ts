import { z } from 'zod';

export const createClientSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(200),
  contactName: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(), // legacy alias
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  uen: z.string().optional().nullable(),
  registrationNumber: z.string().optional().nullable(), // legacy alias
  industry: z.string().optional().nullable(),
  gstRegistered: z.boolean().optional().default(false),
  creditTermDays: z.number().int().min(0).max(365).optional().default(30),
});

export const updateClientSchema = createClientSchema.partial();
