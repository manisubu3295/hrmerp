export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface ProfitSummary {
  revenue: number;
  salaryCost: number;
  expenseCost: number;
  equipmentCost: number;
  overheadCost: number;
  totalCost: number;
  netProfit: number;
  profitMargin: number;
}

export interface DashboardKPI {
  activeProjects: number;
  totalRevenueThisMonth: number;
  totalProfitThisMonth: number;
  totalEmployees: number;
  overdueinvoices: number;
  overBudgetProjects: number;
  expiringWorkPasses: number;
}
