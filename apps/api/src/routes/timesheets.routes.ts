import { Router, Request, Response, NextFunction } from 'express';
import { parse } from 'csv-parse/sync';
import prisma from '../lib/prisma';
import { parsePagination, buildPaginationMeta } from '../lib/pagination';
import { AppError } from '../middleware/error.middleware';
import { requirePermission } from '../middleware/auth.middleware';
import { upload } from '../lib/upload';
import { UserRole } from '@sankoerp/shared';
import { AttendanceStatus, Prisma } from '@prisma/client';
import { RequestHandler } from 'express';

const router = Router();

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Resolve employeeId for the calling user (throws 403 if not found). */
async function resolveEmployeeId(userId: string): Promise<string> {
  const employee = await prisma.employee.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (!employee) throw new AppError(403, 'No employee profile linked to this account');
  return employee.id;
}

// ─── GET /timesheets ──────────────────────────────────────────────────────────
// Admin/Manager: see all entries (filter by employeeId, projectId, month, year)
// Employee: see only their own entries
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query as Record<string, unknown>);
    const { projectId, month, year } = req.query as Record<string, string | undefined>;
    let { employeeId } = req.query as Record<string, string | undefined>;

    const callerRole = req.user!.role as UserRole;
    const isEmployee = callerRole === UserRole.EMPLOYEE || callerRole === UserRole.SUPERVISOR;

    // Employees may only see their own records
    if (isEmployee) {
      employeeId = await resolveEmployeeId(req.user!.sub);
    }

    const where: Prisma.AttendanceWhereInput = {
      ...(employeeId && { employeeId }),
      ...(projectId && { projectId }),
      ...(month && year && {
        date: {
          gte: new Date(Number(year), Number(month) - 1, 1),
          lt: new Date(Number(year), Number(month), 1),
        },
      }),
    };

    const [rows, total] = await Promise.all([
      prisma.attendance.findMany({
        where, skip, take,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
          project: { select: { id: true, projectCode: true, name: true } },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.attendance.count({ where }),
    ]);

    res.json({ success: true, data: { data: rows, meta: buildPaginationMeta(total, page, limit) } });
  } catch (e) { next(e); }
});

// ─── POST /timesheets ─────────────────────────────────────────────────────────
// Employee submits a timesheet entry for one of their assigned projects.
// Admin/Manager can also submit on behalf of any employee.
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerRole = req.user!.role as UserRole;
    const isEmployee = callerRole === UserRole.EMPLOYEE || callerRole === UserRole.SUPERVISOR;

    let targetEmployeeId: string = req.body.employeeId;

    if (isEmployee) {
      // Employees can only submit for themselves
      targetEmployeeId = await resolveEmployeeId(req.user!.sub);
    }

    const { projectId, date, status, hoursWorked, overtimeHours, notes } = req.body as {
      projectId: string;
      date: string;
      status: AttendanceStatus;
      hoursWorked?: number;
      overtimeHours?: number;
      notes?: string;
    };

    if (!targetEmployeeId || !date || !status) {
      throw new AppError(400, 'employeeId, date, and status are required');
    }

    // Verify employee is assigned to the project (if projectId supplied)
    if (projectId) {
      const assignment = await prisma.projectEmployee.findFirst({
        where: { projectId, employeeId: targetEmployeeId, isActive: true },
      });
      if (!assignment && isEmployee) {
        throw new AppError(403, 'You are not assigned to this project');
      }
    }

    // Calculate wages
    const employee = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      select: { dailyRate: true, hourlyRate: true, overtimeRate: true },
    });
    if (!employee) throw new AppError(404, 'Employee not found');

    const daily = Number(employee.dailyRate);
    const hourly = Number(employee.hourlyRate ?? 0);
    const otRate = Number(employee.overtimeRate ?? hourly * 1.5);

    let dailyWage = 0;
    let overtimePay = 0;
    if (status === 'PRESENT') dailyWage = daily;
    else if (status === 'HALF_DAY') dailyWage = daily / 2;
    else if (status === 'OVERTIME') { dailyWage = daily; overtimePay = Number(overtimeHours ?? 0) * otRate; }
    if (hoursWorked && hourly > 0 && status === 'PRESENT') dailyWage = Number(hoursWorked) * hourly;

    const entry = await prisma.attendance.upsert({
      where: {
        employeeId_date_projectId: {
          employeeId: targetEmployeeId,
          date: new Date(date),
          projectId: projectId ?? null as unknown as string,
        },
      },
      // Re-submitting (e.g. after a REJECTED decision) re-enters the approval
      // queue rather than silently keeping a stale decision on new data.
      update: { status, hoursWorked, overtimeHours, dailyWage, overtimePay, notes, approvalStatus: 'PENDING', approvedById: null, approvedAt: null, rejectionReason: null },
      create: {
        organizationId: req.organizationId as string,
        employeeId: targetEmployeeId,
        projectId: projectId ?? undefined,
        date: new Date(date),
        status,
        hoursWorked,
        overtimeHours,
        dailyWage,
        overtimePay,
        notes,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        project: { select: { id: true, projectCode: true, name: true } },
      },
    });

    res.status(201).json({ success: true, data: entry });
  } catch (e) { next(e); }
});

