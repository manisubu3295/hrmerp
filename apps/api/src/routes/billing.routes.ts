import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { parsePagination, buildPaginationMeta } from '../lib/pagination';
import { AppError } from '../middleware/error.middleware';
import { requirePermission } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { createInvoiceSchema, recordPaymentSchema } from '../schemas/billing.schema';
import { generateInvoicePdf } from '../lib/pdf';
import { sendEmail, invoiceEmailHtml } from '../lib/email';
import { InvoiceStatus } from '@sankoerp/shared';
import { Prisma } from '@prisma/client';
import { emitEvent } from '../lib/events';
import { dispatchWebhookEvent } from '../lib/webhooks';

const router = Router();

async function findInvoiceOrFail(id: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      project: { select: { id: true, projectCode: true, name: true } },
      lineItems: { orderBy: { sortOrder: 'asc' } },
      payments: { orderBy: { paymentDate: 'desc' } },
    },
  });
  if (!invoice) throw new AppError(404, `Invoice ${id} not found`);
  return invoice;
}

// GET /billing/invoices
router.get('/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query as Record<string, unknown>);
    const { search, status, clientId, projectId } = req.query as unknown as Record<string, string | undefined>;

    const where: Prisma.InvoiceWhereInput = {
      ...(status && { status: status as InvoiceStatus }),
      ...(clientId && { clientId }),
      ...(projectId && { projectId }),
      ...(search && { OR: [{ invoiceCode: { contains: search, mode: 'insensitive' } }] }),
    };

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where, skip, take,
        include: {
          client: { select: { id: true, name: true } },
          project: { select: { id: true, projectCode: true, name: true } },
          payments: { orderBy: { paymentDate: 'desc' }, take: 1 },
        },
        orderBy: { issueDate: 'desc' },
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({ success: true, data: { data: invoices, meta: buildPaginationMeta(total, page, limit) } });
  } catch (e) { next(e); }
});

// POST /billing/invoices
router.post('/invoices', requirePermission('invoice:create'), validate(createInvoiceSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = req.body;
    const count = await prisma.invoice.count();
    const year = new Date().getFullYear();
    const invoiceCode = `INV-${year}-${String(count + 1).padStart(5, '0')}`;

    const lineItems = (dto.lineItems as Array<{ description: string; quantity: number; unit?: string; unitRate: number }>).map((item, idx) => ({
      organizationId: req.organizationId as string,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit ?? 'days',
      unitRate: item.unitRate,
      amount: item.quantity * item.unitRate,
      sortOrder: idx,
    }));

    const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
    const taxRate = dto.taxRate ?? 0.09;
    const taxAmount = subtotal * taxRate;
    const totalAmount = subtotal + taxAmount;

    const invoice = await prisma.invoice.create({
      data: {
        organizationId: req.organizationId as string,
        invoiceCode,
        clientId: dto.clientId,
        projectId: dto.projectId,
        issueDate: new Date(dto.issueDate),
        dueDate: new Date(dto.dueDate),
        subtotal, taxRate, taxAmount, totalAmount,
        outstandingAmount: totalAmount,
        status: 'DRAFT',
        notes: dto.notes,
        lineItems: { create: lineItems },
      },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, projectCode: true, name: true } },
        lineItems: { orderBy: { sortOrder: 'asc' } },
      },
    });
    res.status(201).json({ success: true, data: invoice });
  } catch (e) { next(e); }
});

// GET /billing/invoices/overdue
router.get('/invoices/overdue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    const overdue = await prisma.invoice.findMany({
      where: {
        status: { in: ['SENT', 'UNPAID', 'PARTIALLY_PAID'] },
        dueDate: { lt: today },
      },
      include: {
        client: { select: { id: true, name: true, contactEmail: true } },
        project: { select: { id: true, projectCode: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
    const result = overdue.map((i) => ({
      ...i,
      daysOverdue: Math.floor((today.getTime() - i.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
    }));
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

// GET /billing/summary
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [total, paid, outstanding, overdue] = await Promise.all([
      prisma.invoice.aggregate({ _sum: { totalAmount: true } }),
      prisma.invoice.aggregate({ where: { status: 'PAID' }, _sum: { paidAmount: true } }),
      prisma.invoice.aggregate({
        where: { status: { in: ['SENT', 'UNPAID', 'PARTIALLY_PAID'] } },
        _sum: { outstandingAmount: true },
      }),
      prisma.invoice.count({
        where: { status: { in: ['SENT', 'UNPAID', 'PARTIALLY_PAID'] }, dueDate: { lt: new Date() } },
      }),
    ]);
    res.json({
      success: true,
      data: {
        totalBilled: Number(total._sum.totalAmount ?? 0),
        totalCollected: Number(paid._sum.paidAmount ?? 0),
        totalOutstanding: Number(outstanding._sum.outstandingAmount ?? 0),
        overdueCount: overdue,
      },
    });
  } catch (e) { next(e); }
});

// GET /billing/invoices/:id
router.get('/invoices/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await findInvoiceOrFail(req.params['id']!);
    res.json({ success: true, data: invoice });
  } catch (e) { next(e); }
});

// GET /billing/invoices/:id/pdf
router.get('/invoices/:id/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await findInvoiceOrFail(req.params['id']!);
    const pdfBuffer = await generateInvoicePdf({
      invoiceCode: invoice.invoiceCode,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      client: invoice.client,
      project: invoice.project,
      lineItems: invoice.lineItems.map((l) => ({
        description: l.description,
        quantity: Number(l.quantity),
        unit: l.unit,
        unitRate: Number(l.unitRate),
        amount: Number(l.amount),
      })),
      subtotal: invoice.subtotal,
      taxRate: invoice.taxRate,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
      paidAmount: invoice.paidAmount,
      outstandingAmount: invoice.outstandingAmount,
      notes: invoice.notes,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceCode}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) { next(e); }
});

