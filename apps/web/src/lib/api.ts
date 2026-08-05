import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

const API_URL = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:4000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach JWT token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('aadhirai_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

function hardLogout() {
  if (typeof window !== 'undefined') {
    useAuthStore.getState().clearAuth();
    window.location.href = '/login';
  }
}

// Refresh is in flight at most once at a time — concurrent 401s share the same promise.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('aadhirai_refresh_token');
  if (!refreshToken) return null;
  try {
    const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
    const { token, refreshToken: newRefreshToken } = res.data.data;
    useAuthStore.getState().setAccessToken(token);
    if (newRefreshToken) localStorage.setItem('aadhirai_refresh_token', newRefreshToken);
    return token;
  } catch {
    return null;
  }
}

// Response interceptor — on 401, try a refresh once and retry the original
// request before falling back to a hard logout + redirect.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && typeof window !== 'undefined' && !original?._retried) {
      if (original) original._retried = true;

      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newToken = await refreshPromise;

      if (newToken && original) {
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
        return api.request(original);
      }

      hardLogout();
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
  offboard: (id: string, data: { resignDate?: string; reason?: string }) => api.post(`/employees/${id}/offboard`, data),
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
  downloadPdf: (id: string) => api.get(`/quotations/${id}/pdf`, { responseType: 'blob' }),
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
  approve: (id: string) => api.patch(`/timesheets/${id}/approve`),
  reject: (id: string, rejectionReason?: string) => api.patch(`/timesheets/${id}/reject`, { rejectionReason }),
  bulkImport: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/timesheets/bulk-import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export const equipmentApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/equipment/items', { params }),
  get: (id: string) => api.get(`/equipment/items/${id}`),
  update: (id: string, data: unknown) => api.patch(`/equipment/items/${id}`, data),
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
  listWarehouses: () => api.get('/equipment/warehouses'),
  createWarehouse: (data: unknown) => api.post('/equipment/warehouses', data),
  listAssetUnits: (params?: Record<string, unknown>) => api.get('/equipment/asset-units', { params }),
  getAssetUnit: (id: string) => api.get(`/equipment/asset-units/${id}`),
  updateAssetUnitStatus: (id: string, status: string) => api.patch(`/equipment/asset-units/${id}/status`, { status }),
  listMaintenanceRecords: (params?: Record<string, unknown>) => api.get('/equipment/maintenance-records', { params }),
  createMaintenanceRecord: (data: unknown) => api.post('/equipment/maintenance-records', data),
  runDepreciation: (data: { month: number; year: number }) => api.post('/equipment/depreciation/run', data),
  listDepreciation: (params?: Record<string, unknown>) => api.get('/equipment/depreciation', { params }),
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
  downloadPdf: (id: string) => api.get(`/billing/invoices/${id}/pdf`, { responseType: 'blob' }),
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
  getRuns: (params?: Record<string, unknown>) => api.get('/payroll/runs', { params }),
  getRun: (id: string) => api.get(`/payroll/runs/${id}`),
  markRunPaid: (id: string) => api.patch(`/payroll/runs/${id}/mark-paid`),
};

export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data: unknown) => api.patch('/settings', data),
  getSso: () => api.get('/settings/sso'),
  updateSso: (data: unknown) => api.put('/settings/sso', data),
  getPresets: () => api.get('/settings/presets'),
  applyPreset: (presetKey: string) => api.post('/settings/apply-preset', { presetKey }),
  getStatutorySchemes: () => api.get('/settings/statutory-schemes'),
  createStatutoryScheme: (data: unknown) => api.post('/settings/statutory-schemes', data),
  updateStatutoryScheme: (id: string, data: unknown) => api.patch(`/settings/statutory-schemes/${id}`, data),
};

export const approvalChainsApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/approval-chains', { params }),
  create: (data: unknown) => api.post('/approval-chains', data),
  update: (id: string, data: unknown) => api.patch(`/approval-chains/${id}`, data),
  getInstance: (instanceId: string) => api.get(`/approval-chains/instances/${instanceId}`),
};