// ─── GET /timesheets/my-projects ──────────────────────────────────────────────
// Returns all active project assignments for the calling employee.
router.get('/my-projects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = await resolveEmployeeId(req.user!.sub);
    const assignments = await prisma.projectEmployee.findMany({
      where: { employeeId, isActive: true },
      include: { project: { select: { id: true, projectCode: true, name: true, status: true } } },
      orderBy: { assignedAt: 'desc' },
    });
    res.json({ success: true, data: assignments });
  } catch (e) { next(e); }
});

// ─── GET /timesheets/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await prisma.attendance.findUnique({
      where: { id: req.params['id'] },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        project: { select: { id: true, projectCode: true, name: true } },
      },
    });
    if (!entry) throw new AppError(404, 'Timesheet entry not found');

    const callerRole = req.user!.role as UserRole;
    const isEmployee = callerRole === UserRole.EMPLOYEE || callerRole === UserRole.SUPERVISOR;
    if (isEmployee) {
      const empId = await resolveEmployeeId(req.user!.sub);
      if (entry.employeeId !== empId) throw new AppError(403, 'Access denied');
    }

    res.json({ success: true, data: entry });
  } catch (e) { next(e); }
});

// ─── PATCH /timesheets/:id ────────────────────────────────────────────────────
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.attendance.findUnique({ where: { id: req.params['id'] } });
    if (!existing) throw new AppError(404, 'Timesheet entry not found');

    const callerRole = req.user!.role as UserRole;
    const isEmployee = callerRole === UserRole.EMPLOYEE || callerRole === UserRole.SUPERVISOR;
    if (isEmployee) {
      const empId = await resolveEmployeeId(req.user!.sub);
      if (existing.employeeId !== empId) throw new AppError(403, 'Access denied');
      if (existing.approvalStatus === 'APPROVED') {
        throw new AppError(400, 'This entry is already approved and can no longer be edited');
      }
    }

    const { status, hoursWorked, overtimeHours, notes } = req.body;
    const updated = await prisma.attendance.update({
      where: { id: req.params['id'] },
      data: {
        status, hoursWorked, overtimeHours, notes,
        // A re-submitted REJECTED entry re-enters the approval queue.
        ...(isEmployee && existing.approvalStatus === 'REJECTED'
          ? { approvalStatus: 'PENDING' as const, approvedById: null, approvedAt: null, rejectionReason: null }
          : {}),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        project: { select: { id: true, projectCode: true, name: true } },
      },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// ─── PATCH /timesheets/:id/approve ────────────────────────────────────────────
router.patch('/:id/approve', requirePermission('timesheet:approve'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await prisma.attendance.findUnique({ where: { id: req.params['id'] } });
    if (!entry) throw new AppError(404, 'Timesheet entry not found');
    if (entry.approvalStatus !== 'PENDING') throw new AppError(400, 'Only pending timesheet entries can be actioned');

    const updated = await prisma.attendance.update({
      where: { id: req.params['id'] },
      // approvedById stores the User id of the approver (req.user.sub), not
      // an Employee id — there's no FK on this column, so callers reading it
      // back must resolve it against the users table if they need a name.
      data: { approvalStatus: 'APPROVED', approvedById: req.user!.sub, approvedAt: new Date(), rejectionReason: null },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        project: { select: { id: true, projectCode: true, name: true } },
      },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// ─── PATCH /timesheets/:id/reject ─────────────────────────────────────────────
router.patch('/:id/reject', requirePermission('timesheet:approve'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rejectionReason } = req.body as { rejectionReason?: string };
    const entry = await prisma.attendance.findUnique({ where: { id: req.params['id'] } });
    if (!entry) throw new AppError(404, 'Timesheet entry not found');
    if (entry.approvalStatus !== 'PENDING') throw new AppError(400, 'Only pending timesheet entries can be actioned');

    const updated = await prisma.attendance.update({
      where: { id: req.params['id'] },
      data: { approvalStatus: 'REJECTED', approvedById: req.user!.sub, approvedAt: new Date(), rejectionReason: rejectionReason ?? null },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        project: { select: { id: true, projectCode: true, name: true } },
      },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// ─── DELETE /timesheets/:id ───────────────────────────────────────────────────
router.delete('/:id', requirePermission('timesheet:delete'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.attendance.findUnique({ where: { id: req.params['id'] } });
    if (!existing) throw new AppError(404, 'Timesheet entry not found');
    await prisma.attendance.delete({ where: { id: req.params['id'] } });
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ─── POST /timesheets/bulk-import (CSV) ───────────────────────────────────────
// CSV columns: employeeCode,projectCode,date,status,hoursWorked,overtimeHours,notes
router.post(
  '/bulk-import',
  requirePermission('timesheet:bulk_import'),
  upload.single('file') as unknown as RequestHandler,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError(400, 'CSV file is required');

      const records = parse(req.file.buffer ?? require('fs').readFileSync(req.file.path), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Array<Record<string, string>>;

      if (records.length === 0) throw new AppError(400, 'CSV file is empty');
      if (records.length > 1000) throw new AppError(400, 'Maximum 1000 rows per import');

      const results: { row: number; status: string; message?: string }[] = [];
      let created = 0;
      let skipped = 0;

      for (let i = 0; i < records.length; i++) {
        const row = records[i]!;
        try {
          // Lookup employee by code
          const employee = await prisma.employee.findFirst({
            where: { employeeCode: row['employeeCode']?.trim() },
            select: { id: true, dailyRate: true, hourlyRate: true, overtimeRate: true },
          });
          if (!employee) {
            results.push({ row: i + 2, status: 'skipped', message: `Employee not found: ${row['employeeCode']}` });
            skipped++;
            continue;
          }

          // Lookup project by code (optional)
          let projectId: string | undefined;
          if (row['projectCode']?.trim()) {
            const project = await prisma.project.findFirst({ where: { projectCode: row['projectCode'].trim() }, select: { id: true } });
            if (!project) {
              results.push({ row: i + 2, status: 'skipped', message: `Project not found: ${row['projectCode']}` });
              skipped++;
              continue;
            }
            projectId = project.id;
          }

          const dateVal = row['date']?.trim();
          const statusVal = (row['status']?.trim().toUpperCase() ?? 'PRESENT') as AttendanceStatus;
          if (!dateVal) {
            results.push({ row: i + 2, status: 'skipped', message: 'Missing date' });
            skipped++;
            continue;
          }

          const hoursWorked = row['hoursWorked'] ? Number(row['hoursWorked']) : undefined;
          const overtimeHours = row['overtimeHours'] ? Number(row['overtimeHours']) : undefined;

          const daily = Number(employee.dailyRate);
          const hourly = Number(employee.hourlyRate ?? 0);
          const otRate = Number(employee.overtimeRate ?? hourly * 1.5);
          let dailyWage = 0;
          let overtimePay = 0;
          if (statusVal === 'PRESENT') dailyWage = daily;
          else if (statusVal === 'HALF_DAY') dailyWage = daily / 2;
          else if (statusVal === 'OVERTIME') { dailyWage = daily; overtimePay = (overtimeHours ?? 0) * otRate; }
          if (hoursWorked && hourly > 0 && statusVal === 'PRESENT') dailyWage = hoursWorked * hourly;

          await prisma.attendance.upsert({
            where: {
              employeeId_date_projectId: {
                employeeId: employee.id,
                date: new Date(dateVal),
                projectId: projectId ?? null as unknown as string,
              },
            },
            update: { status: statusVal, hoursWorked, overtimeHours, dailyWage, overtimePay, notes: row['notes'] },
            create: {
              organizationId: req.organizationId as string,
              employeeId: employee.id,
              projectId,
              date: new Date(dateVal),
              status: statusVal,
              hoursWorked,
              overtimeHours,
              dailyWage,
              overtimePay,
              notes: row['notes'],
            },
          });

          results.push({ row: i + 2, status: 'ok' });
          created++;
        } catch (rowErr) {
          results.push({ row: i + 2, status: 'error', message: String(rowErr) });
          skipped++;
        }
      }

      res.status(201).json({
        success: true,
        data: {
          imported: created,
          skipped,
          total: records.length,
          results,
          message: created > 0 ? `${created} entr${created === 1 ? 'y' : 'ies'} imported as PENDING approval — they will not count toward payroll until approved.` : undefined,
        },
      });
    } catch (e) { next(e); }
  },
);

export default router;
