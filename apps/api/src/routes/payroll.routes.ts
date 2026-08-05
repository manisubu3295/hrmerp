import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { requirePermission } from '../middleware/auth.middleware';
import { calculateStatutoryContribution, ageFromDob } from '../lib/statutory-contributions';
import { generatePayslipPdf } from '../lib/pdf';
import { UserRole } from '@sankoerp/shared';
import { decryptField } from '../lib/encryption';
import { validate } from '../middleware/validate';
import { runPayrollSchema } from '../schemas/payroll.schema';
import { resolveLeaveForPeriod } from '../lib/leave-payroll';
import { monthRangeUTC } from '../lib/dates';

const router = Router();

// POST /payroll/run
// Generates PayrollRecord rows from attendance data for the given project/month/year
router.post(
  '/run',
  requirePermission('payroll:run'),
  validate(runPayrollSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { projectId, month, year } = req.body as { projectId?: string; month: number; year: number };

      // If no projectId, run for ALL active projects
      const projects = projectId
        ? [await prisma.project.findUnique({ where: { id: projectId } })].filter(Boolean)
        : await prisma.project.findMany({ where: { status: 'ACTIVE' } });

      if (projectId && projects.length === 0) throw new AppError(404, `Project ${projectId} not found`);

      const { start: startDate, end: endDate } = monthRangeUTC(year, month);

      // ── Leave attribution pre-pass ──────────────────────────────────────
      // LeaveRequest is employee-scoped, but payroll runs per-project, so we
      // resolve up front which project each employee's approved leave for
      // this period should count against. Deliberately simple v1 policy (not
      // a proration engine): an employee with exactly one active project
      // assignment gets 100% of their leave there; with more than one, leave
      // is attributed entirely to whichever project they logged the most
      // attendance on this period (deterministic tie-break on lowest
      // projectId). Other projects get zero leave days for that employee —
      // surfaced via `warnings` in the response rather than silently dropped.
      const projectIds = projects.filter(Boolean).map((p) => p!.id);
      const warnings: string[] = [];
      const leaveByEmployeeProject = new Map<string, { paidLeaveDays: number; unpaidLeaveDays: number }>();

      if (projectIds.length > 0) {
        const assignmentsInRun = await prisma.projectEmployee.findMany({
          where: { projectId: { in: projectIds }, isActive: true },
          select: { employeeId: true },
        });
        const employeeIds = [...new Set(assignmentsInRun.map((a) => a.employeeId))];

        if (employeeIds.length > 0) {
          const [allActiveAssignments, leaveRequests, leavePolicies, attendanceInPeriod, employeeNames] = await Promise.all([
            prisma.projectEmployee.findMany({
              where: { employeeId: { in: employeeIds }, isActive: true },
              select: { employeeId: true, projectId: true },
            }),
            prisma.leaveRequest.findMany({
              where: {
                employeeId: { in: employeeIds },
                status: 'APPROVED',
                startDate: { lte: endDate },
                endDate: { gte: startDate },
              },
            }),
            prisma.leavePolicy.findMany({ where: { isActive: true } }),
            prisma.attendance.findMany({
              where: {
                employeeId: { in: employeeIds },
                date: { gte: startDate, lte: endDate },
                status: { in: ['PRESENT', 'HALF_DAY'] },
                approvalStatus: 'APPROVED',
              },
              select: { employeeId: true, projectId: true, date: true },
            }),
            prisma.employee.findMany({
              where: { id: { in: employeeIds } },
              select: { id: true, firstName: true, lastName: true },
            }),
          ]);

          const policyByType = new Map(leavePolicies.map((p) => [p.leaveType, p]));
          const nameByEmployee = new Map(employeeNames.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));

          const activeProjectsByEmployee = new Map<string, string[]>();
          for (const a of allActiveAssignments) {
            const arr = activeProjectsByEmployee.get(a.employeeId) ?? [];
            arr.push(a.projectId);
            activeProjectsByEmployee.set(a.employeeId, arr);
          }

          const attendanceCountByEmpProject = new Map<string, number>();
          const attendanceDatesByEmployee = new Map<string, Set<string>>();
          for (const a of attendanceInPeriod) {
            if (a.projectId) {
              const key = `${a.employeeId}:${a.projectId}`;
              attendanceCountByEmpProject.set(key, (attendanceCountByEmpProject.get(key) ?? 0) + 1);
            }
            const dateSet = attendanceDatesByEmployee.get(a.employeeId) ?? new Set<string>();
            dateSet.add(a.date.toISOString().slice(0, 10));
            attendanceDatesByEmployee.set(a.employeeId, dateSet);
          }

          const leaveRequestsByEmployee = new Map<string, typeof leaveRequests>();
          for (const lr of leaveRequests) {
            const arr = leaveRequestsByEmployee.get(lr.employeeId) ?? [];
            arr.push(lr);
            leaveRequestsByEmployee.set(lr.employeeId, arr);
          }

          for (const employeeId of employeeIds) {
            const activeProjects = [...new Set(activeProjectsByEmployee.get(employeeId) ?? [])].sort();
            let winningProjectId: string | undefined;
            if (activeProjects.length === 1) {
              winningProjectId = activeProjects[0];
            } else if (activeProjects.length > 1) {
              let bestCount = -1;
              for (const pid of activeProjects) {
                const count = attendanceCountByEmpProject.get(`${employeeId}:${pid}`) ?? 0;
                if (count > bestCount) {
                  bestCount = count;
                  winningProjectId = pid;
                }
              }
              warnings.push(
                `${nameByEmployee.get(employeeId) ?? employeeId} has ${activeProjects.length} active project assignments this period; their approved leave was attributed entirely to project ${winningProjectId}.`,
              );
            }
            if (!winningProjectId) continue;

            const result = resolveLeaveForPeriod({
              leaveRequests: leaveRequestsByEmployee.get(employeeId) ?? [],
              periodStart: startDate,
              periodEnd: endDate,
              attendanceDatesWorked: attendanceDatesByEmployee.get(employeeId) ?? new Set(),
              policyByType,
            });
            leaveByEmployeeProject.set(`${employeeId}:${winningProjectId}`, result);
          }
        }
      }

      const allRecords: Array<{ projectId: string; projectName: string; employeeName: string; [key: string]: unknown }> = [];

      for (const project of projects) {
        if (!project) continue;
        const pid = project.id;

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
                dateOfBirth: true,
                nationality: true,
                statutoryScheme: true,
              },
            },
          },
        });

        for (const assignment of assignments) {
          const { employee } = assignment;

          // Sum attendance for this employee in this project/month. Only
          // approved entries count toward pay — see timesheets.routes.ts
          // approve/reject.
          const attendances = await prisma.attendance.findMany({
            where: {
              employeeId: employee.id,
              projectId: pid,
              date: { gte: startDate, lte: endDate },
              approvalStatus: 'APPROVED',
            },
          });

          const daysWorked = attendances.filter((a) => a.status === 'PRESENT').length
            + attendances.filter((a) => a.status === 'HALF_DAY').length * 0.5;

          const overtimeDays = attendances.reduce((s, a) => s + Number(a.overtimeHours ?? 0), 0) / 8;

          const { paidLeaveDays, unpaidLeaveDays } = leaveByEmployeeProject.get(`${employee.id}:${pid}`)
            ?? { paidLeaveDays: 0, unpaidLeaveDays: 0 };

          // Paid leave days count toward pay as if worked, so approved paid
          // leave doesn't reduce salary. Unpaid leave days already have no
          // attendance row (so they already contribute 0 to daysWorked) —
          // leaveDeduction below is an INFORMATIONAL payslip line only. Do
          // NOT also subtract it from basicPay, or unpaid leave gets
          // deducted twice.
          const effectiveDaysWorked = daysWorked + paidLeaveDays;
          const basicPay = Number(assignment.dailyRate) * effectiveDaysWorked;
          const leaveDeduction = unpaidLeaveDays * Number(assignment.dailyRate);

          const overtimePay = attendances.reduce((s, a) => s + Number(a.overtimePay), 0);
          const allowances = Number(employee.allowances);
          const grossSalary = basicPay + overtimePay + allowances;

          const { employeeContribution: cpfEmployee, employerContribution: cpfEmployer } = calculateStatutoryContribution({
            scheme: employee.statutoryScheme,
            grossSalary,
            age: ageFromDob(employee.dateOfBirth),
            nationality: employee.nationality,
          });

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
              organizationId: req.organizationId as string,
              projectId: pid,
              employeeId: employee.id,
              month,
              year,
              daysWorked: Math.floor(effectiveDaysWorked),
              overtimeDays,
              paidLeaveDays,
              unpaidLeaveDays,
              leaveDeduction,
              basicPay,
              overtimePay,
              allowances,
              cpfEmployee,
              cpfEmployer,
              totalPayable,
              totalCostToCompany,
            },
            update: {
              daysWorked: Math.floor(effectiveDaysWorked),
              overtimeDays,
              paidLeaveDays,
              unpaidLeaveDays,
              leaveDeduction,
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

      const runTotalPayable = allRecords.reduce((s, r) => s + Number(r.totalPayable), 0);
      const runTotalCostToCompany = allRecords.reduce((s, r) => s + Number(r.totalCostToCompany), 0);

      // Group this batch's records under one PayrollRun. Re-running the same
      // project/month/year re-attaches the (upserted, still-current) records
      // to the newest run rather than duplicating them — correct semantics for
      // "one record per employee-period, always current" — but it does mean an
      // older run's cached totals can go stale if a later run re-touches its
      // records. Acceptable for this pass, flagged here rather than glossed over.
      const runSeq = (await prisma.payrollRun.count({ where: { month, year } })) + 1;
      const payrollRun = await prisma.payrollRun.create({
        data: {
          organizationId: req.organizationId as string,
          runCode: `PR-${year}-${String(month).padStart(2, '0')}-${String(runSeq).padStart(3, '0')}`,
          projectId: projectId ?? null,
          month,
          year,
          status: 'COMPLETED',
          totalPayable: runTotalPayable,
          totalCostToCompany: runTotalCostToCompany,
          recordCount: allRecords.length,
          runById: req.user?.sub ?? null,
        },
      });
      if (allRecords.length > 0) {
        await prisma.payrollRecord.updateMany({
          where: { id: { in: allRecords.map((r) => r['id'] as string) } },
          data: { payrollRunId: payrollRun.id },
        });
      }

      res.json({
        success: true,
        data: {
          payrollRunId: payrollRun.id,
          runCode: payrollRun.runCode,
          projectId: projectId ?? null,
          month,
          year,
          recordCount: allRecords.length,
          totalPayable: runTotalPayable,
          totalCostToCompany: runTotalCostToCompany,
          records: allRecords,
          warnings,
        },
      });
    } catch (e) {
      next(e);
    }
  },
);

