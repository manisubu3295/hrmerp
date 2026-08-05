import { useState } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, IconButton, Button, TextField, MenuItem, Select, FormControl,
  InputLabel, Dialog, DialogTitle, DialogContent, DialogActions,
  Tooltip, Stack, Alert, CircularProgress, Switch, Autocomplete,
  List, ListItem, ListItemIcon, ListItemText, Divider,
} from "@mui/material";
import {
  Add, Edit, LockReset, LinkOff, Link as LinkIcon, Search,
  Dashboard, FolderOpen, People, Receipt, AccessTime, EventNote,
  CalendarMonth, AccountBalance, Build, CreditCard, Security,
  BarChart, Notifications, Business, Description, Settings, ManageAccounts,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { usersApi, employeesApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

const ROLES = ["EMPLOYEE", "SUPERVISOR", "MANAGER", "ADMIN", "SUPER_ADMIN"];
const ROLE_COLORS: Record<string, "default" | "primary" | "warning" | "error" | "success"> = {
  EMPLOYEE: "default",
  SUPERVISOR: "primary",
  MANAGER: "success",
  ADMIN: "warning",
  SUPER_ADMIN: "error",
};

// Role → menu access map (mirrors sidebar.tsx role gates)
const ROLE_MENUS: Record<string, { icon: React.ReactNode; label: string }[]> = {
  EMPLOYEE: [
    { icon: <Dashboard fontSize="small" />, label: "Dashboard" },
    { icon: <Receipt fontSize="small" />, label: "Expenses" },
    { icon: <AccessTime fontSize="small" />, label: "Timesheets" },
    { icon: <EventNote fontSize="small" />, label: "Leave" },
    { icon: <CalendarMonth fontSize="small" />, label: "Calendar" },
    { icon: <AccountBalance fontSize="small" />, label: "My Payslips" },
    { icon: <Notifications fontSize="small" />, label: "Alerts" },
  ],
  SUPERVISOR: [
    { icon: <Dashboard fontSize="small" />, label: "Dashboard" },
    { icon: <FolderOpen fontSize="small" />, label: "Projects" },
    { icon: <Receipt fontSize="small" />, label: "Expenses" },
    { icon: <AccessTime fontSize="small" />, label: "Timesheets" },
    { icon: <EventNote fontSize="small" />, label: "Leave" },
    { icon: <CalendarMonth fontSize="small" />, label: "Calendar" },
    { icon: <AccountBalance fontSize="small" />, label: "My Payslips" },
    { icon: <Notifications fontSize="small" />, label: "Alerts" },
  ],
  MANAGER: [
    { icon: <Dashboard fontSize="small" />, label: "Dashboard" },
    { icon: <FolderOpen fontSize="small" />, label: "Projects" },
    { icon: <People fontSize="small" />, label: "Employees" },
    { icon: <Business fontSize="small" />, label: "Clients" },
    { icon: <Description fontSize="small" />, label: "Quotations" },
    { icon: <Receipt fontSize="small" />, label: "Expenses" },
    { icon: <AccessTime fontSize="small" />, label: "Timesheets" },
    { icon: <EventNote fontSize="small" />, label: "Leave" },
    { icon: <CalendarMonth fontSize="small" />, label: "Calendar" },
    { icon: <AccountBalance fontSize="small" />, label: "Payroll" },
    { icon: <Build fontSize="small" />, label: "Equipment" },
    { icon: <CreditCard fontSize="small" />, label: "Billing" },
    { icon: <Security fontSize="small" />, label: "Work Passes" },
    { icon: <BarChart fontSize="small" />, label: "Analytics" },
    { icon: <Notifications fontSize="small" />, label: "Alerts" },
  ],
  ADMIN: [
    { icon: <Dashboard fontSize="small" />, label: "Dashboard" },
    { icon: <FolderOpen fontSize="small" />, label: "Projects" },
    { icon: <People fontSize="small" />, label: "Employees" },
    { icon: <Business fontSize="small" />, label: "Clients" },
    { icon: <Description fontSize="small" />, label: "Quotations" },
    { icon: <Receipt fontSize="small" />, label: "Expenses" },
    { icon: <AccessTime fontSize="small" />, label: "Timesheets" },
    { icon: <EventNote fontSize="small" />, label: "Leave" },
    { icon: <CalendarMonth fontSize="small" />, label: "Calendar" },
    { icon: <AccountBalance fontSize="small" />, label: "Payroll" },
    { icon: <Build fontSize="small" />, label: "Equipment" },
    { icon: <CreditCard fontSize="small" />, label: "Billing" },
    { icon: <Security fontSize="small" />, label: "Work Passes" },
    { icon: <BarChart fontSize="small" />, label: "Analytics" },
    { icon: <Notifications fontSize="small" />, label: "Alerts" },
    { icon: <ManageAccounts fontSize="small" />, label: "Users" },
    { icon: <Settings fontSize="small" />, label: "Settings" },
  ],
  SUPER_ADMIN: [
    { icon: <Dashboard fontSize="small" />, label: "Dashboard" },
    { icon: <FolderOpen fontSize="small" />, label: "Projects" },
    { icon: <People fontSize="small" />, label: "Employees" },
    { icon: <Business fontSize="small" />, label: "Clients" },
    { icon: <Description fontSize="small" />, label: "Quotations" },
    { icon: <Receipt fontSize="small" />, label: "Expenses" },
    { icon: <AccessTime fontSize="small" />, label: "Timesheets" },
    { icon: <EventNote fontSize="small" />, label: "Leave" },
    { icon: <CalendarMonth fontSize="small" />, label: "Calendar" },
    { icon: <AccountBalance fontSize="small" />, label: "Payroll" },
    { icon: <Build fontSize="small" />, label: "Equipment" },
    { icon: <CreditCard fontSize="small" />, label: "Billing" },
    { icon: <Security fontSize="small" />, label: "Work Passes" },
    { icon: <BarChart fontSize="small" />, label: "Analytics" },
    { icon: <Notifications fontSize="small" />, label: "Alerts" },
    { icon: <ManageAccounts fontSize="small" />, label: "Users" },
    { icon: <Settings fontSize="small" />, label: "Settings" },
  ],
};

// ── Link Employee Dialog ──────────────────────────────────────────────────────
function LinkEmployeeDialog({
  user,
  onClose,
}: {
  user: { id: string; email: string; employee?: { id: string; firstName: string; lastName: string; employeeCode: string } | null } | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<{ id: string; label: string } | null>(
    user?.employee
      ? { id: user.employee.id, label: `${user.employee.firstName} ${user.employee.lastName} (${user.employee.employeeCode})` }
      : null,
  );

  const { data: empData, isLoading } = useQuery({
    queryKey: ["employees-minimal"],
    queryFn: () => employeesApi.list({ limit: 200 }),
    enabled: !!user,
  });

  type EmpRow = { id: string; firstName: string; lastName: string; employeeCode: string };
  const employees: { id: string; label: string }[] = (empData?.data?.data ?? []).map((e: EmpRow) => ({
    id: e.id,
    label: `${e.firstName} ${e.lastName} (${e.employeeCode})`,
  }));

  const mutation = useMutation({
    mutationFn: () => usersApi.update(user!.id, { employeeId: selected?.id ?? null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); onClose(); },
  });

  return (
    <Dialog open={!!user} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Link Employee Account</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          User: <b>{user?.email}</b>
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Linking an employee lets this user see their own payslips, timesheets and leave from the employee record.
        </Typography>
        {mutation.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {(mutation.error as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Failed to update"}
          </Alert>
        )}
        <Autocomplete
          options={employees}
          loading={isLoading}
          value={selected}
          onChange={(_, v) => setSelected(v)}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderInput={(params) => (
            <TextField {...params} label="Employee" placeholder="Search by name or code…" fullWidth />
          )}
        />
        {user?.employee && (
          <Button
            size="small"
            color="error"
            startIcon={<LinkOff />}
            sx={{ mt: 1.5 }}
            onClick={() => setSelected(null)}
          >
            Remove link to {user.employee!.firstName} {user.employee!.lastName}
          </Button>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          startIcon={<LinkIcon />}
        >
          {mutation.isPending ? <CircularProgress size={18} /> : selected ? "Link Employee" : "Unlink"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Create User Dialog ────────────────────────────────────────────────────────
function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { user: me } = useAuthStore();
  const isSuperAdmin = me?.role === "SUPER_ADMIN";

  const { register, handleSubmit, reset, formState: { errors }, control } = useForm({
    defaultValues: { email: "", password: "", role: "EMPLOYEE" },
  });

  const mutation = useMutation({
    mutationFn: (data: { email: string; password: string; role: string }) =>
      usersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      reset();
      onClose();
    },
  });

  const availableRoles = isSuperAdmin ? ROLES : ROLES.filter((r) => r !== "ADMIN" && r !== "SUPER_ADMIN");

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Create User</DialogTitle>
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {mutation.error && (
              <Alert severity="error">
                {(mutation.error as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Failed to create user"}
              </Alert>
            )}
            <TextField
              label="Email"
              fullWidth
              {...register("email", { required: "Email is required" })}
              error={!!errors.email}
              helperText={errors.email?.message}
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              {...register("password", {
                required: "Password is required",
                minLength: { value: 8, message: "Minimum 8 characters" },
              })}
              error={!!errors.password}
              helperText={errors.password?.message}
            />
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select {...field} label="Role">
                    {availableRoles.map((r) => (
                      <MenuItem key={r} value={r}>{r.replace(/_/g, " ")}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            {mutation.isPending ? <CircularProgress size={18} /> : "Create"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

// ── Edit Role Dialog ──────────────────────────────────────────────────────────
function EditRoleDialog({
  user,
  onClose,
}: {
  user: { id: string; email: string; role: string } | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { user: me } = useAuthStore();
  const isSuperAdmin = me?.role === "SUPER_ADMIN";
  const [role, setRole] = useState(user?.role ?? "EMPLOYEE");

  const mutation = useMutation({
    mutationFn: () => usersApi.changeRole(user!.id, role),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); onClose(); },
  });

  const availableRoles = isSuperAdmin ? ROLES : ROLES.filter((r) => r !== "ADMIN" && r !== "SUPER_ADMIN");

  return (
    <Dialog open={!!user} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Change Role</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{user?.email}</Typography>
        {mutation.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {(mutation.error as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Failed to update role"}
          </Alert>
        )}
        <FormControl fullWidth>
          <InputLabel>Role</InputLabel>
          <Select value={role} label="Role" onChange={(e) => setRole(e.target.value)}>
            {availableRoles.map((r) => (
              <MenuItem key={r} value={r}>{r.replace(/_/g, " ")}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Menu access preview */}
        {ROLE_MENUS[role] && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
              Menu access for {role.replace(/_/g, " ")}
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1 }}>
              {ROLE_MENUS[role].map((item) => (
                <Chip
                  key={item.label}
                  icon={item.icon as React.ReactElement}
                  label={item.label}
                  size="small"
                  variant="outlined"
                  color="primary"
                />
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? <CircularProgress size={18} /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Reset Password Dialog ─────────────────────────────────────────────────────
function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: { id: string; email: string } | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { newPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: { newPassword: string }) => usersApi.resetPassword(user!.id, data.newPassword),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); onClose(); },
  });

  return (
    <Dialog open={!!user} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Reset Password</DialogTitle>
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{user?.email}</Typography>
          {mutation.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {(mutation.error as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Failed to reset password"}
            </Alert>
          )}
          <TextField
            label="New Password"
            type="password"
            fullWidth
            {...register("newPassword", {
              required: "Password is required",
              minLength: { value: 8, message: "Minimum 8 characters" },
            })}
            error={!!errors.newPassword}
            helperText={errors.newPassword?.message}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" color="warning" variant="contained" disabled={mutation.isPending}>
            {mutation.isPending ? <CircularProgress size={18} /> : "Reset Password"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type UserRow = {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  employee?: { id: string; firstName: string; lastName: string; employeeCode: string } | null;
};

export default function UsersPage() {
  const qc = useQueryClient();
  const { user: me } = useAuthStore();
  const isSuperAdmin = me?.role === "SUPER_ADMIN";

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editRoleUser, setEditRoleUser] = useState<UserRow | null>(null);
  const [resetPwUser, setResetPwUser] = useState<UserRow | null>(null);
  const [linkEmpUser, setLinkEmpUser] = useState<UserRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["users", search, roleFilter],
    queryFn: () =>
      usersApi.list({ search: search || undefined, role: roleFilter || undefined }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      usersApi.setActive(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const users: UserRow[] = data?.data?.data ?? [];

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>User Management</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage system user accounts and access roles
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
          Create User
        </Button>
      </Box>

      {/* Filters */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <TextField
          size="small"
          placeholder="Search by email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: "text.disabled", fontSize: 18 }} /> }}
          sx={{ width: 280 }}
        />
        <FormControl size="small" sx={{ width: 180 }}>
          <InputLabel>Filter by Role</InputLabel>
          <Select value={roleFilter} label="Filter by Role" onChange={(e) => setRoleFilter(e.target.value)}>
            <MenuItem value="">All Roles</MenuItem>
            {ROLES.map((r) => <MenuItem key={r} value={r}>{r.replace(/_/g, " ")}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "action.hover" }}>
                <TableCell><b>Email</b></TableCell>
                <TableCell><b>Role</b></TableCell>
                <TableCell><b>Linked Employee</b></TableCell>
                <TableCell><b>Status</b></TableCell>
                <TableCell><b>Last Login</b></TableCell>
                <TableCell align="right"><b>Actions</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{u.email}</TableCell>
                    <TableCell>
                      <Chip
                        label={u.role.replace(/_/g, " ")}
                        color={ROLE_COLORS[u.role] ?? "default"}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {u.employee ? (
                        <Typography variant="body2">
                          {u.employee.firstName} {u.employee.lastName}
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                            ({u.employee.employeeCode})
                          </Typography>
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={u.isActive ? "Active" : "Inactive"}
                        color={u.isActive ? "success" : "default"}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
                        {/* Toggle active — cannot deactivate self */}
                        {u.id !== me?.id && (
                          <Tooltip title={u.isActive ? "Deactivate" : "Activate"}>
                            <Switch
                              size="small"
                              checked={u.isActive}
                              onChange={(_, checked) =>
                                toggleActiveMutation.mutate({ id: u.id, isActive: checked })
                              }
                            />
                          </Tooltip>
                        )}
                        {/* Change role */}
                        <Tooltip title="Change role">
                          <IconButton size="small" onClick={() => setEditRoleUser(u)}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {/* Reset password — SUPER_ADMIN can reset any; ADMIN cannot reset SUPER_ADMIN */}
                        {(isSuperAdmin || u.role !== "SUPER_ADMIN") && (
                          <Tooltip title="Reset password">
                            <IconButton size="small" color="warning" onClick={() => setResetPwUser(u)}>
                              <LockReset fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {/* Link employee */}
                        <Tooltip title={u.employee ? "Change linked employee" : "Link employee"}>
                          <IconButton size="small" color={u.employee ? "info" : "default"} onClick={() => setLinkEmpUser(u)}>
                            <LinkIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </Box>
        )}
      </Paper>

      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditRoleDialog user={editRoleUser} onClose={() => setEditRoleUser(null)} />
      <ResetPasswordDialog user={resetPwUser} onClose={() => setResetPwUser(null)} />
      <LinkEmployeeDialog user={linkEmpUser} onClose={() => setLinkEmpUser(null)} />
    </Box>
  );
}
