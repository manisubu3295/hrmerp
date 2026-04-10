import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { parsePagination, buildPaginationMeta } from '../lib/pagination';
import { AppError } from '../middleware/error.middleware';
import { requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { createClientSchema, updateClientSchema } from '../schemas/clients.schema';
import { UserRole } from '@sankoerp/shared';
import { Prisma } from '@prisma/client';

const router = Router();

// GET /clients
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query as Record<string, unknown>);
    const search = req.query['search'] as unknown as string | undefined;
    const where: Prisma.ClientWhereInput = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' } }] }
      : {};

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where, skip, take,
        include: { _count: { select: { projects: true, invoices: true } } },
        orderBy: { name: 'asc' },
      }),
      prisma.client.count({ where }),
    ]);
    res.json({ success: true, data: { data: clients, meta: buildPaginationMeta(total, page, limit) } });
  } catch (e) { next(e); }
});

// POST /clients
router.post('/', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER), validate(createClientSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await prisma.client.count();
    const code = `CLI-${String(count + 1).padStart(4, '0')}`;
    const { name, contactPerson, email, phone, address, registrationNumber, industry, uen, contactName, contactEmail, contactPhone, gstRegistered, creditTermDays } = req.body;
    const client = await prisma.client.create({
      data: {
        code,
        name,
        contactName: contactName ?? contactPerson,
        contactEmail: contactEmail ?? email,
        contactPhone: contactPhone ?? phone,
        address,
        uen: uen ?? registrationNumber,
        gstRegistered: gstRegistered ?? false,
        creditTermDays: creditTermDays ?? 30,
      },
    });
    res.status(201).json({ success: true, data: client });
  } catch (e) { next(e); }
});

// GET /clients/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.params['id'] },
      include: {
        projects: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, projectCode: true, name: true, status: true } },
        invoices: { orderBy: { issueDate: 'desc' }, take: 5 },
      },
    });
    if (!client) throw new AppError(404, `Client ${req.params['id']} not found`);
    res.json({ success: true, data: client });
  } catch (e) { next(e); }
});

// PATCH /clients/:id
router.patch('/:id', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER), validate(updateClientSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.client.findUnique({ where: { id: req.params['id'] } });
    if (!existing) throw new AppError(404, `Client ${req.params['id']} not found`);
    const { name, contactPerson, email, phone, address, registrationNumber, industry, uen, contactName, contactEmail, contactPhone, gstRegistered, creditTermDays } = req.body;
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData['name'] = name;
    if (address !== undefined) updateData['address'] = address;
    if (gstRegistered !== undefined) updateData['gstRegistered'] = gstRegistered;
    if (creditTermDays !== undefined) updateData['creditTermDays'] = creditTermDays;
    if (contactName !== undefined) updateData['contactName'] = contactName;
    else if (contactPerson !== undefined) updateData['contactName'] = contactPerson;
    if (contactEmail !== undefined) updateData['contactEmail'] = contactEmail;
    else if (email !== undefined) updateData['contactEmail'] = email;
    if (contactPhone !== undefined) updateData['contactPhone'] = contactPhone;
    else if (phone !== undefined) updateData['contactPhone'] = phone;
    if (uen !== undefined) updateData['uen'] = uen;
    else if (registrationNumber !== undefined) updateData['uen'] = registrationNumber;
    const client = await prisma.client.update({ where: { id: req.params['id'] }, data: updateData });
    res.json({ success: true, data: client });
  } catch (e) { next(e); }
});

export default router;