// GET /payroll/runs — list payroll runs
router.get('/runs', requirePermission('payroll:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const year = req.query['year'] ? Number(req.query['year']) : undefined;
    const runs = await prisma.payrollRun.findMany({
      where: { ...(year && { year }) },
      include: { project: { select: { id: true, projectCode: true, name: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { runAt: 'desc' }],
    });
    res.json({ success: true, data: runs });
  } catch (e) { next(e); }
});

// GET /payroll/runs/:id — a run and the records it grouped
router.get('/runs/:id', requirePermission('payroll:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const run = await prisma.payrollRun.findUnique({
      where: { id: req.params['id'] },
      include: { project: { select: { id: true, projectCode: true, name: true } }, records: true },
    });
    if (!run) throw new AppError(404, 'Payroll run not found');
    res.json({ success: true, data: run });
  } catch (e) { next(e); }
});

// PATCH /payroll/runs/:id/mark-paid — bulk mark-paid every record in the run
router.patch('/runs/:id/mark-paid', requirePermission('payroll:mark_paid'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const run = await prisma.payrollRun.findUnique({ where: { id: req.params['id'] } });
    if (!run) throw new AppError(404, 'Payroll run not found');
    if (run.status === 'PAID') throw new AppError(400, 'Payroll run already marked as paid');

    const paidAt = new Date();
    await prisma.payrollRecord.updateMany({
      where: { payrollRunId: run.id, isPaid: false },
      data: { isPaid: true, paidAt },
    });
    const updated = await prisma.payrollRun.update({
      where: { id: run.id },
      data: { status: 'PAID', paidAt },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// GET /payroll
// List payroll records with filters
router.get(
  '/',
  requirePermission('payroll:read'),
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
    if (employee.bankAccountNo) employee.bankAccountNo = decryptField(employee.bankAccountNo);

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
  requirePermission('payroll:mark_paid'),
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
    if (employee.bankAccountNo) employee.bankAccountNo = decryptField(employee.bankAccountNo);

    // Get org name for PDF header
    const org = await prisma.organization.findUnique({ where: { id: req.organizationId as string }, select: { name: true } });

    const pdfBuffer = await generatePayslipPdf({
      employee,
      project: record.project,
      month: record.month,
      year: record.year,
      daysWorked: record.daysWorked,
      paidLeaveDays: record.paidLeaveDays,
      unpaidLeaveDays: record.unpaidLeaveDays,
      leaveDeduction: record.leaveDeduction,
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
