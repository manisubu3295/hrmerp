import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { requireRoles } from '../middleware/auth.middleware';
import { calculateCpf } from '../lib/cpf';
import { generatePayslipPdf } from '../lib/pdf';
import { UserRole } from '@sankoerp/shared';
import { z } from 'zod';
import { validate } from '../middleware/validate';

const router = Router();

const runPayrollSchema = z.object({
  projectId: z.string().optional(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
});

// POST /payroll/run
// Generates PayrollRecord rows from attendance data for the given project/month/year
router.post(
  '/run',
  requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER),
  validate(runPayrollSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { projectId, month, year } = req.body as { projectId?: string; month: number; year: number };

      // If no projectId, run for ALL active projects
      const projects = projectId
        ? [await prisma.project.findUnique({ where: { id: projectId } })].filter(Boolean)
        : await prisma.project.findMany({ where: { status: 'ACTIVE' } });

      if (projectId && projects.length === 0) throw new AppError(404, `Project ${projectId} not found`);

      const allRecords: Array<{ projectId: string; projectName: string; employeeName: string; [key: string]: unknown }> = [];

      for (const project of projects) {
        if (!project) continue;
        const pid = project.id;
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // last day of month

        // Get all active assignments for this project
        const assignments = await prisma.projectEmployee.findMany({
          where: { projectId: pid, isActive: true },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                dailyRate: true,
                allowances: true,
                cpfApplicable: true,
                dateOfBirth: true,
                nationality: true,
              },
            },
          },
        });

        for (const assignment of assignments) {
          const { employee } = assignment;

          // Sum attendance for this employee in this project/month
          const attendances = await prisma.attendance.findMany({
            where: {
              employeeId: employee.id,
              projectId: pid,
              date: { gte: startDate, lte: endDate },
            },
          });

          const daysWorked = attendances.filter((a) => a.status === 'PRESENT').length
            + attendances.filter((a) => a.status === 'HALF_DAY').length * 0.5;

          const overtimeDays = attendances.reduce((s, a) => s + Number(a.overtimeHours ?? 0), 0) / 8;

          const basicPay = Number(assignment.dailyRate) * daysWorked;
          const overtimePay = attendances.reduce((s, a) => s + Number(a.overtimePay), 0);
          const allowances = Number(employee.allowances);
          const grossSalary = basicPay + overtimePay + allowances;

          // CPF Calculation (Singapore)
          let cpfEmployee = 0;
          let cpfEmployer = 0;
          if (employee.cpfApplicable) {
            const age = employee.dateOfBirth
              ? Math.floor((new Date().getTime() - new Date(employee.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
              : 35;
            const citizenship = (employee.nationality === 'Singapore'
              || employee.nationality === 'Singaporean'
              || employee.nationality === 'PR'
              || employee.nationality === 'Permanent Resident')
              ? 'SC_PR'
              : 'FOREIGNER';

            const cpf = calculateCpf({ grossSalary, age, citizenshipStatus: citizenship });
            cpfEmployee = cpf.employeeContribution;
            cpfEmployer = cpf.employerContribution;
          }

          const totalPayable = grossSalary - cpfEmployee;
          const totalCostToCompany = grossSalary + cpfEmployer;

          // Upsert payroll record
          const record = await prisma.payrollRecord.upsert({
            where: {
              projectId_employeeId_month_year: {
                projectId: pid,
                employeeId: employee.id,
                month,
                year,
              },
            },
            create: {
              projectId: pid,
              employeeId: employee.id,
              month,
              year,
              daysWorked: Math.floor(daysWorked),
              overtimeDays,
              basicPay,
              overtimePay,
              allowances,
              cpfEmployee,
              cpfEmployer,
              totalPayable,
              totalCostToCompany,
            },
            update: {
              daysWorked: Math.floor(daysWorked),
              overtimeDays,
              basicPay,
              overtimePay,
              allowances,
              cpfEmployee,
              cpfEmployer,
              totalPayable,
              totalCostToCompany,
            },
          });
          allRecords.push({ ...record, projectName: project.name, employeeName: `${employee.firstName} ${employee.lastName}` });
        }
      }

      res.json({
        success: true,
        data: {
          projectId: projectId ?? null,
          month,
          year,
          recordCount: allRecords.length,
          totalPayable: allRecords.reduce((s, r) => s + Number(r.totalPayable), 0),
          totalCostToCompany: allRecords.reduce((s, r) => s + Number(r.totalCostToCompany), 0),
          records: allRecords,
        },
      });
    } catch (e) {
      next(e);
    }
  },
);

