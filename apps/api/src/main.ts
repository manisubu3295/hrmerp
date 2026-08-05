import 'dotenv/config';
import express, { RequestHandler } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import prisma, { prismaUnscoped } from './lib/prisma';
import { logger } from './lib/logger';
import { jwtMiddleware } from './middleware/auth.middleware';
import { tenantMiddleware } from './middleware/tenant.middleware';
import { errorHandler, notFound } from './middleware/error.middleware';
import { auditMiddleware } from './middleware/audit.middleware';
import { checkWorkPassExpiries } from './routes/compliance.routes';
import { checkEquipmentMaintenanceDue } from './routes/equipment.routes';
import { emitEvent } from './lib/events';

// Fail fast on a misconfigured environment rather than surfacing cryptic
// errors on the first request that needs auth, encryption, or the DB.
function assertEnv(): void {
  const missing = ['JWT_SECRET', 'ENCRYPTION_KEY', 'DATABASE_URL'].filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing required environment variable(s): ${missing.join(', ')}`);
    process.exit(1);
  }
  const encryptionKey = process.env['ENCRYPTION_KEY'] ?? '';
  if (!/^[0-9a-f]{64}$/i.test(encryptionKey)) {
    console.error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes) — see .env.example');
    process.exit(1);
  }
}

assertEnv();

import authRouter from './routes/auth.routes';
import clientsRouter from './routes/clients.routes';
import employeesRouter from './routes/employees.routes';
import projectsRouter from './routes/projects.routes';
import quotationsRouter from './routes/quotations.routes';
import expensesRouter from './routes/expenses.routes';
import billingRouter from './routes/billing.routes';
import equipmentRouter from './routes/equipment.routes';
import complianceRouter from './routes/compliance.routes';
import notificationsRouter from './routes/notifications.routes';
import reportsRouter from './routes/reports.routes';
import dashboardRouter from './routes/dashboard.routes';
import usersRouter from './routes/users.routes';
import timesheetsRouter from './routes/timesheets.routes';
import leaveRouter from './routes/leave.routes';
import calendarRouter from './routes/calendar.routes';
import uploadRouter from './routes/upload.routes';
import payrollRouter from './routes/payroll.routes';
import settingsRouter from './routes/settings.routes';
import suppliersRouter from './routes/suppliers.routes';
import customFieldsRouter from './routes/custom-fields.routes';
import approvalChainsRouter from './routes/approval-chains.routes';
import webhooksRouter from './routes/webhooks.routes';
import recruitmentRouter from './routes/recruitment.routes';
import checklistsRouter from './routes/checklists.routes';
import skillsRouter from './routes/skills.routes';
import performanceRouter from './routes/performance.routes';
import employeeCasesRouter from './routes/employee-cases.routes';

const app = express();

// Single reverse-proxy hop (nginx) in front of the app — trust its
// X-Forwarded-For so req.ip (and therefore rate limiting) reflects the
// real client, not the proxy.
app.set('trust proxy', 1);

// Security & logging middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env['FRONTEND_URL'] ?? 'http://localhost:3000', credentials: true }));
app.use(pinoHttp({ logger }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global rate limit: 200 req/min
const globalRateLimit = rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false });
app.use(globalRateLimit as unknown as RequestHandler);

// JWT authentication (validates all requests, public routes are whitelisted inside)
app.use(jwtMiddleware);

// Tenant context (org-scoping for the rest of the request pipeline)
app.use(tenantMiddleware);

// Serve uploaded files statically — requires a logged-in user (any tenant,
// not per-org authorized; acceptable for now since no UI renders these
// URLs directly, closes fully-anonymous access).
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Audit logging (fires on mutating requests after auth)
app.use(auditMiddleware);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// API routes
const API = '/api/v1';
app.use(`${API}/auth`, authRouter);
app.use(`${API}/clients`, clientsRouter);
app.use(`${API}/employees`, employeesRouter);
app.use(`${API}/projects`, projectsRouter);
app.use(`${API}/quotations`, quotationsRouter);
app.use(`${API}/expenses`, expensesRouter);
app.use(`${API}/billing`, billingRouter);
app.use(`${API}/equipment`, equipmentRouter);
app.use(`${API}/compliance`, complianceRouter);
app.use(`${API}/notifications`, notificationsRouter);
app.use(`${API}/reports`, reportsRouter);
app.use(`${API}/dashboard`, dashboardRouter);
app.use(`${API}/users`, usersRouter);
app.use(`${API}/timesheets`, timesheetsRouter);
app.use(`${API}/leave`, leaveRouter);
app.use(`${API}/calendar`, calendarRouter);
app.use(`${API}/upload`, uploadRouter);
app.use(`${API}/payroll`, payrollRouter);
app.use(`${API}/settings`, settingsRouter);
app.use(`${API}/suppliers`, suppliersRouter);
app.use(`${API}/custom-fields`, customFieldsRouter);
app.use(`${API}/approval-chains`, approvalChainsRouter);
app.use(`${API}/webhooks`, webhooksRouter);
app.use(`${API}/recruitment`, recruitmentRouter);
app.use(`${API}/checklists`, checklistsRouter);
app.use(`${API}/skills`, skillsRouter);
app.use(`${API}/performance`, performanceRouter);
app.use(`${API}/employee-cases`, employeeCasesRouter);

// Cron: check work pass expiries every day at 09:00
cron.schedule('0 9 * * *', () => {
  checkWorkPassExpiries().catch((err) => logger.error({ err }, '[cron] Work pass expiry check failed'));
});

// Cron: mark SENT/PARTIAL invoices past due date as OVERDUE — runs daily at 08:00
// Uses prismaUnscoped: this is a cross-tenant system job, not a per-request call.
cron.schedule('0 8 * * *', async () => {
  try {
    const result = await prismaUnscoped.invoice.updateMany({
      where: {
        status: { in: ['SENT', 'PARTIALLY_PAID'] },
        dueDate: { lt: new Date() },
      },
      data: { status: 'OVERDUE' },
    });
    if (result.count > 0) {
      logger.info(`[cron] Marked ${result.count} invoice(s) as OVERDUE`);
    }
  } catch (err) {
    logger.error({ err }, '[cron] Invoice overdue check failed');
  }
});

// Cron: low equipment stock alert — runs daily at 08:30
// Uses prismaUnscoped: this is a cross-tenant system job, not a per-request call.
cron.schedule('30 8 * * *', async () => {
  try {
    const items = await prismaUnscoped.equipmentItem.findMany({
      where: { isActive: true, trackingMode: 'BULK' },
      select: { id: true, organizationId: true, name: true, minStockLevel: true },
    });
    const stocks = await prismaUnscoped.warehouseStock.findMany({ select: { itemId: true, quantityOnHand: true } });
    const onHandByItem = new Map<string, number>();
    for (const s of stocks) onHandByItem.set(s.itemId, (onHandByItem.get(s.itemId) ?? 0) + s.quantityOnHand);

    let alerted = 0;
    for (const item of items) {
      const onHand = onHandByItem.get(item.id) ?? 0;
      if (onHand > item.minStockLevel) continue;
      alerted++;
      emitEvent('inventory.low_stock', {
        organizationId: item.organizationId, itemId: item.id, itemName: item.name,
        availableQuantity: onHand, minStockLevel: item.minStockLevel,
      });
    }
    if (alerted > 0) logger.info(`[cron] Low stock alert — ${alerted} item(s)`);
  } catch (err) {
    logger.error({ err }, '[cron] Low stock check failed');
  }
});

// Cron: equipment/asset maintenance due — runs daily at 09:15
cron.schedule('15 9 * * *', () => {
  checkEquipmentMaintenanceDue().catch((err) => logger.error({ err }, '[cron] Equipment maintenance check failed'));
});

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = Number(process.env['PORT'] ?? 4000);

async function connectWithRetry(attempts = 5, delayMs = 2000): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await prisma.$connect();
      return;
    } catch (err) {
      if (attempt === attempts) throw err;
      logger.warn(`Database connection attempt ${attempt}/${attempts} failed, retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

connectWithRetry()
  .then(() => {
    app.listen(PORT, () => {
      logger.info(`Aadhirai HRM OS API running on http://localhost:${PORT}/api/v1`);
    });
  })
  .catch((err) => {
    logger.error({ err }, 'Failed to connect to database');
    process.exit(1);
  });
