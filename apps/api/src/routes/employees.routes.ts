import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';
import { parsePagination, buildPaginationMeta } from '../lib/pagination';
import { AppError } from '../middleware/error.middleware';
import { requirePermission } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { createEmployeeSchema, updateEmployeeSchema } from '../schemas/employees.schema';
import { Prisma } from '@prisma/client';
import { encryptField, decryptField } from '../lib/encryption';
import { calculateStatutoryContribution, ageFromDob } from '../lib/statutory-contributions';
import { materializeChecklistInstance } from '../lib/checklists';
import { dispatchWebhookEvent } from '../lib/webhooks';

const router = Router();

// Employee.identityDocNumber / bankAccountNo are stored encrypted at rest
// (AES-256-GCM — see lib/encryption.ts). Encrypt on the way in, decrypt on
// the way out; every other field passes through untouched.
function encryptSensitiveFields<T extends { identityDocNumber?: string | null; bankAccountNo?: string | null }>(dto: T): T {
  return {
    ...dto,
    identityDocNumber: dto.identityDocNumber ? encryptField(dto.identityDocNumber) : dto.identityDocNumber,
    bankAccountNo: dto.bankAccountNo ? encryptField(dto.bankAccountNo) : dto.bankAccountNo,
  };
}

function decryptSensitiveFields<T extends { identityDocNumber?: string | null; bankAccountNo?: string | null }>(employee: T): T {
  return {
    ...employee,
    identityDocNumber: employee.identityDocNumber ? decryptField(employee.identityDocNumber) : employee.identityDocNumber,
    bankAccountNo: employee.bankAccountNo ? decryptField(employee.bankAccountNo) : employee.bankAccountNo,
  };
}

// Shared by POST / below and recruitment.routes.ts's hire endpoint, so
// employee-creation logic (code generation + encryption) lives in one place.
export async function createEmployeeFromDto(dto: Record<string, unknown>) {
  const count = await prisma.employee.count();
  const employeeCode = `EMP-${String(count + 1).padStart(4, '0')}`;
  const encrypted = encryptSensitiveFields(dto as { identityDocNumber?: string | null; bankAccountNo?: string | null });
  const employee = await prisma.employee.create({
    data: {
      ...(encrypted as Record<string, unknown>),
      employeeCode,
      joinDate: new Date(dto['joinDate'] as string),
      dateOfBirth: dto['dateOfBirth'] ? new Date(dto['dateOfBirth'] as string) : undefined,
      resignDate: dto['resignDate'] ? new Date(dto['resignDate'] as string) : undefined,
      skills: (dto['skills'] as string[] | undefined) ?? [],
      allowances: (dto['allowances'] as number | undefined) ?? 0,
    } as Prisma.EmployeeUncheckedCreateInput,
  });
  return decryptSensitiveFields(employee);
}

// GET /employees
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query as Record<string, unknown>);
    const search = req.query['search'] as unknown as string | undefined;
    const isActiveParam = req.query['isActive'];
    const isActive = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined;

    const where: Prisma.EmployeeWhereInput = {
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { employeeCode: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where, skip, take,
        include: {
          workPass: { where: { status: { not: 'CANCELLED' } }, take: 1, orderBy: { expiryDate: 'desc' } },
          manager: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.employee.count({ where }),
    ]);

    res.json({
      success: true,
      data: { data: employees.map(decryptSensitiveFields), meta: buildPaginationMeta(total, page, limit) },
    });
  } catch (e) { next(e); }
});

// POST /employees
router.post('/', requirePermission('employee:create'), validate(createEmployeeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employee = await createEmployeeFromDto(req.body);
    res.status(201).json({ success: true, data: employee });
  } catch (e) { next(e); }
});

// GET /employees/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params['id'] },
      include: {
        workPass: { orderBy: { expiryDate: 'desc' } },
        certifications: { where: { isActive: true } },
        projectAssignments: {
          where: { isActive: true },
          include: { project: { select: { id: true, projectCode: true, name: true, status: true } } },
        },
        manager: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        directReports: {
          where: { isActive: true },
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
      },
    });
    if (!employee) throw new AppError(404, `Employee ${req.params['id']} not found`);
    res.json({ success: true, data: decryptSensitiveFields(employee) });
  } catch (e) { next(e); }
});

