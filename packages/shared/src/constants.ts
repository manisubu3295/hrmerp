export const WORK_PASS_ALERT_DAYS = {
  CRITICAL: 7,
  URGENT: 15,
  WARNING: 30,
} as const;

export const BUDGET_ALERT_THRESHOLD = 0.8; // 80%

export const DEFAULT_PROFIT_MARGIN_TARGET = 0.15; // 15%

export const INVOICE_OVERDUE_DAYS = 14;

export const DEFAULT_GST_RATE = 0.09; // Singapore 9% GST

export const DEFAULT_CPF_RATES = {
  EMPLOYEE: 0.2,
  EMPLOYER: 0.17,
} as const;

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const CURRENCY = {
  CODE: 'SGD',
  SYMBOL: '$',
  LOCALE: 'en-SG',
} as const;
