import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { parsePagination, buildPaginationMeta } from '../lib/pagination';
import { AppError } from '../middleware/error.middleware';
import { requireRoles } from '../middleware/auth.middleware';
import { generateQuotationPdf } from '../lib/pdf';
import { sendEmail } from '../lib/email';
import { UserRole, QuotationStatus } from '@sankoerp/shared';
import { Prisma } from '@prisma/client';

const router = Router();

async function findQuotationOrFail(id: string) {
  const q = await prisma.quotation.findUnique({
    where: { id },
    include: {
      client: true,
      lineItems: { orderBy: { sortOrder: 'asc' } },
      project: { select: { id: true, projectCode: true, name: true, status: true } },
    },
  });
  if (!q) throw new AppError(404, `Quotation ${id} not found`);
  return q;
}

// GET /quotations
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query as Record<string, unknown>);
    const { search, status, clientId } = req.query as unknown as Record<string, string | undefined>;

    const where: Prisma.QuotationWhereInput = {
      ...(status && { status: status as QuotationStatus }),
      ...(clientId && { clientId }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { quotationCode: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({
        where, skip, take,
        include: { client: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.quotation.count({ where }),
    ]);

    res.json({ success: true, data: { data: quotations, meta: buildPaginationMeta(total, page, limit) } });
  } catch (e) { next(e); }
});

// POST /quotations
router.post('/', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = req.body;
    const count = await prisma.quotation.count();
    const year = new Date().getFullYear();
    const quotationCode = `QUO-${year}-${String(count + 1).padStart(4, '0')}`;

    const lineItems = (dto.lineItems as Array<{ description: string; workerType?: string; quantity: number; unit?: string; unitRate: number }>).map((item, idx) => ({
      description: item.description,
      workerType: item.workerType,
      quantity: item.quantity,
      unit: item.unit ?? 'days',
      unitRate: item.unitRate,
      amount: item.quantity * item.unitRate,
      sortOrder: idx,
    }));

    const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
    const discount = dto.discountAmount ?? 0;
    const taxRate = dto.taxRate ?? 0.09;
    const taxableAmount = subtotal - discount;
    const taxAmount = taxableAmount * taxRate;
    const totalAmount = taxableAmount + taxAmount;

    const quotation = await prisma.quotation.create({
      data: {
        quotationCode,
        clientId: dto.clientId,
        title: dto.title,
        description: dto.description,
        validUntil: new Date(dto.validUntil),
        subtotal, discountAmount: discount, taxRate, taxAmount, totalAmount,
        notes: dto.notes,
        termsAndCond: dto.termsAndCond,
        lineItems: { create: lineItems },
      },
      include: { client: true, lineItems: { orderBy: { sortOrder: 'asc' } } },
    });
    res.status(201).json({ success: true, data: quotation });
  } catch (e) { next(e); }
});

// GET /quotations/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = await findQuotationOrFail(req.params['id']!);
    res.json({ success: true, data: q });
  } catch (e) { next(e); }
});

// GET /quotations/:id/pdf
router.get('/:id/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = await findQuotationOrFail(req.params['id']!);
    const pdfBuffer = await generateQuotationPdf({
      quotationCode: q.quotationCode,
      title: q.title,
      validUntil: q.validUntil,
      client: q.client,
      lineItems: q.lineItems.map((l) => ({
        description: l.description,
        workerType: l.workerType,
        quantity: Number(l.quantity),
        unit: l.unit,
        unitRate: Number(l.unitRate),
        amount: Number(l.amount),
      })),
      subtotal: q.subtotal,
      discountAmount: q.discountAmount,
      taxRate: q.taxRate,
      taxAmount: q.taxAmount,
      totalAmount: q.totalAmount,
      notes: q.notes,
      termsAndCond: q.termsAndCond,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${q.quotationCode}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) { next(e); }
});

