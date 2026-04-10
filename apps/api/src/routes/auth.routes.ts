import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { loginSchema, registerSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema } from '../schemas/auth.schema';
import { sendEmail, passwordResetEmailHtml } from '../lib/email';
import { UserRole } from '@sankoerp/shared';

const router = Router();

// Strict rate limit: 10 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again later' },
});

function signToken(userId: string, email: string, role: string): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  const expiresIn = process.env['JWT_EXPIRES_IN'] ?? '7d';
  return jwt.sign({ sub: userId, email, role }, secret, { expiresIn } as jwt.SignOptions);
}

// POST /auth/register — requires ADMIN or SUPER_ADMIN token
router.post(
  '/register',
  requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, role } = req.body as { email: string; password: string; role: string };

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) throw new AppError(409, 'Email already registered');

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: role as UserRole,
        },
        select: { id: true, email: true, role: true, createdAt: true },
      });

      res.status(201).json({ success: true, data: { user } });
    } catch (e) {
      next(e);
    }
  },
);

// POST /auth/login
router.post('/login', loginLimiter as unknown as RequestHandler, validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
      },
    });

    if (!user || !user.isActive) throw new AppError(401, 'Invalid credentials');

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) throw new AppError(401, 'Invalid credentials');

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const token = signToken(user.id, user.email, user.role);
    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, role: user.role, employee: user.employee },
        token,
      },
    });
  } catch (e) {
    next(e);
  }
});

// GET /auth/profile
router.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.sub;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
        employee: {
          select: {
            id: true, firstName: true, lastName: true,
            jobTitle: true, photoUrl: true, phone: true,
          },
        },
      },
    });
    if (!user) throw new AppError(404, 'User not found');
    res.json({ success: true, data: user });
  } catch (e) {
    next(e);
  }
});

// PATCH /auth/change-password
router.patch('/change-password', validate(changePasswordSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.sub;
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'User not found');

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) throw new AppError(401, 'Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    res.json({ success: true, data: { message: 'Password updated successfully' } });
  } catch (e) {
    next(e);
  }
});

// PATCH /auth/profile — update own email
router.patch('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.sub;
    const { email } = req.body as { email?: string };
    if (!email) throw new AppError(400, 'No fields to update');

    const conflict = await prisma.user.findFirst({ where: { email, id: { not: userId } } });
    if (conflict) throw new AppError(409, 'Email already in use');

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { email },
      select: { id: true, email: true, role: true },
    });
    res.json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
});

// POST /auth/forgot-password — public
router.post('/forgot-password', validate(forgotPasswordSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body as { email: string };
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return 200 to avoid email enumeration
    if (!user || !user.isActive) {
      res.json({ success: true, data: { message: 'If the email exists, a reset link has been sent' } });
      return;
    }

    // Expire any previously valid tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    const resetUrl = `${process.env['FRONTEND_URL'] ?? 'http://localhost:3000'}/reset-password/${token}`;
    await sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      html: passwordResetEmailHtml(resetUrl),
    });

    res.json({ success: true, data: { message: 'If the email exists, a reset link has been sent' } });
  } catch (e) {
    next(e);
  }
});

// POST /auth/reset-password/:token — public
router.post('/reset-password/:token', validate(resetPasswordSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body as { newPassword: string };

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new AppError(400, 'Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { token }, data: { usedAt: new Date() } }),
    ]);

    res.json({ success: true, data: { message: 'Password reset successfully' } });
  } catch (e) {
    next(e);
  }
});

export default router;
