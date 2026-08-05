import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import prisma, { prismaUnscoped } from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { requirePermission } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { loginSchema, registerSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema } from '../schemas/auth.schema';
import { sendEmail, passwordResetEmailHtml } from '../lib/email';
import { UserRole } from '@sankoerp/shared';
import { buildAuthorizationUrl, handleCallback } from '../lib/sso';
import { dispatchWebhookEvent } from '../lib/webhooks';

const router = Router();

// Strict rate limit: 10 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again later' },
  // Skip rate limiting for localhost (used by automated tests)
  skip: (req) => {
    const ip = req.ip ?? '';
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  },
});

type Persona = 'EMPLOYER' | 'EMPLOYEE' | 'VENDOR' | 'CLIENT';

function signAccessToken(
  userId: string,
  email: string,
  role: string,
  organizationId: string | null,
  persona: Persona,
  expiresIn: string,
): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return jwt.sign({ sub: userId, email, role, organizationId, persona }, secret, { expiresIn } as jwt.SignOptions);
}

function signToken(userId: string, email: string, role: string, organizationId: string | null): string {
  // Employer/Employee persona: EMPLOYEE-role users are the "Employee self-service"
  // persona, everyone else is "Employer" — see tenant.middleware.ts.
  const persona: Persona = role === UserRole.EMPLOYEE ? 'EMPLOYEE' : 'EMPLOYER';
  const expiresIn = process.env['JWT_ACCESS_EXPIRES_IN'] ?? '15m';
  return signAccessToken(userId, email, role, organizationId, persona, expiresIn);
}

const REFRESH_TOKEN_TTL_DAYS = 30;

function hashRefreshToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

async function createRefreshToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(48).toString('hex');
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(rawToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  return rawToken;
}

// POST /auth/register — requires ADMIN or SUPER_ADMIN token
router.post(
  '/register',
  requirePermission('user:create'),
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
          organizationId: req.organizationId as string,
        },
        select: { id: true, email: true, role: true, createdAt: true },
      });

      dispatchWebhookEvent(req.organizationId as string, 'user.created', { userId: user.id, email: user.email, role: user.role });

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

    const token = signToken(user.id, user.email, user.role, user.organizationId);
    const refreshToken = await createRefreshToken(user.id);
    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, role: user.role, organizationId: user.organizationId, employee: user.employee },
        token,
        refreshToken,
      },
    });
  } catch (e) {
    next(e);
  }
});

// POST /auth/refresh — public (authenticated via the refresh token itself, not a JWT)
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) throw new AppError(400, 'refreshToken is required');

    const tokenHash = hashRefreshToken(refreshToken);
    const existing = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });

    if (!existing || existing.revokedAt || existing.expiresAt < new Date() || !existing.user.isActive) {
      throw new AppError(401, 'Invalid or expired refresh token');
    }

    // Rotate: revoke the used token, issue a new one
    await prisma.refreshToken.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
    const newRefreshToken = await createRefreshToken(existing.user.id);
    const newAccessToken = signToken(existing.user.id, existing.user.email, existing.user.role, existing.user.organizationId);

    res.json({ success: true, data: { token: newAccessToken, refreshToken: newRefreshToken } });
  } catch (e) {
    next(e);
  }
});

// POST /auth/logout — public (revokes the given refresh token; access token just expires naturally)
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    res.json({ success: true, data: { message: 'Logged out' } });
  } catch (e) {
    next(e);
  }
});

// POST /auth/vendor/login — public. Vendor portal identity (VendorPortalUser), not
// a `User` row, so it's looked up separately. Email is only unique per-organization
// (a vendor can serve multiple tenants), so the caller must specify which org via
// orgCode — same reason this can't reuse the employer /login flow.
router.post('/vendor/login', loginLimiter as unknown as RequestHandler, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgCode, email, password } = req.body as { orgCode?: string; email?: string; password?: string };
    if (!orgCode || !email || !password) throw new AppError(400, 'orgCode, email and password are required');

    const org = await prismaUnscoped.organization.findUnique({ where: { code: orgCode } });
    if (!org) throw new AppError(401, 'Invalid credentials');

    const vendorUser = await prismaUnscoped.vendorPortalUser.findUnique({
      where: { organizationId_email: { organizationId: org.id, email } },
    });
    if (!vendorUser || !vendorUser.isActive) throw new AppError(401, 'Invalid credentials');

    const isMatch = await bcrypt.compare(password, vendorUser.passwordHash);
    if (!isMatch) throw new AppError(401, 'Invalid credentials');

    // No refresh-token support yet for this persona (identity-only scaffold —
    // the vendor portal itself is Phase 4 work), so this token lives longer.
    const token = signAccessToken(vendorUser.id, vendorUser.email, 'VENDOR', org.id, 'VENDOR', '1d');
    res.json({ success: true, data: { user: { id: vendorUser.id, email: vendorUser.email, organizationId: org.id }, token } });
  } catch (e) {
    next(e);
  }
});

