import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { requirePermission } from '../middleware/auth.middleware';
import { Prisma, ProjectStatus } from '@prisma/client';
import { monthRangeUTC } from '../lib/dates';

/** Convert an array of objects to CSV string */
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}

const router = Router();

// GET /reports/profit
router.get('/profit', requirePermission('reports:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, clientId } = req.query as unknown as Record<string, string | undefined>;

    const where: Prisma.ProjectWhereInput = {
      status: { in: [ProjectStatus.ACTIVE, ProjectStatus.COMPLETED] },
      ...(clientId && { clientId }),
      ...(startDate && endDate && {
        startDate: { gte: new Date(startDate) },
        endDate: { lte: new Date(endDate) },
      }),
    };

    const projects = await prisma.project.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        invoices: true,
        expenses: { where: { status: 'APPROVED' } },
        equipmentIssues: true,
        attendances: true,
      },
    });

    const profitReports = projects.map((project) => {
      const revenue = project.invoices.reduce((s, i) => s + Number(i.paidAmount), 0);
      const totalBilled = project.invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
      const salaryCost = project.attendances.reduce((s, a) => s + Number(a.dailyWage) + Number(a.overtimePay), 0);
      const expenseCost = project.expenses.reduce((s, e) => s + Number(e.amount), 0);
      const equipmentCost = project.equipmentIssues.reduce((s, e) => s + Number(e.totalCost), 0);
      const totalCostBeforeOverhead = salaryCost + expenseCost + equipmentCost;
      const overheadCost = totalCostBeforeOverhead * Number(project.overheadPercent);
      const totalCost = totalCostBeforeOverhead + overheadCost;
      const netProfit = revenue - totalCost;
      const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

      return {
        projectId: project.id, projectCode: project.projectCode, projectName: project.name,
        clientName: project.client.name, status: project.status,
        startDate: project.startDate, endDate: project.endDate ?? project.actualEndDate,
        totalBilled, revenue, salaryCost, expenseCost, equipmentCost, overheadCost, totalCost,
        netProfit, profitMargin: Math.round(profitMargin * 100) / 100,
        targetMargin: Number(project.targetMargin) * 100,
        isBelowTarget: profitMargin < Number(project.targetMargin) * 100,
      };
    });

    const totals = profitReports.reduce(
      (acc, p) => ({
        totalRevenue: acc.totalRevenue + p.revenue,
        totalCost: acc.totalCost + p.totalCost,
        totalProfit: acc.totalProfit + p.netProfit,
      }),
      { totalRevenue: 0, totalCost: 0, totalProfit: 0 },
    );

    const avgMargin = totals.totalRevenue > 0 ? (totals.totalProfit / totals.totalRevenue) * 100 : 0;

    res.json({
      success: true,
      data: {
        projects: profitReports,
        summary: {
          ...totals,
          avgProfitMargin: Math.round(avgMargin * 100) / 100,
          profitableProjects: profitReports.filter((p) => p.netProfit > 0).length,
          losingProjects: profitReports.filter((p) => p.netProfit < 0).length,
        },
      },
    });
  } catch (e) { next(e); }
});

// GET /reports/monthly-trends
router.get('/monthly-trends', requirePermission('reports:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const year = Number(req.query['year']) || new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    const trends = await Promise.all(
      months.map(async (month) => {
        const { start, end } = monthRangeUTC(year, month);

        const [revenue, expenses, payroll] = await Promise.all([
          prisma.payment.aggregate({ where: { paymentDate: { gte: start, lte: end } }, _sum: { amount: true } }),
          prisma.expense.aggregate({ where: { date: { gte: start, lte: end }, status: 'APPROVED' }, _sum: { amount: true } }),
          prisma.attendance.aggregate({ where: { date: { gte: start, lte: end } }, _sum: { dailyWage: true, overtimePay: true } }),
        ]);

        const rev = Number(revenue._sum.amount ?? 0);
        const exp = Number(expenses._sum.amount ?? 0);
        const sal = Number(payroll._sum.dailyWage ?? 0) + Number(payroll._sum.overtimePay ?? 0);
        return { month, revenue: rev, expenses: exp, salary: sal, profit: rev - exp - sal };
      }),
    );

    res.json({ success: true, data: { year, months: trends } });
  } catch (e) { next(e); }
});

