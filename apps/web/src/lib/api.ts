import axios from 'axios';

const API_URL = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:4000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach JWT token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('sankoerp_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor — handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('sankoerp_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

// ─── API helpers ────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (email: string, password: string, role?: string) => api.post('/auth/register', { email, password, role }),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data: { email: string }) => api.patch('/auth/profile', data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch('/auth/change-password', { currentPassword, newPassword }),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) => api.post(`/auth/reset-password/${token}`, { newPassword }),
};

export const dashboardApi = {
  getOverview: () => api.get('/dashboard'),
  getMain: () => api.get('/dashboard'),
  getProjectBurndown: (id: string) => api.get(`/dashboard/projects/${id}/burndown`),
};

export const projectsApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/projects', { params }),
  list: (params?: Record<string, unknown>) => api.get('/projects', { params }),
  get: (id: string) => api.get(`/projects/${id}`),
  create: (data: unknown) => api.post('/projects', data),
  update: (id: string, data: unknown) => api.patch(`/projects/${id}`, data),
  updateStatus: (id: string, status: string) => api.patch(`/projects/${id}/status`, { status }),
  assignEmployees: (id: string, data: unknown) => api.post(`/projects/${id}/employees`, data),
  removeEmployee: (id: string, employeeId: string) => api.delete(`/projects/${id}/employees/${employeeId}`),
  getProfit: (id: string) => api.get(`/projects/${id}/profit`),
};

export const employeesApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/employees', { params }),
  list: (params?: Record<string, unknown>) => api.get('/employees', { params }),
  get: (id: string) => api.get(`/employees/${id}`),
  create: (data: unknown) => api.post('/employees', data),
  update: (id: string, data: unknown) => api.patch(`/employees/${id}`, data),
  deactivate: (id: string) => api.delete(`/employees/${id}`),
  recordAttendance: (data: unknown) => api.post('/employees/attendance', data),
  getAttendance: (id: string, month: number, year: number) =>
    api.get(`/employees/${id}/attendance`, { params: { month, year } }),
  getPayroll: (projectId: string) => api.get(`/employees/payroll/project/${projectId}`),
};

export const quotationsApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/quotations', { params }),
  list: (params?: Record<string, unknown>) => api.get('/quotations', { params }),
  get: (id: string) => api.get(`/quotations/${id}`),
  create: (data: unknown) => api.post('/quotations', data),
  update: (id: string, data: unknown) => api.patch(`/quotations/${id}`, data),
  updateStatus: (id: string, status: string, reason?: string) =>
    api.patch(`/quotations/${id}/status`, { status, reason }),
  convertToProject: (id: string) => api.post(`/quotations/${id}/convert-to-project`),
  // Public portal (no auth header needed)
  getPortal: (token: string) => api.get(`/quotations/portal/${token}`),
  approvePortal: (token: string) => api.post(`/quotations/portal/${token}/approve`),
  rejectPortal: (token: string, reason?: string) => api.post(`/quotations/portal/${token}/reject`, { reason }),
};

export const expensesApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/expenses', { params }),
  list: (params?: Record<string, unknown>) => api.get('/expenses', { params }),
  get: (id: string) => api.get(`/expenses/${id}`),
  create: (data: unknown) => api.post('/expenses', data),
  approve: (id: string, data: unknown) => api.patch(`/expenses/${id}/approve`, data),
  reject: (id: string, data: unknown) => api.patch(`/expenses/${id}/reject`, data),
  getProjectSummary: (projectId: string) => api.get(`/expenses/project/${projectId}/summary`),
};

export const timesheetsApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/timesheets', { params }),
  getMyProjects: () => api.get('/timesheets/my-projects'),
  create: (data: unknown) => api.post('/timesheets', data),
  update: (id: string, data: unknown) => api.patch(`/timesheets/${id}`, data),
  remove: (id: string) => api.delete(`/timesheets/${id}`),
  bulkImport: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/timesheets/bulk-import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export const equipmentApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/equipment/items', { params }),
  get: (id: string) => api.get(`/equipment/items/${id}`),
  updateStatus: (id: string, status: string) => api.patch(`/equipment/items/${id}/status`, { status }),
  listCategories: () => api.get('/equipment/categories'),
  createCategory: (data: unknown) => api.post('/equipment/categories', data),
  listItems: (params?: Record<string, unknown>) => api.get('/equipment/items', { params }),
  getItem: (id: string) => api.get(`/equipment/items/${id}`),
  createItem: (data: unknown) => api.post('/equipment/items', data),
  recordPurchase: (data: unknown) => api.post('/equipment/purchases', data),
  issueEquipment: (data: unknown) => api.post('/equipment/issues', data),
  returnEquipment: (issueId: string, data: unknown) => api.patch(`/equipment/issues/${issueId}/return`, data),
  getSummary: () => api.get('/equipment/summary'),
};

export const suppliersApi = {
  list: (params?: Record<string, unknown>) => api.get('/suppliers', { params }),
  get: (id: string) => api.get(`/suppliers/${id}`),
  create: (data: unknown) => api.post('/suppliers', data),
  update: (id: string, data: unknown) => api.patch(`/suppliers/${id}`, data),
  remove: (id: string) => api.delete(`/suppliers/${id}`),
};