// PATCH /billing/invoices/:id/send
router.patch('/invoices/:id/send', requirePermission('invoice:send'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await findInvoiceOrFail(req.params['id']!);
    if (!['DRAFT', 'UNPAID'].includes(invoice.status)) {
      throw new AppError(400, 'Invoice cannot be sent in its current status');
    }
    const updated = await prisma.invoice.update({ where: { id: req.params['id'] }, data: { status: 'SENT' } });

    // Send email with PDF attachment if client email available
    if (invoice.client.contactEmail) {
      try {
        const pdfBuffer = await generateInvoicePdf({
          invoiceCode: invoice.invoiceCode,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          client: invoice.client,
          project: invoice.project,
          lineItems: invoice.lineItems.map((l) => ({
            description: l.description,
            quantity: Number(l.quantity),
            unit: l.unit,
            unitRate: Number(l.unitRate),
            amount: Number(l.amount),
          })),
          subtotal: invoice.subtotal,
          taxRate: invoice.taxRate,
          taxAmount: invoice.taxAmount,
          totalAmount: invoice.totalAmount,
          paidAmount: invoice.paidAmount,
          outstandingAmount: invoice.outstandingAmount,
          notes: invoice.notes,
        });
        const amountStr = `SGD ${Number(invoice.totalAmount).toFixed(2)}`;
        const dueDateStr = new Date(invoice.dueDate).toLocaleDateString('en-SG');
        await sendEmail({
          to: invoice.client.contactEmail,
          subject: `Invoice ${invoice.invoiceCode} from Aadhirai HRM OS`,
          html: invoiceEmailHtml(invoice.invoiceCode, invoice.client.name, amountStr, dueDateStr),
          attachments: [{ filename: `${invoice.invoiceCode}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
        });
      } catch (emailErr) {
        console.error('[Invoice Send] Email failed:', emailErr);
        // Don't fail the request if email fails
      }
    }

    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// POST /billing/invoices/:id/payments
router.post('/invoices/:id/payments', requirePermission('invoice:record_payment'), validate(recordPaymentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']!;
    const invoice = await findInvoiceOrFail(id);
    if (invoice.status === 'PAID') throw new AppError(400, 'Invoice is already fully paid');
    if (invoice.status === 'CANCELLED') throw new AppError(400, 'Cannot pay cancelled invoice');

    const dto = req.body as { amount: number; paymentDate: string; paymentMethod: string; reference?: string; notes?: string };
    if (dto.amount > Number(invoice.outstandingAmount)) {
      throw new AppError(400, `Payment amount exceeds outstanding balance`);
    }

    const payment = await prisma.payment.create({
      data: {
        organizationId: req.organizationId as string,
        invoiceId: id,
        amount: dto.amount,
        paymentDate: new Date(dto.paymentDate),
        paymentMethod: dto.paymentMethod,
        reference: dto.reference,
        notes: dto.notes,
      },
    });

    const newPaid = Number(invoice.paidAmount) + dto.amount;
    const newOutstanding = Number(invoice.totalAmount) - newPaid;
    const newStatus = (newOutstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID') as InvoiceStatus;

    await prisma.invoice.update({
      where: { id },
      data: { paidAmount: newPaid, outstandingAmount: Math.max(0, newOutstanding), status: newStatus },
    });

    emitEvent('payment.received', { organizationId: req.organizationId, invoiceId: id, invoiceCode: invoice.invoiceCode, amount: dto.amount, clientId: invoice.clientId });

    if (newStatus === 'PAID') {
      dispatchWebhookEvent(req.organizationId as string, 'invoice.paid', {
        invoiceId: id,
        invoiceCode: invoice.invoiceCode,
        totalAmount: Number(invoice.totalAmount),
        clientId: invoice.clientId,
      });
    }

    res.status(201).json({
      success: true,
      data: { payment, newStatus, paidAmount: newPaid, outstandingAmount: Math.max(0, newOutstanding) },
    });
  } catch (e) { next(e); }
});

// PATCH /billing/invoices/:id/cancel
router.patch('/invoices/:id/cancel', requirePermission('invoice:cancel'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await findInvoiceOrFail(req.params['id']!);
    if (invoice.status === 'PAID') throw new AppError(400, 'Cannot cancel a paid invoice');
    const updated = await prisma.invoice.update({ where: { id: req.params['id'] }, data: { status: 'CANCELLED' } });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

export default router;