// GET /payroll
// List payroll records with filters
router.get(
  '/',
  requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = req.query['projectId'] as string | undefined;
      const month = req.query['month'] ? Number(req.query['month']) : undefined;
      const year = req.query['year'] ? Number(req.query['year']) : new Date().getFullYear();

      const records = await prisma.payrollRecord.findMany({
        where: {
          ...(projectId && { projectId }),
          ...(month && { month }),
          year,
        },
        include: {
          project: { select: { id: true, projectCode: true, name: true } },
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      });

      // Enrich with employee data
      const enriched = await Promise.all(
        records.map(async (r) => {
          const emp = await prisma.employee.findUnique({
            where: { id: r.employeeId },
            select: { id: true, firstName: true, lastName: true, employeeCode: true, jobTitle: true },
          });
          return { ...r, employee: emp };
        }),
      );

      res.json({ success: true, data: enriched });
    } catch (e) {
      next(e);
    }
  },
);

// GET /payroll/payslips/:employeeId
// Employee self-service: view own payslips
router.get('/payslips/:employeeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId } = req.params;

    // Ensure employee can only access their own payslips (unless admin/manager)
    if (req.user) {
      const requestingUser = await prisma.user.findUnique({
        where: { id: req.user.sub },
        select: { role: true, employee: { select: { id: true } } },
      });
      const isEmployee = requestingUser?.role === UserRole.EMPLOYEE || requestingUser?.role === UserRole.SUPERVISOR;
      if (isEmployee && requestingUser?.employee?.id !== employeeId) {
        throw new AppError(403, 'You can only view your own payslips');
      }
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, firstName: true, lastName: true, employeeCode: true, jobTitle: true, bankName: true, bankAccountNo: true },
    });
    if (!employee) throw new AppError(404, 'Employee not found');

    const year = req.query['year'] ? Number(req.query['year']) : undefined;
    const records = await prisma.payrollRecord.findMany({
      where: {
        employeeId,
        ...(year && { year }),
      },
      include: {
        project: { select: { id: true, projectCode: true, name: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    res.json({ success: true, data: { employee, payslips: records } });
  } catch (e) {
    next(e);
  }
});

// PATCH /payroll/:id/paid
// Mark a payroll record as paid
router.patch(
  '/:id/paid',
  requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await prisma.payrollRecord.findUnique({ where: { id: req.params['id'] } });
      if (!record) throw new AppError(404, 'Payroll record not found');
      if (record.isPaid) throw new AppError(400, 'Payroll already marked as paid');

      const updated = await prisma.payrollRecord.update({
        where: { id: req.params['id'] },
        data: { isPaid: true, paidAt: new Date() },
      });
      res.json({ success: true, data: updated });
    } catch (e) {
      next(e);
    }
  },
);

// GET /payroll/:id/payslip — Download payslip as PDF
router.get('/:id/payslip', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await prisma.payrollRecord.findUnique({
      where: { id: req.params['id'] },
      include: {
        project: { select: { id: true, projectCode: true, name: true } },
      },
    });
    if (!record) throw new AppError(404, 'Payroll record not found');

    // Auth: employee can only get their own payslip
    if (req.user) {
      const requestingUser = await prisma.user.findUnique({
        where: { id: req.user.sub },
        select: { role: true, employee: { select: { id: true } } },
      });
      const isEmployee = requestingUser?.role === UserRole.EMPLOYEE || requestingUser?.role === UserRole.SUPERVISOR;
      if (isEmployee && requestingUser?.employee?.id !== record.employeeId) {
        throw new AppError(403, 'You can only download your own payslip');
      }
    }

    const employee = await prisma.employee.findUnique({
      where: { id: record.employeeId },
      select: { id: true, firstName: true, lastName: true, employeeCode: true, jobTitle: true, bankName: true, bankAccountNo: true },
    });
    if (!employee) throw new AppError(404, 'Employee not found');

    // Get org name for PDF header
    const org = await prisma.organization.findFirst({ select: { name: true } });

    const pdfBuffer = await generatePayslipPdf({
      employee,
      project: record.project,
      month: record.month,
      year: record.year,
      daysWorked: record.daysWorked,
      basicPay: record.basicPay,
      overtimePay: record.overtimePay,
      allowances: record.allowances,
      cpfEmployee: record.cpfEmployee,
      cpfEmployer: record.cpfEmployer,
      totalPayable: record.totalPayable,
      totalCostToCompany: record.totalCostToCompany,
      isPaid: record.isPaid,
      paidAt: record.paidAt,
      orgName: org?.name,
    });

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const filename = `payslip-${employee.employeeCode}-${MONTHS[record.month - 1]}-${record.year}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (e) {
    next(e);
  }
});

export default router;
