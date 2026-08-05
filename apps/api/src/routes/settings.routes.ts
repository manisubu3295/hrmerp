import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { requirePermission } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { encryptField } from '../lib/encryption';
import { applyPreset } from '../lib/presets';
import { INDUSTRY_PRESETS } from '@sankoerp/database';

const router = Router();

// GET /settings/presets — list available industry vertical presets
router.get('/presets', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const presets = Object.values(INDUSTRY_PRESETS).map((p) => ({ key: p.key, name: p.name }));
    res.json({ success: true, data: presets });
  } catch (e) { next(e); }
});

// POST /settings/apply-preset — seed the caller's org with an industry preset's
// default leave policies, custom fields, and extra roles. Idempotent.
router.post('/apply-preset', requirePermission('organization:apply_preset'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { presetKey } = req.body as { presetKey?: string };
    if (!presetKey) throw new AppError(400, 'presetKey is required');
    await applyPreset(req.organizationId as string, presetKey);
    res.json({ success: true, data: { message: `Preset "${presetKey}" applied` } });
  } catch (e) { next(e); }
});

// GET /settings — returns the caller's own organization record
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.organizationId as string } });
    if (!org) throw new AppError(404, 'Organization not found');
    res.json({ success: true, data: org });
  } catch (e) {
    next(e);
  }
});

// PATCH /settings — update organisation details (admin only)
router.patch(
  '/',
  requirePermission('settings:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, uen, gstNo, email, phone, address } = req.body as Record<string, string | undefined>;

      const org = await prisma.organization.update({
        where: { id: req.organizationId as string },
        data: {
          ...(name !== undefined && { name }),
          ...(uen !== undefined && { uen }),
          ...(gstNo !== undefined && { gstNo }),
          ...(email !== undefined && { email }),
          ...(phone !== undefined && { phone }),
          ...(address !== undefined && { address }),
        },
      });

      res.json({ success: true, data: org });
    } catch (e) {
      next(e);
    }
  },
);

// GET /settings/sso — returns the caller's org SSO config (never the raw
// client secret — clientSecretEncrypted is omitted, callers only see whether one is set).
router.get('/sso', requirePermission('settings:sso:update'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await prisma.organizationSsoConfig.findUnique({ where: { organizationId: req.organizationId as string } });
    if (!config) {
      res.json({ success: true, data: null });
      return;
    }
    const { clientSecretEncrypted: _clientSecretEncrypted, ...safe } = config;
    res.json({ success: true, data: { ...safe, hasClientSecret: Boolean(config.clientSecretEncrypted) } });
  } catch (e) {
    next(e);
  }
});

// PUT /settings/sso — create/update the org's SSO connection. Disabled
// (enabled: false) until an admin explicitly flips it on, and the
// /auth/sso/:orgCode/* routes refuse to run until then regardless.
router.put('/sso', requirePermission('settings:sso:update'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider, issuerUrl, clientId, clientSecret, enabled } = req.body as {
      provider?: 'OIDC' | 'SAML';
      issuerUrl?: string;
      clientId?: string;
      clientSecret?: string;
      enabled?: boolean;
    };

    const config = await prisma.organizationSsoConfig.upsert({
      where: { organizationId: req.organizationId as string },
      update: {
        ...(provider !== undefined && { provider }),
        ...(issuerUrl !== undefined && { issuerUrl }),
        ...(clientId !== undefined && { clientId }),
        ...(clientSecret !== undefined && { clientSecretEncrypted: encryptField(clientSecret) }),
        ...(enabled !== undefined && { enabled }),
      },
      create: {
        organizationId: req.organizationId as string,
        provider: provider ?? 'OIDC',
        issuerUrl,
        clientId,
        clientSecretEncrypted: clientSecret ? encryptField(clientSecret) : undefined,
        enabled: enabled ?? false,
      },
    });

    const { clientSecretEncrypted: _clientSecretEncrypted, ...safe } = config;
    res.json({ success: true, data: { ...safe, hasClientSecret: Boolean(config.clientSecretEncrypted) } });
  } catch (e) {
    next(e);
  }
});

// ─── Statutory schemes (org-configurable payroll contribution rules) ──────

// Unguarded read — the Employee form needs this list to populate a scheme
// picker for anyone who can create/edit an employee, not just settings admins.
router.get('/statutory-schemes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schemes = await prisma.statutoryScheme.findMany({
      where: { organizationId: req.organizationId as string },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: schemes });
  } catch (e) { next(e); }
});

router.post('/statutory-schemes', requirePermission('statutory_scheme:manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, name, strategy, employeeRate, employerRate, wageCeiling } = req.body as {
      code?: string; name?: string; strategy?: 'SG_CPF' | 'FLAT_RATE';
      employeeRate?: number; employerRate?: number; wageCeiling?: number;
    };
    if (!code || !name || !strategy) throw new AppError(400, 'code, name, and strategy are required');

    const scheme = await prisma.statutoryScheme.create({
      data: {
        organizationId: req.organizationId as string,
        code, name, strategy,
        employeeRate, employerRate, wageCeiling,
      },
    });
    res.status(201).json({ success: true, data: scheme });
  } catch (e) { next(e); }
});

router.patch('/statutory-schemes/:id', requirePermission('statutory_scheme:manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.statutoryScheme.findUnique({ where: { id: req.params['id'] } });
    if (!existing) throw new AppError(404, `Statutory scheme ${req.params['id']} not found`);
    const { name, employeeRate, employerRate, wageCeiling, isActive } = req.body as {
      name?: string; employeeRate?: number; employerRate?: number; wageCeiling?: number; isActive?: boolean;
    };
    const scheme = await prisma.statutoryScheme.update({
      where: { id: req.params['id'] },
      data: {
        ...(name !== undefined && { name }),
        ...(employeeRate !== undefined && { employeeRate }),
        ...(employerRate !== undefined && { employerRate }),
        ...(wageCeiling !== undefined && { wageCeiling }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json({ success: true, data: scheme });
  } catch (e) { next(e); }
});

export default router;
