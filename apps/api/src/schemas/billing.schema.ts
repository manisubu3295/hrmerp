import { z } from 'zod';

const lineItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().optional().default('days'),
  unitRate: z.number().positive('Unit rate must be positive'),
});

export const createInvoiceSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  projectId: z.string().optional().nullable(),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required'),
  issueDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  taxRate: z.number().min(0).max(1).optional().default(0.09),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

export const recordPaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  paymentDate: z.string({ required_error: 'Payment date is required' }),
  paymentMethod: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