// GET /reports/clients
router.get('/clients', requirePermission('reports:read'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const clients = await prisma.client.findMany({
      include: {
        projects: {
          include: {
            invoices: true,
            expenses: { where: { status: 'APPROVED' } },
            attendances: true,
          },
        },
      },
    });

    const result = clients.map((client) => {
      const totalRevenue = client.projects.reduce((s, p) =>
        s + p.invoices.reduce((si, i) => si + Number(i.paidAmount), 0), 0,
      );
      return {
        clientId: client.id, clientName: client.name,
        totalProjects: client.projects.length,
        activeProjects: client.projects.filter((p) => p.status === 'ACTIVE').length,
        totalRevenue,
      };
    });

    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

// GET /reports/employee-productivity
router.get('/employee-productivity', requirePermission('reports:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate: sd, endDate: ed } = req.query as unknown as Record<string, string | undefined>;
    const startDate = sd ? new Date(sd) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = ed ? new Date(ed) : new Date();

    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      include: {
        attendances: {
          where: { date: { gte: startDate, lte: endDate } },
          include: { project: { select: { id: true, projectCode: true, name: true } } },
        },
      },
    });

    const result = employees
      .map((emp) => {
        const daysWorked = emp.attendances.filter((a) => a.status === 'PRESENT').length;
        const totalEarnings = emp.attendances.reduce((s, a) => s + Number(a.dailyWage) + Number(a.overtimePay), 0);
        const projectsWorked = new Set(emp.attendances.map((a) => a.projectId).filter(Boolean)).size;
        return { employeeId: emp.id, name: `${emp.firstName} ${emp.lastName}`, employeeCode: emp.employeeCode, daysWorked, totalEarnings, projectsWorked };
      })
      .filter((e) => e.daysWorked > 0);

    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

// GET /reports/export/timesheets — CSV export of attendance records
router.get('/export/timesheets', requirePermission('reports:export'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month, year, employeeId, projectId } = req.query as Record<string, string | undefined>;

    const exportPeriod = month && year ? monthRangeUTC(Number(year), Number(month)) : null;
    const where: Prisma.AttendanceWhereInput = {
      ...(employeeId && { employeeId }),
      ...(projectId && { projectId }),
      ...(exportPeriod && { date: { gte: exportPeriod.start, lte: exportPeriod.end } }),
    };

    const rows = await prisma.attendance.findMany({
      where,
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
        project: { select: { projectCode: true, name: true } },
      },
      orderBy: [{ date: 'asc' }],
    });

    const csvRows = rows.map((r) => ({
      employeeCode: r.employee.employeeCode,
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
      projectCode: r.project?.projectCode ?? '',
      projectName: r.project?.name ?? '',
      date: r.date.toISOString().split('T')[0],
      status: r.status,
      hoursWorked: r.hoursWorked ?? '',
      overtimeHours: r.overtimeHours ?? '',
      dailyWage: r.dailyWage,
      overtimePay: r.overtimePay,
    }));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="timesheets-${year ?? 'all'}-${month ?? 'all'}.csv"`);
    res.send(toCsv(csvRows as unknown as Record<string, unknown>[]));
  } catch (e) { next(e); }
});

// GET /reports/export/profit — CSV export of project profit report
router.get('/export/profit', requirePermission('reports:export'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, clientId } = req.query as Record<string, string | undefined>;

    const where: Prisma.ProjectWhereInput = {
      status: { in: [ProjectStatus.ACTIVE, ProjectStatus.COMPLETED] },
      ...(clientId && { clientId }),
      ...(startDate && endDate && {
        startDate: { gte: new Date(startDate) },
        endDate: { lte: new Date(endDate) },
      }),
    };

    const projects = await prisma.project.findMany({
      where,
      include: {
        client: { select: { name: true } },
        invoices: true,
        expenses: { where: { status: 'APPROVED' } },
        equipmentIssues: true,
        attendances: true,
      },
    });

    const csvRows = projects.map((project) => {
      const revenue = project.invoices.reduce((s, i) => s + Number(i.paidAmount), 0);
      const salaryCost = project.attendances.reduce((s, a) => s + Number(a.dailyWage) + Number(a.overtimePay), 0);
      const expenseCost = project.expenses.reduce((s, e) => s + Number(e.amount), 0);
      const equipmentCost = project.equipmentIssues.reduce((s, e) => s + Number(e.totalCost), 0);
      const totalCost = salaryCost + expenseCost + equipmentCost;
      const netProfit = revenue - totalCost;
      return {
        projectCode: project.projectCode,
        projectName: project.name,
        client: project.client.name,
        status: project.status,
        revenue: revenue.toFixed(2),
        salaryCost: salaryCost.toFixed(2),
        expenseCost: expenseCost.toFixed(2),
        equipmentCost: equipmentCost.toFixed(2),
        totalCost: totalCost.toFixed(2),
        netProfit: netProfit.toFixed(2),
        profitMargin: revenue > 0 ? `${((netProfit / revenue) * 100).toFixed(1)}%` : '0%',
      };
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="profit-report.csv"');
    res.send(toCsv(csvRows));
  } catch (e) { next(e); }
});

// GET /reports/export/payroll — CSV export of payroll records for a period
router.get('/export/payroll', requirePermission('reports:export'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month, year } = req.query as Record<string, string | undefined>;

    const rows = await prisma.payrollRecord.findMany({
      where: {
        ...(month && { month: Number(month) }),
        ...(year && { year: Number(year) }),
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    // Fetch employee details in parallel
    const employeeIds = [...new Set(rows.map((r) => r.employeeId))];
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, firstName: true, lastName: true, employeeCode: true, jobTitle: true },
    });
    const empMap = new Map(employees.map((e) => [e.id, e]));

    const csvRows = rows.map((r) => {
      const emp = empMap.get(r.employeeId);
      return {
        employeeCode: emp?.employeeCode ?? r.employeeId,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : '',
        jobTitle: emp?.jobTitle ?? '',
        year: r.year,
        month: r.month,
        daysWorked: r.daysWorked,
        basicPay: Number(r.basicPay).toFixed(2),
        allowances: Number(r.allowances).toFixed(2),
        overtimePay: Number(r.overtimePay).toFixed(2),
        grossPay: (Number(r.basicPay) + Number(r.overtimePay) + Number(r.allowances)).toFixed(2),
        cpfEmployee: Number(r.cpfEmployee).toFixed(2),
        cpfEmployer: Number(r.cpfEmployer).toFixed(2),
        totalPayable: Number(r.totalPayable).toFixed(2),
        totalCostToCompany: Number(r.totalCostToCompany).toFixed(2),
        isPaid: r.isPaid ? 'Yes' : 'No',
      };
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-${year ?? 'all'}-${month ?? 'all'}.csv"`);
    res.send(toCsv(csvRows));
  } catch (e) { next(e); }
});