// PATCH /employees/:id
router.patch('/:id', requirePermission('employee:update'), validate(updateEmployeeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.employee.findUnique({ where: { id: req.params['id'] } });
    if (!existing) throw new AppError(404, `Employee ${req.params['id']} not found`);
    if (req.body.managerId && req.body.managerId === req.params['id']) {
      throw new AppError(400, 'An employee cannot report to themselves');
    }
    const dto = encryptSensitiveFields(req.body);
    const employee = await prisma.employee.update({
      where: { id: req.params['id'] },
      data: {
        ...dto,
        joinDate: dto.joinDate ? new Date(dto.joinDate) : undefined,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        resignDate: dto.resignDate ? new Date(dto.resignDate) : undefined,
      },
    });
    res.json({ success: true, data: decryptSensitiveFields(employee) });
  } catch (e) { next(e); }
});

// DELETE /employees/:id (deactivate)
router.delete('/:id', requirePermission('employee:delete'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.employee.findUnique({ where: { id: req.params['id'] } });
    if (!existing) throw new AppError(404, `Employee ${req.params['id']} not found`);
    const employee = await prisma.employee.update({ where: { id: req.params['id'] }, data: { isActive: false } });
    res.json({ success: true, data: employee });
  } catch (e) { next(e); }
});

// POST /employees/:id/offboard — deactivates the employee, records their
// resignDate, and best-effort kicks off the org's offboarding checklist
// (no-op if no active OFFBOARDING template exists yet — that's fine, it's
// opt-in). Distinct from the bare DELETE above, which stays a plain
// deactivate for existing callers.
router.post('/:id/offboard', requirePermission('employee:delete'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { resignDate, reason } = req.body as { resignDate?: string; reason?: string };
    const existing = await prisma.employee.findUnique({ where: { id: req.params['id'] } });
    if (!existing) throw new AppError(404, `Employee ${req.params['id']} not found`);

    const effectiveDate = resignDate ? new Date(resignDate) : new Date();
    const employee = await prisma.employee.update({
      where: { id: req.params['id'] },
      data: { isActive: false, resignDate: effectiveDate },
    });

    const instance = await materializeChecklistInstance(
      req.organizationId as string,
      employee.id,
      'OFFBOARDING',
      effectiveDate,
    );

    dispatchWebhookEvent(req.organizationId as string, 'employee.offboarded', {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      resignDate: effectiveDate,
      reason: reason ?? null,
      checklistInstanceId: instance?.id ?? null,
    });

    res.json({ success: true, data: { employee, checklistInstance: instance } });
  } catch (e) { next(e); }
});

// GET /employees/payroll/project/:projectId
router.get('/payroll/project/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assignments = await prisma.projectEmployee.findMany({
      where: { projectId: req.params['projectId'], isActive: true },
      include: { employee: { include: { statutoryScheme: true } } },
    });

    const summaries = await Promise.all(
      assignments.map(async (a) => {
        const attendances = await prisma.attendance.findMany({
          where: { employeeId: a.employeeId, projectId: req.params['projectId'] },
        });
        const daysWorked = attendances.filter((x) => x.status === 'PRESENT').length;
        const halfDays = attendances.filter((x) => x.status === 'HALF_DAY').length;
        const totalPay = attendances.reduce((s, x) => s + Number(x.dailyWage) + Number(x.overtimePay), 0);
        const { employeeContribution: cpfEmployee, employerContribution: cpfEmployer } = calculateStatutoryContribution({
          scheme: a.employee.statutoryScheme,
          grossSalary: totalPay,
          age: ageFromDob(a.employee.dateOfBirth),
          nationality: a.employee.nationality,
        });
        return {
          employee: { id: a.employee.id, name: `${a.employee.firstName} ${a.employee.lastName}` },
          daysWorked, halfDays, basicPay: totalPay,
          cpfEmployee, cpfEmployer,
          totalCostToCompany: totalPay + cpfEmployer,
        };
      }),
    );

    const totalCost = summaries.reduce((s, x) => s + x.totalCostToCompany, 0);
    res.json({ success: true, data: { summaries, totalCost } });
  } catch (e) { next(e); }
});

export default router;
