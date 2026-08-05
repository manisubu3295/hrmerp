import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { requirePermission } from '../middleware/auth.middleware';
import { INVOICE_OVERDUE_DAYS, WORK_PASS_ALERT_DAYS } from '@sankoerp/shared';
import { ProjectStatus, InvoiceStatus } from '@prisma/client';

const router = Router();

// GET /dashboard
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const overdueThreshold = new Date(now.getTime() - INVOICE_OVERDUE_DAYS * 24 * 60 * 60 * 1000);
    const passAlertDate = new Date(now.getTime() + WORK_PASS_ALERT_DAYS.WARNING * 24 * 60 * 60 * 1000);

    const [
      activeProjects,
      totalEmployees,
      overdueInvoices,
      expiringPasses,
      lowStockItems,
      monthlyRevenue,
      monthlyExpenses,
      monthlySalary,
      topProjects,
    ] = await Promise.all([
      prisma.project.count({ where: { status: ProjectStatus.ACTIVE } }),
      prisma.employee.count({ where: { isActive: true } }),
      prisma.invoice.count({
        where: { status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED] }, dueDate: { lt: overdueThreshold } },
      }),
      prisma.workPass.count({ where: { expiryDate: { lte: passAlertDate }, status: 'ACTIVE' } }),
      (async () => {
        const items = await prisma.equipmentItem.findMany({
          where: { isActive: true, trackingMode: 'BULK' },
          select: { id: true, minStockLevel: true },
        });
        if (items.length === 0) return 0;
        const stocks = await prisma.warehouseStock.groupBy({
          by: ['itemId'],
          where: { itemId: { in: items.map((i) => i.id) } },
          _sum: { quantityOnHand: true },
        });
        const onHandByItem = new Map(stocks.map((s) => [s.itemId, s._sum.quantityOnHand ?? 0]));
        return items.filter((i) => (onHandByItem.get(i.id) ?? 0) <= i.minStockLevel).length;
      })().catch(() => 0),
      prisma.payment.aggregate({ where: { paymentDate: { gte: monthStart, lte: monthEnd } }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { date: { gte: monthStart, lte: monthEnd }, status: 'APPROVED' }, _sum: { amount: true } }),
      prisma.attendance.aggregate({ where: { date: { gte: monthStart, lte: monthEnd } }, _sum: { dailyWage: true, overtimePay: true } }),
      prisma.project.findMany({
        where: { status: ProjectStatus.ACTIVE },
        take: 5,
        orderBy: { quotedBudget: 'desc' },
        include: { client: { select: { name: true } }, invoices: { select: { paidAmount: true } } },
      }),
    ]);

    const monthRev = Number(monthlyRevenue._sum.amount ?? 0);
    const monthExp = Number(monthlyExpenses._sum.amount ?? 0);
    const monthSal = Number(monthlySalary._sum.dailyWage ?? 0) + Number(monthlySalary._sum.overtimePay ?? 0);
    const monthlyCost = monthExp + monthSal;
    const monthlyProfit = monthRev - monthlyCost;
    const profitMargin = monthRev > 0 ? (monthlyProfit / monthRev) * 100 : 0;

    const topProjectData = topProjects.map((p) => {
      const revenue = (p.invoices as { paidAmount: unknown }[]).reduce((s, i) => s + Number(i.paidAmount), 0);
      const budget = Number(p.quotedBudget);
      const progress = budget > 0 ? (revenue / budget) * 100 : 0;
      return { id: p.id, projectCode: p.projectCode, name: p.name, clientName: (p.client as { name: string }).name, quotedBudget: budget, revenue, progress: Math.round(progress) };
    });

    // Traffic light indicators
    const trafficLights = {
      cashFlow: monthlyProfit > 0 ? 'GREEN' : monthlyProfit > -5000 ? 'AMBER' : 'RED',
      overdueInvoices: overdueInvoices === 0 ? 'GREEN' : overdueInvoices <= 3 ? 'AMBER' : 'RED',
      complianceStatus: expiringPasses === 0 ? 'GREEN' : expiringPasses <= 2 ? 'AMBER' : 'RED',
      employeeCapacity: activeProjects < totalEmployees / 5 ? 'GREEN' : activeProjects < totalEmployees / 3 ? 'AMBER' : 'RED',
    };

    // Recent alerts
    const alerts: { type: string; message: string; severity: string }[] = [];
    if (overdueInvoices > 0) alerts.push({ type: 'BILLING', message: `${overdueInvoices} invoice(s) overdue`, severity: 'HIGH' });
    if (expiringPasses > 0) alerts.push({ type: 'COMPLIANCE', message: `${expiringPasses} work pass(es) expiring soon`, severity: 'MEDIUM' });

    res.json({
      success: true,
      data: {
        kpis: { activeProjects, totalEmployees, overdueInvoices, expiringPasses, lowStockItems, monthlyRevenue: monthRev, monthlyCost, monthlyProfit, profitMargin: Math.round(profitMargin * 100) / 100 },
        topProjects: topProjectData,
        trafficLights,
        alerts,
      },
    });
  } catch (e) { next(e); }
});

// GET /dashboard/projects/:id/burndown
router.get('/projects/:id/burndown', requirePermission('dashboard:read_advanced'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params['id'] },
      select: { id: true, name: true, startDate: true, endDate: true, quotedBudget: true },
    });
    if (!project) { res.status(404).json({ success: false, message: 'Project not found' }); return; }

    const [expenses, attendances] = await Promise.all([
      prisma.expense.findMany({ where: { projectId: project.id, status: 'APPROVED' }, select: { date: true, amount: true } }),
      prisma.attendance.findMany({ where: { projectId: project.id }, select: { date: true, dailyWage: true, overtimePay: true } }),
    ]);

    // Build daily cost map
    const dailyMap: Map<string, number> = new Map();
    const addDay = (date: Date, cost: number) => {
      const key = date.toISOString().split('T')[0] as string;
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + cost);
    };
    expenses.forEach((e) => addDay(new Date(e.date), Number(e.amount)));
    attendances.forEach((a) => addDay(new Date(a.date), Number(a.dailyWage) + Number(a.overtimePay)));

    const sortedDays = Array.from(dailyMap.entries()).sort(([a], [b]) => a.localeCompare(b));
    let cumulative = 0;
    const burndown = sortedDays.map(([date, cost]) => { cumulative += cost; return { date, dailyCost: cost, cumulativeCost: cumulative }; });

    res.json({ success: true, data: { project: { id: project.id, name: project.name, quotedBudget: Number(project.quotedBudget) }, burndown } });
  } catch (e) { next(e); }
});

export default router;