// GET /reports/generate?type=... — Table data for the Reports page
router.get('/generate', requirePermission('reports:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type } = req.query as { type?: string };

    switch (type) {
      case 'projects': {
        const data = await prisma.project.findMany({
          include: { client: { select: { name: true } }, _count: { select: { employees: true } } },
          orderBy: { createdAt: 'desc' },
        });
        return res.json({ success: true, data: data.map((p) => ({
          projectCode: p.projectCode, name: p.name, client: p.client?.name ?? '',
          status: p.status, startDate: p.startDate, endDate: p.endDate ?? p.actualEndDate,
          quotedBudget: Number(p.quotedBudget), employees: p._count.employees,
        })) });
      }

      case 'employees': {
        const data = await prisma.employee.findMany({
          include: { workPass: { where: { status: 'ACTIVE' }, take: 1, orderBy: { expiryDate: 'desc' } } },
          orderBy: { createdAt: 'desc' },
        });
        return res.json({ success: true, data: data.map((e) => ({
          employeeCode: e.employeeCode, name: `${e.firstName} ${e.lastName}`,
          nationality: e.nationality ?? '', jobTitle: e.jobTitle ?? '', department: e.department ?? '',
          passType: e.workPass[0]?.passType ?? '', status: e.isActive ? 'Active' : 'Inactive',
        })) });
      }

      case 'billing': {
        const data = await prisma.invoice.findMany({
          include: { project: { select: { projectCode: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        });
        return res.json({ success: true, data: data.map((i) => ({
          invoiceCode: i.invoiceCode, project: i.project?.name ?? '', status: i.status,
          totalAmount: Number(i.totalAmount), paidAmount: Number(i.paidAmount),
          outstanding: Number(i.totalAmount) - Number(i.paidAmount), dueDate: i.dueDate,
          issueDate: i.issueDate,
        })) });
      }

      case 'expenses': {
        const data = await prisma.expense.findMany({
          include: { project: { select: { name: true } }, submittedBy: { select: { firstName: true, lastName: true } } },
          orderBy: { date: 'desc' },
        });
        return res.json({ success: true, data: data.map((e) => ({
          date: e.date, category: e.category, amount: Number(e.amount),
          project: e.project?.name ?? '', employee: e.submittedBy ? `${e.submittedBy.firstName} ${e.submittedBy.lastName}` : '',
          status: e.status, description: e.description ?? '',
        })) });
      }

      case 'compliance': {
        const data = await prisma.workPass.findMany({
          include: { employee: { select: { firstName: true, lastName: true, employeeCode: true, nationality: true } } },
          orderBy: { expiryDate: 'asc' },
        });
        const today = new Date();
        return res.json({ success: true, data: data.map((wp) => ({
          employeeCode: wp.employee.employeeCode, name: `${wp.employee.firstName} ${wp.employee.lastName}`,
          nationality: wp.employee.nationality ?? '', passType: wp.passType, passNumber: wp.passNumber,
          status: wp.status, expiryDate: wp.expiryDate,
          daysToExpiry: wp.expiryDate ? Math.ceil((new Date(wp.expiryDate).getTime() - today.getTime()) / 86400000) : null,
        })) });
      }

      case 'equipment': {
        const data = await prisma.equipmentItem.findMany({
          include: {
            category: { select: { name: true } },
            warehouseStocks: { select: { quantityOnHand: true } },
            assetUnits: { select: { status: true } },
            issues: { where: { returnedAt: null }, select: { quantity: true } },
          },
          orderBy: { name: 'asc' },
        });
        return res.json({ success: true, data: data.map((e) => {
          const issuedQuantity = e.trackingMode === 'SERIALIZED'
            ? e.assetUnits.filter((u) => u.status === 'ISSUED').length
            : e.issues.reduce((s, i) => s + i.quantity, 0);
          const availableQuantity = e.trackingMode === 'SERIALIZED'
            ? e.assetUnits.filter((u) => u.status === 'IN_STOCK').length
            : e.warehouseStocks.reduce((s, w) => s + w.quantityOnHand, 0);
          return {
            name: e.name, category: e.category?.name ?? '', itemCode: e.itemCode,
            status: e.isActive ? 'Active' : 'Inactive',
            totalQuantity: availableQuantity + issuedQuantity, availableQuantity, issuedQuantity,
          };
        }) });
      }

      default:
        return res.status(400).json({ success: false, message: 'Invalid report type. Use: projects, employees, billing, expenses, compliance, equipment' });
    }
  } catch (e) { next(e); }
});

export default router;
