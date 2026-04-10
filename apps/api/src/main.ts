import 'dotenv/config';
import express, { RequestHandler } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import prisma from './lib/prisma';
import { jwtMiddleware } from './middleware/auth.middleware';
import { errorHandler, notFound } from './middleware/error.middleware';
import { auditMiddleware } from './middleware/audit.middleware';
import { checkWorkPassExpiries } from './routes/compliance.routes';

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

const app = express();

// Security & logging middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env['FRONTEND_URL'] ?? 'http://localhost:3000', credentials: true }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically (no auth required)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Global rate limit: 200 req/min
const globalRateLimit = rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false });
app.use(globalRateLimit as unknown as RequestHandler);

// JWT authentication (validates all requests, public routes are whitelisted inside)
app.use(jwtMiddleware);

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

// Cron: check work pass expiries every day at 09:00
cron.schedule('0 9 * * *', () => {
  checkWorkPassExpiries().catch(console.error);
});

// Cron: mark SENT/PARTIAL invoices past due date as OVERDUE — runs daily at 08:00
cron.schedule('0 8 * * *', async () => {
  try {
    const result = await prisma.invoice.updateMany({
      where: {
        status: { in: ['SENT', 'PARTIALLY_PAID'] },
        dueDate: { lt: new Date() },
      },
      data: { status: 'OVERDUE' },
    });
    if (result.count > 0) {
      console.log(`[cron] Marked ${result.count} invoice(s) as OVERDUE`);
    }
  } catch (err) {
    console.error('[cron] Invoice overdue check failed:', err);
  }
});

// Cron: low equipment stock alert — runs daily at 08:30
cron.schedule('30 8 * * *', async () => {
  try {
    const lowStock = await prisma.equipmentItem.findMany({
      where: { availableQuantity: { lte: 2 } },
      select: { id: true, name: true, availableQuantity: true },
    });
    if (lowStock.length > 0) {
      console.log(`[cron] Low stock alert — ${lowStock.length} item(s): ${lowStock.map((e: { name: string; availableQuantity: number }) => `${e.name}(${e.availableQuantity})`).join(', ')}`);
    }
  } catch (err) {
    console.error('[cron] Low stock check failed:', err);
  }
});

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = Number(process.env['PORT'] ?? 4000);

prisma.$connect()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`SankoERP API running on http://localhost:${PORT}/api/v1`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  });
