import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';
import { parsePagination, buildPaginationMeta } from '../lib/pagination';
import { AppError } from '../middleware/error.middleware';
import { requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { createEmployeeSchema, updateEmployeeSchema, createAttendanceSchema } from '../schemas/employees.schema';
import { UserRole } from '@sankoerp/shared';
import { Prisma, AttendanceStatus } from '@prisma/client';

const router = Router();

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
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.employee.count({ where }),
    ]);

    res.json({ success: true, data: { data: employees, meta: buildPaginationMeta(total, page, limit) } });
  } catch (e) { next(e); }
});

// POST /employees
router.post('/', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER), validate(createEmployeeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await prisma.employee.count();
    const employeeCode = `EMP-${String(count + 1).padStart(4, '0')}`;
    const dto = req.body;
    const employee = await prisma.employee.create({
      data: {
        ...dto,
        employeeCode,
        joinDate: new Date(dto.joinDate),
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        skills: dto.skills ?? [],
        allowances: dto.allowances ?? 0,
      },
    });
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
      },
    });
    if (!employee) throw new AppError(404, `Employee ${req.params['id']} not found`);
    res.json({ success: true, data: employee });
  } catch (e) { next(e); }
});

// PATCH /employees/:id
router.patch('/:id', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER), validate(updateEmployeeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.employee.findUnique({ where: { id: req.params['id'] } });
    if (!existing) throw new AppError(404, `Employee ${req.params['id']} not found`);
    const dto = req.body;
    const employee = await prisma.employee.update({
      where: { id: req.params['id'] },
      data: {
        ...dto,
        joinDate: dto.joinDate ? new Date(dto.joinDate) : undefined,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });
    res.json({ success: true, data: employee });
  } catch (e) { next(e); }
});

// DELETE /employees/:id (deactivate)
router.delete('/:id', requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.employee.findUnique({ where: { id: req.params['id'] } });
    if (!existing) throw new AppError(404, `Employee ${req.params['id']} not found`);
    const employee = await prisma.employee.update({ where: { id: req.params['id'] }, data: { isActive: false } });
    res.json({ success: true, data: employee });
  } catch (e) { next(e); }
});

// POST /employees/attendance
router.post('/attendance', validate(createAttendanceSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = req.body;
    const employee = await prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee) throw new AppError(404, 'Employee not found');

    const date = new Date(dto.date);
    const status: AttendanceStatus = dto.status ?? AttendanceStatus.PRESENT;

    let dailyWage = 0;
    let overtimePay = 0;

    if (status === AttendanceStatus.PRESENT) {
      dailyWage = Number(employee.dailyRate);
    } else if (status === AttendanceStatus.HALF_DAY) {
      dailyWage = Number(employee.dailyRate) / 2;
    }

    if (dto.overtimeHours && employee.overtimeRate) {
      overtimePay = dto.overtimeHours * Number(employee.overtimeRate);
    }

    const updateData = {
      status,
      hoursWorked: dto.hoursWorked,
      overtimeHours: dto.overtimeHours,
      dailyWage,
      overtimePay,
      notes: dto.notes,
    };

    let attendance;
    if (dto.projectId) {
      attendance = await prisma.attendance.upsert({
        where: { employeeId_date_projectId: { employeeId: dto.employeeId, date, projectId: dto.projectId } },
        create: { employeeId: dto.employeeId, projectId: dto.projectId, date, ...updateData },
        update: updateData,
      });
    } else {
      const existing = await prisma.attendance.findFirst({
        where: { employeeId: dto.employeeId, date, projectId: null },
      });
      if (existing) {
        attendance = await prisma.attendance.update({ where: { id: existing.id }, data: updateData });
      } else {
        attendance = await prisma.attendance.create({
          data: { employeeId: dto.employeeId, date, ...updateData },
        });
      }
    }

    res.status(201).json({ success: true, data: attendance });
  } catch (e) { next(e); }
});

// GET /employees/:id/attendance
router.get('/:id/attendance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const month = Number(req.query['month']) || new Date().getMonth() + 1;
    const year = Number(req.query['year']) || new Date().getFullYear();
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const attendances = await prisma.attendance.findMany({
      where: { employeeId: req.params['id'], date: { gte: startDate, lte: endDate } },
      include: { project: { select: { id: true, projectCode: true, name: true } } },
      orderBy: { date: 'asc' },
    });

    const totalDays = attendances.filter((a) => a.status === 'PRESENT').length;
    const halfDays = attendances.filter((a) => a.status === 'HALF_DAY').length;
    const totalEarnings = attendances.reduce((s, a) => s + Number(a.dailyWage) + Number(a.overtimePay), 0);

    res.json({ success: true, data: { attendances, summary: { totalDays, halfDays, totalEarnings } } });
  } catch (e) { next(e); }
});

// GET /employees/payroll/project/:projectId
router.get('/payroll/project/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assignments = await prisma.projectEmployee.findMany({
      where: { projectId: req.params['projectId'], isActive: true },
      include: { employee: true },
    });

    const summaries = await Promise.all(
      assignments.map(async (a) => {
        const attendances = await prisma.attendance.findMany({
          where: { employeeId: a.employeeId, projectId: req.params['projectId'] },
        });
        const daysWorked = attendances.filter((x) => x.status === 'PRESENT').length;
        const halfDays = attendances.filter((x) => x.status === 'HALF_DAY').length;
        const totalPay = attendances.reduce((s, x) => s + Number(x.dailyWage) + Number(x.overtimePay), 0);
        const cpfEmployee = a.employee.cpfApplicable ? totalPay * 0.2 : 0;
        const cpfEmployer = a.employee.cpfApplicable ? totalPay * 0.17 : 0;
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