// POST /auth/client/login — public. Mirrors /auth/vendor/login for ClientPortalUser.
router.post('/client/login', loginLimiter as unknown as RequestHandler, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgCode, email, password } = req.body as { orgCode?: string; email?: string; password?: string };
    if (!orgCode || !email || !password) throw new AppError(400, 'orgCode, email and password are required');

    const org = await prismaUnscoped.organization.findUnique({ where: { code: orgCode } });
    if (!org) throw new AppError(401, 'Invalid credentials');

    const clientUser = await prismaUnscoped.clientPortalUser.findUnique({
      where: { organizationId_email: { organizationId: org.id, email } },
    });
    if (!clientUser || !clientUser.isActive) throw new AppError(401, 'Invalid credentials');

    const isMatch = await bcrypt.compare(password, clientUser.passwordHash);
    if (!isMatch) throw new AppError(401, 'Invalid credentials');

    const token = signAccessToken(clientUser.id, clientUser.email, 'CLIENT', org.id, 'CLIENT', '1d');
    res.json({ success: true, data: { user: { id: clientUser.id, email: clientUser.email, organizationId: org.id }, token } });
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

// GET /auth/sso/:orgCode/login — public. Redirects to the org's configured
// IdP. Returns 503 until an org admin enables SSO (settings.routes.ts) with
// real IdP credentials — cannot be completed without those.
router.get('/sso/:orgCode/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgCode } = req.params;
    const org = await prismaUnscoped.organization.findUnique({
      where: { code: orgCode },
      include: { ssoConfig: true },
    });
    if (!org?.ssoConfig?.enabled) {
      res.status(503).json({ success: false, message: 'SSO is not enabled for this organization' });
      return;
    }

    const redirectUri = `${process.env['API_URL'] ?? 'http://localhost:4000/api/v1'}/auth/sso/${orgCode}/callback`;
    const authUrl = await buildAuthorizationUrl(
      { organizationId: org.id, issuerUrl: org.ssoConfig.issuerUrl, clientId: org.ssoConfig.clientId, clientSecretEncrypted: org.ssoConfig.clientSecretEncrypted },
      redirectUri,
    );
    res.redirect(authUrl);
  } catch (e) {
    next(e);
  }
});

// GET /auth/sso/:orgCode/callback — public. Completes the IdP redirect,
// resolves the matching local User by email within the org, and hands back
// to the frontend with a normal access+refresh token pair.
router.get('/sso/:orgCode/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgCode } = req.params;
    const org = await prismaUnscoped.organization.findUnique({
      where: { code: orgCode },
      include: { ssoConfig: true },
    });
    if (!org?.ssoConfig?.enabled) {
      res.status(503).json({ success: false, message: 'SSO is not enabled for this organization' });
      return;
    }

    const callbackUrl = new URL(req.originalUrl, process.env['API_URL'] ?? 'http://localhost:4000');
    const result = await handleCallback(
      { organizationId: org.id, issuerUrl: org.ssoConfig.issuerUrl, clientId: org.ssoConfig.clientId, clientSecretEncrypted: org.ssoConfig.clientSecretEncrypted },
      callbackUrl,
    );

    if (!result.email) throw new AppError(400, 'SSO provider did not return an email claim');
    const user = await prismaUnscoped.user.findUnique({ where: { email: result.email } });
    if (!user || !user.isActive || user.organizationId !== org.id) {
      throw new AppError(403, 'No matching active account for this SSO identity in this organization');
    }

    const token = signToken(user.id, user.email, user.role, user.organizationId);
    const refreshToken = await createRefreshToken(user.id);
    const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/sso-callback?token=${token}&refreshToken=${refreshToken}`);
  } catch (e) {
    next(e);
  }
});

export default router;
