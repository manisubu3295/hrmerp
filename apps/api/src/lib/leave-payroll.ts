import { LeaveType, LeavePolicy, LeaveRequest } from '@prisma/client';

/**
 * Shared leave <-> payroll rules. Single source of truth so payroll.routes.ts
 * and leave.routes.ts agree on what counts as a working day and what counts
 * as paid vs unpaid leave.
 */

export function calcWorkingDays(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function eachWorkingDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Whether a given leave type should be paid. Precedence:
 * 1. LeaveType.UNPAID is always unpaid, regardless of any LeavePolicy row —
 *    the enum value wins so a misconfigured policy can't accidentally pay it.
 * 2. Otherwise, use LeavePolicy.isPaidLeave for that type if a policy exists.
 * 3. No policy row for that type -> default true (matches the schema default).
 */
export function isLeavePaid(
  leaveType: LeaveType,
  policyByType: Map<LeaveType, Pick<LeavePolicy, 'isPaidLeave'>>,
): boolean {
  if (leaveType === LeaveType.UNPAID) return false;
  const policy = policyByType.get(leaveType);
  if (policy) return policy.isPaidLeave;
  return true;
}

export interface LeavePeriodResult {
  paidLeaveDays: number;
  unpaidLeaveDays: number;
}

/**
 * Resolve how many paid/unpaid leave days an employee's APPROVED leave
 * requests contribute within [periodStart, periodEnd]. Requests are clipped
 * to the period, expanded to working days, and any day already counted as
 * worked in Attendance (attendanceDatesWorked) is skipped so a day is never
 * double-counted as both worked and on-leave.
 */
export function resolveLeaveForPeriod(params: {
  leaveRequests: Array<Pick<LeaveRequest, 'startDate' | 'endDate' | 'leaveType' | 'halfDay'>>;
  periodStart: Date;
  periodEnd: Date;
  attendanceDatesWorked: Set<string>;
  policyByType: Map<LeaveType, Pick<LeavePolicy, 'isPaidLeave'>>;
}): LeavePeriodResult {
  const { leaveRequests, periodStart, periodEnd, attendanceDatesWorked, policyByType } = params;

  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;

  for (const request of leaveRequests) {
    const clippedStart = request.startDate > periodStart ? request.startDate : periodStart;
    const clippedEnd = request.endDate < periodEnd ? request.endDate : periodEnd;
    if (clippedStart > clippedEnd) continue;

    const workingDays = eachWorkingDay(clippedStart, clippedEnd).filter(
      (d) => !attendanceDatesWorked.has(toDateKey(d)),
    );
    if (workingDays.length === 0) continue;

    const paid = isLeavePaid(request.leaveType, policyByType);
    const dayCount = request.halfDay ? 0.5 : workingDays.length;

    if (paid) paidLeaveDays += dayCount;
    else unpaidLeaveDays += dayCount;
  }

  return { paidLeaveDays, unpaidLeaveDays };
}