// PATCH /quotations/:id
router.patch('/:id', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']!;
    const q = await findQuotationOrFail(id);
    if (q.status !== 'DRAFT') throw new AppError(400, 'Only draft quotations can be edited');

    const dto = req.body;
    if (dto.lineItems) {
      await prisma.quotationLineItem.deleteMany({ where: { quotationId: id } });
      const lineItems = (dto.lineItems as Array<{ description: string; workerType?: string; quantity: number; unit?: string; unitRate: number }>).map((item, idx) => ({
        description: item.description,
        workerType: item.workerType,
        quantity: item.quantity,
        unit: item.unit ?? 'days',
        unitRate: item.unitRate,
        amount: item.quantity * item.unitRate,
        sortOrder: idx,
      }));
      const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
      const discount = dto.discountAmount ?? Number(q.discountAmount);
      const taxRate = dto.taxRate ?? Number(q.taxRate);
      const taxAmount = (subtotal - discount) * taxRate;
      const totalAmount = subtotal - discount + taxAmount;

      await prisma.quotation.update({
        where: { id },
        data: {
          subtotal, discountAmount: discount, taxRate, taxAmount, totalAmount,
          title: dto.title, description: dto.description, notes: dto.notes,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
          lineItems: { create: lineItems },
        },
      });
    }

    const updated = await findQuotationOrFail(id);
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// PATCH /quotations/:id/status
router.patch('/:id/status', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']!;
    const { status, reason } = req.body as { status: QuotationStatus; reason?: string };
    const q = await findQuotationOrFail(id);

    if (q.status === 'APPROVED' && status !== 'APPROVED') {
      throw new AppError(400, 'Approved quotation cannot be changed');
    }

    const data: Prisma.QuotationUpdateInput & { portalToken?: string } = { status };
    if (status === 'SENT') {
      data.sentAt = new Date();
      // Generate portal token so client can view/approve without logging in
      const portalToken = crypto.randomBytes(24).toString('hex');
      data.portalToken = portalToken;
      // Email the portal link to the client
      const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:3000';
      const portalUrl = `${frontendUrl}/portal/quotation/${portalToken}`;
      const clientEmail = (q.client as unknown as { contactEmail?: string; email?: string }).contactEmail
        ?? (q.client as unknown as { email?: string }).email;
      if (clientEmail) {
        try {
          await sendEmail({
            to: clientEmail,
            subject: `Quotation ${q.quotationCode} \u2014 ${q.title}`,
            html: `<p>Dear ${q.client.name},</p>
<p>Please review and approve your quotation:</p>
<p><a href="${portalUrl}" style="padding:10px 20px;background:#1976d2;color:white;text-decoration:none;border-radius:4px;">View Quotation</a></p>
<p>Quotation: <b>${q.quotationCode}</b><br>Amount: SGD ${Number(q.totalAmount).toFixed(2)}<br>Valid Until: ${q.validUntil.toDateString()}</p>`,
          });
        } catch {
          // Email failure is non-blocking
        }
      }
    }
    if (status === 'VIEWED') data.viewedAt = new Date();
    if (status === 'APPROVED') data.approvedAt = new Date();
    if (status === 'REJECTED') { data.rejectedAt = new Date(); data.rejectionReason = reason; }

    const updated = await (prisma.quotation as any).update({ where: { id }, data });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// POST /quotations/:id/convert-to-project
router.post('/:id/convert-to-project', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']!;
    const q = await findQuotationOrFail(id);
    if (q.status !== 'APPROVED') throw new AppError(400, 'Only approved quotations can be converted to projects');
    if (q.projectId) throw new AppError(400, 'Quotation already converted to a project');

    const count = await prisma.project.count();
    const year = new Date().getFullYear();
    const projectCode = `PRJ-${year}-${String(count + 1).padStart(4, '0')}`;

    const project = await prisma.project.create({
      data: {
        projectCode, name: q.title, description: q.description ?? undefined,
        clientId: q.clientId, startDate: new Date(), quotedBudget: q.totalAmount, status: 'ACTIVE',
      },
    });

    await prisma.quotation.update({ where: { id }, data: { projectId: project.id } });
    res.json({ success: true, data: { project, quotation: q } });
  } catch (e) { next(e); }
});

// GET /quotations/portal/:token — PUBLIC (no JWT required)
// Returns a read-only view of the quotation for the client to approve/reject
router.get('/portal/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const q = await (prisma.quotation as any).findUnique({
      where: { portalToken: token },
      include: {
        client: { select: { id: true, name: true, contactEmail: true } },
        lineItems: { orderBy: { sortOrder: 'asc' } },
      },
    }) as Awaited<ReturnType<typeof prisma.quotation.findUnique>> & { portalToken?: string } | null;
    if (!q) throw new AppError(404, 'Quotation not found or link has expired');

    // Auto-mark as VIEWED if it was SENT
    if (q.status === 'SENT') {
      await prisma.quotation.update({ where: { id: q.id }, data: { status: 'VIEWED', viewedAt: new Date() } });
    }

    res.json({ success: true, data: q });
  } catch (e) { next(e); }
});

// POST /quotations/portal/:token/approve — PUBLIC
router.post('/portal/:token/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const q = await (prisma.quotation as any).findUnique({ where: { portalToken: token } }) as Awaited<ReturnType<typeof prisma.quotation.findUnique>> | null;
    if (!q) throw new AppError(404, 'Quotation not found or link has expired');
    if (q.status === 'APPROVED') throw new AppError(400, 'Quotation already approved');
    if (q.status === 'REJECTED') throw new AppError(400, 'Quotation already rejected');
    if (q.validUntil < new Date()) throw new AppError(400, 'Quotation has expired');

    await prisma.quotation.update({
      where: { id: q.id },
      data: { status: 'APPROVED', approvedAt: new Date() },
    });
    res.json({ success: true, data: { message: 'Quotation approved successfully' } });
  } catch (e) { next(e); }
});

// POST /quotations/portal/:token/reject — PUBLIC
router.post('/portal/:token/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const { reason } = req.body as { reason?: string };
    const q = await (prisma.quotation as any).findUnique({ where: { portalToken: token } }) as Awaited<ReturnType<typeof prisma.quotation.findUnique>> | null;
    if (!q) throw new AppError(404, 'Quotation not found or link has expired');
    if (q.status === 'APPROVED') throw new AppError(400, 'Quotation already approved');
    if (q.status === 'REJECTED') throw new AppError(400, 'Quotation already rejected');

    await prisma.quotation.update({
      where: { id: q.id },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: reason },
    });
    res.json({ success: true, data: { message: 'Quotation rejected' } });
  } catch (e) { next(e); }
});

export default router;
