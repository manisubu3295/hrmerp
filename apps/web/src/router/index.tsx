import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import LoginPage from '@/pages/auth/LoginPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import ProjectsPage from '@/pages/projects/ProjectsPage';
import ProjectDetailPage from '@/pages/projects/ProjectDetailPage';
import NewProjectPage from '@/pages/projects/NewProjectPage';
import EditProjectPage from '@/pages/projects/EditProjectPage';
import EmployeesPage from '@/pages/employees/EmployeesPage';
import EmployeeDetailPage from '@/pages/employees/EmployeeDetailPage';
import NewEmployeePage from '@/pages/employees/NewEmployeePage';
import EditEmployeePage from '@/pages/employees/EditEmployeePage';
import ClientsPage from '@/pages/clients/ClientsPage';
import ClientDetailPage from '@/pages/clients/ClientDetailPage';
import NewClientPage from '@/pages/clients/NewClientPage';
import QuotationsPage from '@/pages/quotations/QuotationsPage';
import QuotationDetailPage from '@/pages/quotations/QuotationDetailPage';
import NewQuotationPage from '@/pages/quotations/NewQuotationPage';
import QuotationTemplatesPage from '@/pages/quotations/QuotationTemplatesPage';
import ExpensesPage from '@/pages/expenses/ExpensesPage';
import NewExpensePage from '@/pages/expenses/NewExpensePage';
import EquipmentPage from '@/pages/equipment/EquipmentPage';
import EquipmentDetailPage from '@/pages/equipment/EquipmentDetailPage';
import NewEquipmentPage from '@/pages/equipment/NewEquipmentPage';
import EditEquipmentPage from '@/pages/equipment/EditEquipmentPage';
import WarehousesPage from '@/pages/equipment/WarehousesPage';
import AssetUnitsPage from '@/pages/equipment/AssetUnitsPage';
import AssetUnitDetailPage from '@/pages/equipment/AssetUnitDetailPage';
import DepreciationPage from '@/pages/equipment/DepreciationPage';
import SuppliersPage from '@/pages/suppliers/SuppliersPage';
import SupplierDetailPage from '@/pages/suppliers/SupplierDetailPage';
import SupplierFormPage from '@/pages/suppliers/SupplierFormPage';
import BillingPage from '@/pages/billing/BillingPage';
import BillingDetailPage from '@/pages/billing/BillingDetailPage';
import NewInvoicePage from '@/pages/billing/NewInvoicePage';
import CompliancePage from '@/pages/compliance/CompliancePage';
import ComplianceDetailPage from '@/pages/compliance/ComplianceDetailPage';
import NewWorkPassPage from '@/pages/compliance/NewWorkPassPage';
import ReportsPage from '@/pages/reports/ReportsPage';
import NotificationsPage from '@/pages/notifications/NotificationsPage';
import TimesheetPage from '@/pages/timesheets/TimesheetPage';
import TimesheetAdminPage from '@/pages/timesheets/TimesheetAdminPage';
import MyLeavePage from '@/pages/leave/MyLeavePage';
import LeaveAdminPage from '@/pages/leave/LeaveAdminPage';
import CalendarPage from '@/pages/calendar/CalendarPage';
import QuotationPortalPage from '@/pages/quotations/QuotationPortalPage';
import PayrollPage from '@/pages/payroll/PayrollPage';
import MyPayslipsPage from '@/pages/payroll/MyPayslipsPage';
import SettingsPage from '@/pages/settings/SettingsPage';
import UsersPage from '@/pages/users/UsersPage';
import ProfilePage from '@/pages/profile/ProfilePage';
import RecruitmentPage from '@/pages/recruitment/RecruitmentPage';
import OnboardingPage from '@/pages/onboarding/OnboardingPage';
import OffboardingPage from '@/pages/offboarding/OffboardingPage';
import SkillsPage from '@/pages/skills/SkillsPage';
import PerformancePage from '@/pages/performance/PerformancePage';
import MyReviewsPage from '@/pages/performance/MyReviewsPage';
import EmployeeCasesPage from '@/pages/employee-cases/EmployeeCasesPage';
import { useAuthStore } from '@/store/auth.store';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Employees → /timesheets, everyone else → /timesheets/admin */
function TimesheetRedirect() {
  const { user } = useAuthStore();
  const isEmployee = user?.role === 'EMPLOYEE' || user?.role === 'SUPERVISOR';
  return <Navigate to={isEmployee ? '/timesheets/my' : '/timesheets/admin'} replace />;
}

