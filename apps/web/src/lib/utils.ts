import type { ChipProps } from '@mui/material';

export function formatCurrency(amount: number, currency = 'SGD'): string {
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency }).format(amount);
}

export function formatDate(date: string | Date): string {
  if (!date) return '-';
  return new Intl.DateTimeFormat('en-SG', { year: 'numeric', month: 'short', day: '2-digit' }).format(new Date(date));
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function daysUntil(date: string | Date): number {
  const target = new Date(date);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

type ChipColor = ChipProps['color'];

export function getStatusChipColor(status: string): ChipColor {
  const map: Record<string, ChipColor> = {
    ACTIVE: 'success',
    COMPLETED: 'default',
    ON_HOLD: 'warning',
    CANCELLED: 'error',
    DRAFT: 'default',
    SENT: 'primary',
    VIEWED: 'info',
    ACCEPTED: 'success',
    APPROVED: 'success',
    REJECTED: 'error',
    PAID: 'success',
    OVERDUE: 'error',
    PENDING: 'warning',
    VALID: 'success',
    EXPIRED: 'error',
    EXPIRING_SOON: 'warning',
    AVAILABLE: 'success',
    IN_USE: 'primary',
    MAINTENANCE: 'warning',
    RETIRED: 'default',
    READ: 'default',
    UNREAD: 'info',
  };
  return map[status] ?? 'default';
}
