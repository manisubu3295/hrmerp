import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';
import { requireRoles } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { UserRole } from '@sankoerp/shared';
import { parsePagination, buildPaginationMeta } from '../lib/pagination';

const router = Router();

// GET /users
router.get('/', requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query);
    const { search, role, isActive } = req.query as unknown as Record<string, string | undefined>;

    const where = {
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(role && { role: role as UserRole }),
      ...(isActive !== undefined && { isActive: isActive === 'true' }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, role: true, isActive: true,
          createdAt: true, updatedAt: true, lastLoginAt: true,
          employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ success: true, data: users, meta: buildPaginationMeta(total, page, limit) });
  } catch (e) { next(e); }
});

// GET /users/:id
router.get('/:id', requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params['id'] },
      select: {
        id: true, email: true, role: true, isActive: true,
        createdAt: true, updatedAt: true, lastLoginAt: true,
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, jobTitle: true } },
      },
    });
    if (!user) throw new AppError(404, 'User not found');
    res.json({ success: true, data: user });
  } catch (e) { next(e); }
});

// POST /users — create a new user (ADMIN/SUPER_ADMIN)
router.post('/', requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, role, employeeId } = req.body as {
      email: string; password: string; role: string; employeeId?: string;
    };
    if (!email || !password) throw new AppError(400, 'Email and password are required');
    if (!Object.values(UserRole).includes(role as UserRole)) throw new AppError(400, 'Invalid role');
    // Only SUPER_ADMIN can create ADMIN or SUPER_ADMIN
    const requesterRole = req.user?.role;
    if (
      (role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN) &&
      requesterRole !== UserRole.SUPER_ADMIN
    ) {
      throw new AppError(403, 'Only SUPER_ADMIN can create admin accounts');
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError(409, 'Email already registered');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: role as UserRole,
        ...(employeeId && { employee: { connect: { id: employeeId } } }),
      },
      select: { id: true, email: true, role: true, isActive: true, createdAt: true },
    });
    res.status(201).json({ success: true, data: user });
  } catch (e) { next(e); }
});

// PATCH /users/:id — update email or employeeId link
router.patch('/:id', requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, employeeId } = req.body as { email?: string; employeeId?: string | null };
    const updates: Record<string, unknown> = {};
    if (email) {
      const conflict = await prisma.user.findFirst({ where: { email, id: { not: req.params['id'] } } });
      if (conflict) throw new AppError(409, 'Email already in use');
      updates.email = email;
    }
    if (employeeId !== undefined) {
      updates.employee = employeeId ? { connect: { id: employeeId } } : { disconnect: true };
    }
    const user = await prisma.user.update({
      where: { id: req.params['id'] },
      data: updates,
      select: { id: true, email: true, role: true, isActive: true },
    });
    res.json({ success: true, data: user });
  } catch (e) { next(e); }
});

// POST /users/:id/reset-password — admin resets a user's password
router.post('/:id/reset-password', requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { newPassword } = req.body as { newPassword: string };
    if (!newPassword || newPassword.length < 8) throw new AppError(400, 'New password must be at least 8 characters');
    // ADMIN cannot reset SUPER_ADMIN passwords
    const target = await prisma.user.findUnique({ where: { id: req.params['id'] } });
    if (!target) throw new AppError(404, 'User not found');
    if (target.role === UserRole.SUPER_ADMIN && req.user?.role !== UserRole.SUPER_ADMIN) {
      throw new AppError(403, 'Only SUPER_ADMIN can reset another super admin\'s password');
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.params['id'] }, data: { passwordHash } });
    res.json({ success: true, data: { message: 'Password reset successfully' } });
  } catch (e) { next(e); }
});

// PATCH /users/:id/role
router.patch('/:id/role', requireRoles(UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role } = req.body as { role: string };
    if (!role || !Object.values(UserRole).includes(role as UserRole)) {
      throw new AppError(400, 'Invalid role provided');
    }
    // Prevent demoting the last super admin
    if (role !== UserRole.SUPER_ADMIN) {
      const target = await prisma.user.findUnique({ where: { id: req.params['id'] } });
      if (target?.role === UserRole.SUPER_ADMIN) {
        const superAdminCount = await prisma.user.count({ where: { role: UserRole.SUPER_ADMIN, isActive: true } });
        if (superAdminCount <= 1) throw new AppError(400, 'Cannot remove the last super admin');
      }
    }
    const user = await prisma.user.update({
      where: { id: req.params['id'] },
      data: { role: role as UserRole },
      select: { id: true, email: true, role: true, isActive: true },
    });
    res.json({ success: true, data: user });
  } catch (e) { next(e); }
});

// PATCH /users/:id/active
router.patch('/:id/active', requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.params['id'] === req.user?.sub) throw new AppError(400, 'Cannot change your own active status');
    const { isActive } = req.body as { isActive: boolean };
    if (typeof isActive !== 'boolean') throw new AppError(400, 'isActive must be a boolean');
    const user = await prisma.user.update({
      where: { id: req.params['id'] },
      data: { isActive },
      select: { id: true, email: true, role: true, isActive: true },
    });
    res.json({ success: true, data: user });
  } catch (e) { next(e); }
});

export default router;