/** Employees → /leave/my, admins → /leave/admin */
function LeaveRedirect() {
  const { user } = useAuthStore();
  const isEmployee = user?.role === 'EMPLOYEE' || user?.role === 'SUPERVISOR';
  return <Navigate to={isEmployee ? '/leave/my' : '/leave/admin'} replace />;
}

export function Router() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/portal/quotation/:token" element={<QuotationPortalPage />} />

      <Route
        path="/"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />

        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/new" element={<NewProjectPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="projects/:id/edit" element={<EditProjectPage />} />

        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/new" element={<NewEmployeePage />} />
        <Route path="employees/:id" element={<EmployeeDetailPage />} />
        <Route path="employees/:id/edit" element={<EditEmployeePage />} />

        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/new" element={<NewClientPage />} />
        <Route path="clients/:id" element={<ClientDetailPage />} />

        <Route path="quotations" element={<QuotationsPage />} />
        <Route path="quotations/new" element={<NewQuotationPage />} />
        <Route path="quotations/templates" element={<QuotationTemplatesPage />} />
        <Route path="quotations/:id" element={<QuotationDetailPage />} />

        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="expenses/new" element={<NewExpensePage />} />

        <Route path="equipment" element={<EquipmentPage />} />
        <Route path="equipment/new" element={<NewEquipmentPage />} />
        <Route path="equipment/warehouses" element={<WarehousesPage />} />
        <Route path="equipment/asset-units" element={<AssetUnitsPage />} />
        <Route path="equipment/asset-units/:id" element={<AssetUnitDetailPage />} />
        <Route path="equipment/depreciation" element={<DepreciationPage />} />
        <Route path="equipment/:id/edit" element={<EditEquipmentPage />} />
        <Route path="equipment/:id" element={<EquipmentDetailPage />} />

        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="suppliers/new" element={<SupplierFormPage />} />
        <Route path="suppliers/:id" element={<SupplierDetailPage />} />
        <Route path="suppliers/:id/edit" element={<SupplierFormPage />} />

        <Route path="billing" element={<BillingPage />} />
        <Route path="billing/new" element={<NewInvoicePage />} />
        <Route path="billing/:id" element={<BillingDetailPage />} />

        <Route path="compliance" element={<CompliancePage />} />
        <Route path="compliance/new" element={<NewWorkPassPage />} />
        <Route path="compliance/:id" element={<ComplianceDetailPage />} />

        <Route path="reports" element={<ReportsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="timesheets" element={<TimesheetRedirect />} />
        <Route path="timesheets/my" element={<TimesheetPage />} />
        <Route path="timesheets/admin" element={<TimesheetAdminPage />} />

        <Route path="leave" element={<LeaveRedirect />} />
        <Route path="leave/my" element={<MyLeavePage />} />
        <Route path="leave/admin" element={<LeaveAdminPage />} />

        <Route path="calendar" element={<CalendarPage />} />
        <Route path="payroll" element={<PayrollPage />} />
        <Route path="payroll/my-payslips" element={<MyPayslipsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="profile" element={<ProfilePage />} />

        <Route path="recruitment" element={<RecruitmentPage />} />
        <Route path="onboarding" element={<OnboardingPage />} />
        <Route path="offboarding" element={<OffboardingPage />} />
        <Route path="skills" element={<SkillsPage />} />
        <Route path="performance" element={<PerformancePage />} />
        <Route path="performance/my" element={<MyReviewsPage />} />
        <Route path="employee-cases" element={<EmployeeCasesPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