export const billingApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/billing/invoices', { params }),
  listInvoices: (params?: Record<string, unknown>) => api.get('/billing/invoices', { params }),
  getInvoice: (id: string) => api.get(`/billing/invoices/${id}`),
  createInvoice: (data: unknown) => api.post('/billing/invoices', data),
  sendInvoice: (id: string) => api.patch(`/billing/invoices/${id}/send`),
  recordPayment: (id: string, data: unknown) => api.post(`/billing/invoices/${id}/payments`, data),
  cancelInvoice: (id: string) => api.patch(`/billing/invoices/${id}/cancel`),
  getOverdue: () => api.get('/billing/invoices/overdue'),
  getSummary: () => api.get('/billing/summary'),
};

export const complianceApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/compliance/work-passes', { params }),
  list: (params?: Record<string, unknown>) => api.get('/compliance/work-passes', { params }),
  get: (id: string) => api.get(`/compliance/work-passes/${id}`),
  create: (data: unknown) => api.post('/compliance/work-passes', data),
  renew: (id: string, data: unknown) => api.patch(`/compliance/work-passes/${id}/renew`, data),
  cancel: (id: string, reason?: string) => api.patch(`/compliance/work-passes/${id}/cancel`, { reason }),
  getDashboard: () => api.get('/compliance/dashboard'),
  canDeploy: (employeeId: string) => api.get(`/compliance/employees/${employeeId}/can-deploy`),
};

export const notificationsApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/notifications', { params }),
  list: (params?: Record<string, unknown>) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/notifications/read-all'),
  markAllRead: () => api.patch('/notifications/read-all'),
  resolve: (id: string, note?: string) => api.patch(`/notifications/${id}/resolve`, { note }),
};

export const reportsApi = {
  generate: (params: { type: string; [key: string]: unknown }) =>
    api.get('/reports/generate', { params }),
  getProfit: (params?: Record<string, unknown>) => api.get('/reports/profit', { params }),
  getMonthlyTrends: (year: number) => api.get('/reports/monthly-trends', { params: { year } }),
  getClients: () => api.get('/reports/clients'),
  getEmployeeProductivity: (startDate: string, endDate: string) =>
    api.get('/reports/employee-productivity', { params: { startDate, endDate } }),
  exportTimesheets: (params?: Record<string, unknown>) =>
    api.get('/reports/export/timesheets', { params, responseType: 'blob' }),
  exportProfit: (params?: Record<string, unknown>) =>
    api.get('/reports/export/profit', { params, responseType: 'blob' }),
  exportPayroll: (params?: Record<string, unknown>) =>
    api.get('/reports/export/payroll', { params, responseType: 'blob' }),
};

export const payrollApi = {
  run: (data: { projectId?: string; month: number; year: number }) => api.post('/payroll/run', data),
  list: (params?: Record<string, unknown>) => api.get('/payroll', { params }),
  getPayslips: (employeeId: string) => api.get(`/payroll/payslips/${employeeId}`),
  markPaid: (id: string) => api.patch(`/payroll/${id}/paid`),
  downloadPayslip: (id: string) => api.get(`/payroll/${id}/payslip`, { responseType: 'blob' }),
};

export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data: unknown) => api.patch('/settings', data),
};

export const clientsApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/clients', { params }),
  list: (params?: Record<string, unknown>) => api.get('/clients', { params }),
  get: (id: string) => api.get(`/clients/${id}`),
  create: (data: unknown) => api.post('/clients', data),
  update: (id: string, data: unknown) => api.patch(`/clients/${id}`, data),
};

export const leaveApi = {
  // Policies
  getPolicies: () => api.get('/leave/policies'),
  createPolicy: (data: unknown) => api.post('/leave/policies', data),
  // Balances
  getBalances: (params?: Record<string, unknown>) => api.get('/leave/balances', { params }),
  initBalances: (data: unknown) => api.post('/leave/balances/init', data),
  // Requests
  getRequests: (params?: Record<string, unknown>) => api.get('/leave/requests', { params }),
  getRequest: (id: string) => api.get(`/leave/requests/${id}`),
  createRequest: (data: unknown) => api.post('/leave/requests', data),
  approveRequest: (id: string) => api.patch(`/leave/requests/${id}/approve`),
  rejectRequest: (id: string, reason?: string) => api.patch(`/leave/requests/${id}/reject`, { rejectionReason: reason }),
  cancelRequest: (id: string) => api.patch(`/leave/requests/${id}/cancel`),
  // Calendar (approved leaves)
  getCalendar: (startDate: string, endDate: string) => api.get('/leave/calendar', { params: { startDate, endDate } }),
  getSummary: () => api.get('/leave/summary'),
};

export const calendarApi = {
  getEvents: (startDate: string, endDate: string) => api.get('/calendar/events', { params: { startDate, endDate } }),
  getAllEvents: () => api.get('/calendar/all'),
  getYearEvents: (year: number) => api.get(`/calendar/year/${year}`),
  createEvent: (data: unknown) => api.post('/calendar/events', data),
  updateEvent: (id: string, data: unknown) => api.patch(`/calendar/events/${id}`, data),
  deleteEvent: (id: string) => api.delete(`/calendar/events/${id}`),
};

export const usersApi = {
  list: (params?: Record<string, unknown>) => api.get('/users', { params }),
  get: (id: string) => api.get(`/users/${id}`),
  create: (data: { email: string; password: string; role: string; employeeId?: string }) =>
    api.post('/users', data),
  update: (id: string, data: { email?: string; employeeId?: string | null }) =>
    api.patch(`/users/${id}`, data),
  changeRole: (id: string, role: string) => api.patch(`/users/${id}/role`, { role }),
  setActive: (id: string, isActive: boolean) => api.patch(`/users/${id}/active`, { isActive }),
  resetPassword: (id: string, newPassword: string) =>
    api.post(`/users/${id}/reset-password`, { newPassword }),
};