export const recruitmentApi = {
  getRequisitions: (params?: Record<string, unknown>) => api.get('/recruitment/requisitions', { params }),
  getRequisition: (id: string) => api.get(`/recruitment/requisitions/${id}`),
  createRequisition: (data: unknown) => api.post('/recruitment/requisitions', data),
  updateRequisition: (id: string, data: unknown) => api.patch(`/recruitment/requisitions/${id}`, data),
  getCandidates: (params?: Record<string, unknown>) => api.get('/recruitment/candidates', { params }),
  createCandidate: (data: unknown) => api.post('/recruitment/candidates', data),
  updateCandidate: (id: string, data: unknown) => api.patch(`/recruitment/candidates/${id}`, data),
  getApplications: (params?: Record<string, unknown>) => api.get('/recruitment/applications', { params }),
  createApplication: (requisitionId: string, candidateId: string) =>
    api.post(`/recruitment/requisitions/${requisitionId}/applications`, { candidateId }),
  updateApplicationStage: (id: string, data: { stage: string; rejectionReason?: string }) =>
    api.patch(`/recruitment/applications/${id}/stage`, data),
  hire: (applicationId: string, data: unknown) => api.post(`/recruitment/applications/${applicationId}/hire`, data),
};

export const checklistsApi = {
  getTemplates: (purpose: 'ONBOARDING' | 'OFFBOARDING') => api.get('/checklists/templates', { params: { purpose } }),
  createTemplate: (data: unknown) => api.post('/checklists/templates', data),
  updateTemplate: (id: string, data: unknown) => api.patch(`/checklists/templates/${id}`, data),
  createTemplateTask: (templateId: string, data: unknown) => api.post(`/checklists/templates/${templateId}/tasks`, data),
  updateTemplateTask: (templateId: string, taskId: string, data: unknown) =>
    api.patch(`/checklists/templates/${templateId}/tasks/${taskId}`, data),
  deleteTemplateTask: (templateId: string, taskId: string) => api.delete(`/checklists/templates/${templateId}/tasks/${taskId}`),
  createInstance: (data: { employeeId: string; templateId: string; startDate: string }) => api.post('/checklists/instances', data),
  getInstances: (params?: Record<string, unknown>) => api.get('/checklists/instances', { params }),
  getInstance: (id: string) => api.get(`/checklists/instances/${id}`),
  updateInstanceTask: (instanceId: string, taskId: string, isDone: boolean) =>
    api.patch(`/checklists/instances/${instanceId}/tasks/${taskId}`, { isDone }),
};

export const skillsApi = {
  getCatalog: () => api.get('/skills/catalog'),
  createSkill: (data: unknown) => api.post('/skills/catalog', data),
  updateSkill: (id: string, data: unknown) => api.patch(`/skills/catalog/${id}`, data),
  getEmployeeSkills: (employeeId: string) => api.get(`/skills/employees/${employeeId}`),
  setEmployeeSkill: (employeeId: string, skillId: string, data: unknown) =>
    api.post(`/skills/employees/${employeeId}/${skillId}`, data),
  updateEmployeeSkill: (employeeId: string, skillId: string, data: unknown) =>
    api.patch(`/skills/employees/${employeeId}/${skillId}`, data),
  removeEmployeeSkill: (employeeId: string, skillId: string) => api.delete(`/skills/employees/${employeeId}/${skillId}`),
  getMatrix: (params?: Record<string, unknown>) => api.get('/skills/matrix', { params }),
};

export const performanceApi = {
  getCycles: () => api.get('/performance/cycles'),
  createCycle: (data: unknown) => api.post('/performance/cycles', data),
  updateCycle: (id: string, data: unknown) => api.patch(`/performance/cycles/${id}`, data),
  generateReviews: (cycleId: string, data?: unknown) => api.post(`/performance/cycles/${cycleId}/reviews`, data ?? {}),
  getReviews: (params?: Record<string, unknown>) => api.get('/performance/reviews', { params }),
  getReview: (id: string) => api.get(`/performance/reviews/${id}`),
  submitSelfAssessment: (id: string, data: unknown) => api.patch(`/performance/reviews/${id}/self-assessment`, data),
  submitManagerReview: (id: string, data: unknown) => api.patch(`/performance/reviews/${id}/manager-review`, data),
};

export const employeeCasesApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/employee-cases', { params }),
  get: (id: string) => api.get(`/employee-cases/${id}`),
  create: (data: unknown) => api.post('/employee-cases', data),
  update: (id: string, data: unknown) => api.patch(`/employee-cases/${id}`, data),
  getComments: (id: string) => api.get(`/employee-cases/${id}/comments`),
  addComment: (id: string, data: unknown) => api.post(`/employee-cases/${id}/comments`, data),
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
