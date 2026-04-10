import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, CircularProgress, Alert, Typography,
  Grid, Divider, Tabs, Tab, LinearProgress, Avatar, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, Autocomplete, Table,
  TableHead, TableRow, TableCell, TableBody,
} from "@mui/material";
import {
  ArrowBack, Edit, FolderOpen, PersonAdd, Delete, Add, Receipt,
  CheckCircle, Cancel,
} from "@mui/icons-material";
import { toast } from "sonner";
import { projectsApi, employeesApi, expensesApi } from "@/lib/api";
import { formatDate, formatCurrency, getStatusChipColor } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";

const EXPENSE_CATEGORIES = [
  "TRANSPORT", "MEALS", "MATERIALS", "SUB_CONTRACTOR", "PERMITS", "ACCOMMODATION", "MISCELLANEOUS",
];

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "#0f172a" }}>{value ?? "—"}</Typography>
    </Box>
  );
}

function StatCard({ label, value, color = "#0f172a" }: { label: string; value: string; color?: string }) {
  return (
    <Card>
      <CardContent sx={{ p: 2.5 }}>
        <Typography sx={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", mb: 1 }}>{label}</Typography>
        <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color, letterSpacing: "-0.02em" }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

// ─── Assign Employee Dialog ───────────────────────────────────────────────────
function AssignEmployeeDialog({ open, onClose, onAssign, projectId }: {
  open: boolean; onClose: () => void;
  onAssign: (employees: { employeeId: string; role: string; dailyRate: number }[]) => void;
  projectId: string;
}) {
  const [selected, setSelected] = useState<any | null>(null);
  const [role, setRole] = useState("Member");
  const [dailyRate, setDailyRate] = useState("");

  const { data } = useQuery({
    queryKey: ["employees-list"],
    queryFn: () => employeesApi.getAll({ limit: 200, isActive: true }),
    enabled: open,
  });
  const employees: any[] = Array.isArray(data?.data?.data?.data) ? data.data.data.data : [];

  function handleSubmit() {
    if (!selected) { toast.error("Select an employee"); return; }
    onAssign([{ employeeId: selected.id, role, dailyRate: Number(dailyRate) || Number(selected.dailyRate) || 0 }]);
    setSelected(null); setRole("Member"); setDailyRate("");
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: "1rem" }}>Assign Employee to Project</DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5, display: "flex", flexDirection: "column", gap: 2.5 }}>
        <Autocomplete
          options={employees}
          getOptionLabel={(e: any) => `${e.firstName} ${e.lastName}${e.jobTitle ? ` — ${e.jobTitle}` : ""}`}
          value={selected}
          onChange={(_, v) => { setSelected(v); if (v?.dailyRate) setDailyRate(String(v.dailyRate)); }}
          renderInput={(params) => <TextField {...params} label="Employee" size="small" />}
        />
        <TextField
          label="Role on Project"
          size="small"
          value={role}
          onChange={e => setRole(e.target.value)}
          placeholder="e.g. Site Supervisor, Electrician"
        />
        <TextField
          label="Daily Rate (SGD)"
          size="small"
          type="number"
          value={dailyRate}
          onChange={e => setDailyRate(e.target.value)}
          inputProps={{ min: 0, step: "0.01" }}
          helperText="Leave 0 to use employee's default rate"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} variant="text" sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>
          Assign
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Log Expense Dialog ───────────────────────────────────────────────────────
function LogExpenseDialog({ open, onClose, onSave, projectId }: {
  open: boolean; onClose: () => void;
  onSave: (data: any) => void;
  projectId: string;
}) {
  const { user } = useAuthStore();
  const [form, setForm] = useState({
    category: "MATERIALS",
    amount: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
  });

  const { data: empData } = useQuery({
    queryKey: ["employees-list"],
    queryFn: () => employeesApi.getAll({ limit: 200 }),
    enabled: open && !user?.employee?.id,
  });
  const employees: any[] = Array.isArray(empData?.data?.data?.data) ? empData.data.data.data : [];

  const [submittedById, setSubmittedById] = useState<string>("");

  function handleSubmit() {
    if (!form.amount || !form.description || !form.date) { toast.error("Fill all required fields"); return; }
    const empId = user?.employee?.id || submittedById;
    if (!empId) { toast.error("Select who is submitting this expense"); return; }
    onSave({ ...form, projectId, amount: Number(form.amount), submittedById: empId });
    setForm({ category: "MATERIALS", amount: "", description: "", date: new Date().toISOString().slice(0, 10) });
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: "1rem" }}>Log Material / Expense</DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5, display: "flex", flexDirection: "column", gap: 2.5 }}>
        <FormControl size="small" fullWidth>
          <InputLabel>Category</InputLabel>
          <Select value={form.category} label="Category" onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {EXPENSE_CATEGORIES.map(c => <MenuItem key={c} value={c}>{c.replace(/_/g, " ")}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField label="Description *" size="small" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        <TextField label="Amount (SGD) *" size="small" type="number" value={form.amount}
          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} inputProps={{ min: 0, step: "0.01" }} />
        <TextField label="Date *" size="small" type="date" value={form.date}
          onChange={e => setForm(f => ({ ...f, date: e.target.value }))} InputLabelProps={{ shrink: true }} />
        {!user?.employee?.id && (
          <Autocomplete
            options={employees}
            getOptionLabel={(e: any) => `${e.firstName} ${e.lastName}`}
            onChange={(_, v) => setSubmittedById(v?.id ?? "")}
            renderInput={(params) => <TextField {...params} label="Submitted By *" size="small" />}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} variant="text" sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [assignOpen, setAssignOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { user } = useAuthStore();

  const { data, isLoading, error } = useQuery({
    queryKey: ["project", id],
    queryFn: () => projectsApi.get(id!),
    enabled: !!id,
  });

  const { data: expData, isLoading: expLoading } = useQuery({
    queryKey: ["project-expenses", id],
    queryFn: () => expensesApi.getAll({ projectId: id, limit: 100 }),
    enabled: !!id && tab === 3,
  });

  const assignMut = useMutation({
    mutationFn: (employees: any[]) => projectsApi.assignEmployees(id!, { employees }),
    onSuccess: () => { toast.success("Employee assigned"); qc.invalidateQueries({ queryKey: ["project", id] }); setAssignOpen(false); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to assign employee"),
  });

  const removeMut = useMutation({
    mutationFn: (employeeId: string) => projectsApi.removeEmployee(id!, employeeId),
    onSuccess: () => { toast.success("Employee removed"); qc.invalidateQueries({ queryKey: ["project", id] }); },
    onError: () => toast.error("Failed to remove employee"),
  });

  const expenseMut = useMutation({
    mutationFn: (data: any) => expensesApi.create(data),
    onSuccess: () => {
      toast.success("Expense logged");
      qc.invalidateQueries({ queryKey: ["project-expenses", id] });
      setExpenseOpen(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to log expense"),
  });

  const approveMut = useMutation({
    mutationFn: (expId: string) => expensesApi.approve(expId, { approvedById: user?.employee?.id }),
    onSuccess: () => { toast.success("Expense approved"); qc.invalidateQueries({ queryKey: ["project-expenses", id] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to approve"),
  });

  const rejectMut = useMutation({
    mutationFn: ({ expId, reason }: { expId: string; reason: string }) =>
      expensesApi.reject(expId, { approvedById: user?.employee?.id, rejectionReason: reason }),
    onSuccess: () => { toast.success("Expense rejected"); qc.invalidateQueries({ queryKey: ["project-expenses", id] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to reject"),
  });

  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}><CircularProgress /></Box>;
  if (error || !data) return <Alert severity="error">Project not found.</Alert>;

  const p = data?.data?.data ?? data?.data ?? {};
  const assignedEmployees: any[] = Array.isArray(p.employees) ? p.employees : [];
  const expenses: any[] = Array.isArray(expData?.data?.data?.data) ? expData.data.data.data : [];
  const expTotal = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBack sx={{ fontSize: 16 }} />} onClick={() => navigate("/projects")} variant="text" size="small" sx={{ color: "#64748b" }}>Back</Button>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FolderOpen sx={{ fontSize: 20, color: "#2563eb" }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>{p.name}</Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>{p.projectCode}</Typography>
            </Box>
          </Box>
        </Box>
        <Chip label={p.status} color={getStatusChipColor(p.status)} />
        <Button variant="outlined" startIcon={<Edit sx={{ fontSize: 15 }} />} size="small" onClick={() => navigate(`/projects/${id}/edit`)} sx={{ borderRadius: "8px" }}>
          Edit
        </Button>
      </Box>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2.5, borderBottom: "1px solid #e2e8f0", "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: "0.875rem" } }}>
        <Tab label="Overview" />
        <Tab label={`Team (${assignedEmployees.length})`} />
        <Tab label="Financials" />
        <Tab label="Materials & Expenses" />
      </Tabs>

      {/* Overview */}
      {tab === 0 && (
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={8}>
            <Card sx={{ mb: 2.5 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1.5 }}>Description</Typography>
                <Typography sx={{ fontSize: "0.875rem", color: "#374151", lineHeight: 1.7 }}>{p.description ?? "No description provided."}</Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Progress</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <LinearProgress variant="determinate" value={p.progress ?? 0}
                    sx={{ flex: 1, height: 8, borderRadius: 99, "& .MuiLinearProgress-bar": { backgroundColor: (p.progress ?? 0) >= 80 ? "#059669" : (p.progress ?? 0) >= 50 ? "#2563eb" : "#f59e0b" } }} />
                  <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: "#0f172a", minWidth: 40, textAlign: "right" }}>{p.progress ?? 0}%</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <InfoField label="Project Code" value={p.projectCode} />
                <InfoField label="Client" value={p.client?.name} />
                <InfoField label="Start Date" value={formatDate(p.startDate)} />
                <InfoField label="End Date" value={formatDate(p.endDate)} />
                <InfoField label="Contract Value" value={formatCurrency(p.contractValue ?? p.quotedBudget ?? 0)} />
                <InfoField label="Location" value={p.location} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Team */}
      {tab === 1 && (
        <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
          <Box sx={{ px: 3, pt: 2.5, pb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Box>
              <Typography sx={{ fontWeight: 700, color: "#0f172a", fontSize: "0.9375rem" }}>Assigned Employees</Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: "#94a3b8" }}>Manage who is working on this project</Typography>
            </Box>
            <Button variant="contained" size="small" startIcon={<PersonAdd sx={{ fontSize: 15 }} />}
              onClick={() => setAssignOpen(true)}
              sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>
              Assign Employee
            </Button>
          </Box>
          <Divider />
          <Box sx={{ p: 3 }}>
            {assignedEmployees.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 6 }}>
                <PersonAdd sx={{ fontSize: 36, color: "#e2e8f0", mb: 1.5 }} />
                <Typography sx={{ fontWeight: 600, color: "#374151", mb: 0.5 }}>No employees assigned</Typography>
                <Typography sx={{ fontSize: "0.875rem", color: "#94a3b8", mb: 2.5 }}>
                  Assign employees to track their work on this project.
                </Typography>
                <Button variant="contained" size="small" startIcon={<PersonAdd sx={{ fontSize: 15 }} />}
                  onClick={() => setAssignOpen(true)}
                  sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>
                  Assign Employee
                </Button>
              </Box>
            ) : (
              <Box>
                {assignedEmployees.map((e: any, i: number) => {
                  const emp = e.employee ?? e;
                  const name = `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim() || emp.fullName || "—";
                  return (
                    <Box key={e.id ?? emp.id}>
                      {i > 0 && <Divider />}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.5, px: 1, borderRadius: "8px", "&:hover": { backgroundColor: "#f8fafc" } }}>
                        <Avatar sx={{ width: 38, height: 38, fontSize: "0.8125rem", fontWeight: 700, borderRadius: "9px", backgroundColor: "#eff6ff", color: "#2563eb", cursor: "pointer" }}
                          onClick={() => navigate(`/employees/${emp.id}`)}>
                          {name[0]}
                        </Avatar>
                        <Box sx={{ flex: 1, cursor: "pointer" }} onClick={() => navigate(`/employees/${emp.id}`)}>
                          <Typography sx={{ fontWeight: 600, fontSize: "0.875rem", color: "#0f172a" }}>{name}</Typography>
                          <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>{emp.jobTitle ?? emp.designation ?? ""}</Typography>
                        </Box>
                        <Chip label={e.role ?? "Member"} size="small" sx={{ fontSize: "0.75rem", mr: 1 }} />
                        {e.dailyRate && Number(e.dailyRate) > 0 && (
                          <Typography sx={{ fontSize: "0.8125rem", color: "#64748b", mr: 1 }}>SGD {Number(e.dailyRate).toFixed(2)}/day</Typography>
                        )}
                        <Tooltip title="Remove from project">
                          <IconButton size="small" onClick={() => removeMut.mutate(emp.id)}
                            disabled={removeMut.isPending}
                            sx={{ color: "#ef4444", "&:hover": { backgroundColor: "#fef2f2" } }}>
                            <Delete sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </Card>
      )}

      {/* Financials */}
      {tab === 2 && (
        <Grid container spacing={2.5}>
          {[
            ["Contract Value", formatCurrency(p.contractValue ?? p.quotedBudget ?? 0), "#0f172a"],
            ["Total Expenses", formatCurrency(p.totalExpenses ?? 0), "#d97706"],
            ["Labour Cost", formatCurrency(p.labourCost ?? 0), "#7c3aed"],
          ].map(([label, value, color]) => (
            <Grid item xs={12} sm={4} key={label}>
              <StatCard label={label} value={value} color={color} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Materials & Expenses */}
      {tab === 3 && (
        <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
          <Box sx={{ px: 3, pt: 2.5, pb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Box>
              <Typography sx={{ fontWeight: 700, color: "#0f172a", fontSize: "0.9375rem" }}>Materials & Expenses</Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: "#94a3b8" }}>
                {expLoading ? "Loading…" : `${expenses.length} records · Total: ${formatCurrency(expTotal)}`}
              </Typography>
            </Box>
            <Button variant="contained" size="small" startIcon={<Add sx={{ fontSize: 15 }} />}
              onClick={() => setExpenseOpen(true)}
              sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>
              Log Expense
            </Button>
          </Box>
          <Divider />
          <Box sx={{ overflowX: "auto" }}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                  {["Code", "Category", "Description", "Date", "Amount", "Status", "Submitted By"].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", py: 1.25 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {expLoading && (
                  <TableRow><TableCell colSpan={7} sx={{ p: 0 }}><LinearProgress /></TableCell></TableRow>
                )}
                {!expLoading && expenses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Box sx={{ textAlign: "center", py: 6 }}>
                        <Receipt sx={{ fontSize: 36, color: "#e2e8f0", mb: 1.5 }} />
                        <Typography sx={{ fontWeight: 600, color: "#374151", mb: 0.5 }}>No expenses logged</Typography>
                        <Typography sx={{ fontSize: "0.875rem", color: "#94a3b8", mb: 2.5 }}>
                          Log materials, transport, or other costs for this project.
                        </Typography>
                        <Button variant="contained" size="small" startIcon={<Add sx={{ fontSize: 15 }} />}
                          onClick={() => setExpenseOpen(true)}
                          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>
                          Log First Expense
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
                {expenses.map((exp: any) => (
                  <TableRow key={exp.id} hover sx={{ "&:last-child td": { borderBottom: 0 } }}>
                    <TableCell><Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0f172a" }}>{exp.expenseCode}</Typography></TableCell>
                    <TableCell>
                      <Chip label={exp.category?.replace(/_/g, " ")} size="small"
                        sx={{ fontSize: "0.6875rem", fontWeight: 600, height: 20 }} />
                    </TableCell>
                    <TableCell><Typography sx={{ fontSize: "0.8125rem", color: "#374151" }}>{exp.description}</Typography></TableCell>
                    <TableCell><Typography sx={{ fontSize: "0.8125rem", color: "#374151" }}>{formatDate(exp.date)}</Typography></TableCell>
                    <TableCell><Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: "#0f172a" }}>{formatCurrency(exp.amount)}</Typography></TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Chip label={exp.status} color={getStatusChipColor(exp.status)} size="small" />
                        {exp.status === "PENDING" && (
                          <>
                            <Tooltip title="Approve">
                              <IconButton size="small" onClick={() => approveMut.mutate(exp.id)}
                                disabled={approveMut.isPending}
                                sx={{ color: "#059669", "&:hover": { backgroundColor: "#f0fdf4" } }}>
                                <CheckCircle sx={{ fontSize: 17 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reject">
                              <IconButton size="small" onClick={() => setRejectTarget(exp.id)}
                                sx={{ color: "#ef4444", "&:hover": { backgroundColor: "#fef2f2" } }}>
                                <Cancel sx={{ fontSize: 17 }} />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: "0.8125rem", color: "#374151" }}>
                        {exp.submittedBy ? `${exp.submittedBy.firstName} ${exp.submittedBy.lastName}` : "—"}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Card>
      )}

      {/* Reject Expense Dialog */}
      <Dialog open={!!rejectTarget} onClose={() => setRejectTarget(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "14px" } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: "1rem" }}>Reject Expense</DialogTitle>
        <DialogContent dividers sx={{ px: 3, py: 2 }}>
          <TextField label="Rejection Reason (optional)" fullWidth multiline rows={3} size="small"
            value={rejectReason} onChange={e => setRejectReason(e.target.value)}
            placeholder="e.g. Receipt missing, amount too high…" />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setRejectTarget(null)} variant="text" sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
          <Button onClick={() => { rejectMut.mutate({ expId: rejectTarget!, reason: rejectReason }); setRejectTarget(null); setRejectReason(""); }}
            variant="contained" color="error" sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialogs */}
      <AssignEmployeeDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        onAssign={employees => assignMut.mutate(employees)}
        projectId={id!}
      />
      <LogExpenseDialog
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        onSave={data => expenseMut.mutate(data)}
        projectId={id!}
      />
    </Box>
  );
}
