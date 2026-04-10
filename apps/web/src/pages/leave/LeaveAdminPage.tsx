import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Card, CardContent, Button, Chip, CircularProgress,
  Alert, Table, TableHead, TableRow, TableCell, TableBody, Grid,
  FormControl, InputLabel, Select, MenuItem, TextField, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions, Tooltip, Tabs, Tab,
  IconButton,
} from "@mui/material";
import {
  Search, CheckCircle, Cancel, HourglassEmpty, People, EventBusy,
  Settings, Visibility, FilterList,
} from "@mui/icons-material";
import { toast } from "sonner";
import { leaveApi, employeesApi } from "@/lib/api";

const LEAVE_TYPES = [
  { value: "ANNUAL", label: "Annual Leave" },
  { value: "SICK", label: "Sick Leave" },
  { value: "UNPAID", label: "Unpaid Leave" },
  { value: "MATERNITY", label: "Maternity Leave" },
  { value: "PATERNITY", label: "Paternity Leave" },
  { value: "EMERGENCY", label: "Emergency Leave" },
  { value: "COMPASSIONATE", label: "Compassionate Leave" },
  { value: "PUBLIC_HOLIDAY", label: "Public Holiday" },
  { value: "OFF_IN_LIEU", label: "Off-in-Lieu" },
];

function leaveTypeLabel(t: string) { return LEAVE_TYPES.find(l => l.value === t)?.label ?? t; }

function statusColor(s: string): "warning" | "success" | "error" | "default" | "info" {
  if (s === "PENDING") return "warning";
  if (s === "APPROVED") return "success";
  if (s === "REJECTED") return "error";
  return "default";
}

// ─── Reject Dialog ────────────────────────────────────────────────────────────
function RejectDialog({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (r: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "14px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Reject Leave Request</DialogTitle>
      <DialogContent>
        <TextField fullWidth size="small" label="Rejection Reason (optional)" multiline rows={3}
          value={reason} onChange={e => setReason(e.target.value)} sx={{ mt: 1 }} />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} variant="text" sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button onClick={() => { onConfirm(reason); setReason(""); }} variant="contained" color="error"
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>
          Reject
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Policy Dialog ─────────────────────────────────────────────────────────────
function PolicyDialog({ open, onClose, existing }: { open: boolean; onClose: () => void; existing: any[] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ leaveType: "ANNUAL", name: "Annual Leave", daysPerYear: 14, carryForwardMax: 5, isPaidLeave: true });

  function set(k: string, v: any) { setForm(p => ({ ...p, [k]: v })); }

  const saveMut = useMutation({
    mutationFn: (d: any) => leaveApi.createPolicy(d),
    onSuccess: () => { toast.success("Policy saved"); qc.invalidateQueries({ queryKey: ["leave-policies"] }); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed"),
  });

  // Auto-fill name when type changes
  function handleTypeChange(t: string) {
    const label = LEAVE_TYPES.find(l => l.value === t)?.label ?? t;
    const existingPolicy = existing.find(p => p.leaveType === t);
    setForm(p => ({
      ...p, leaveType: t, name: label,
      daysPerYear: existingPolicy?.daysPerYear ?? p.daysPerYear,
      carryForwardMax: existingPolicy?.carryForwardMax ?? p.carryForwardMax,
      isPaidLeave: existingPolicy?.isPaidLeave ?? p.isPaidLeave,
    }));
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Configure Leave Policy</DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl fullWidth size="small">
              <InputLabel>Leave Type</InputLabel>
              <Select value={form.leaveType} label="Leave Type" onChange={e => handleTypeChange(e.target.value)}>
                {LEAVE_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Policy Name" value={form.name} onChange={e => set("name", e.target.value)} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Days Per Year" type="number"
              inputProps={{ min: 0, max: 365 }} value={form.daysPerYear} onChange={e => set("daysPerYear", Number(e.target.value))} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Max Carry Forward Days" type="number"
              inputProps={{ min: 0 }} value={form.carryForwardMax} onChange={e => set("carryForwardMax", Number(e.target.value))} />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth size="small">
              <InputLabel>Paid Leave</InputLabel>
              <Select value={form.isPaidLeave ? "yes" : "no"} label="Paid Leave"
                onChange={e => set("isPaidLeave", e.target.value === "yes")}>
                <MenuItem value="yes">Paid</MenuItem>
                <MenuItem value="no">Unpaid</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} variant="text" sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button onClick={() => saveMut.mutate(form)} variant="contained" disabled={saveMut.isPending}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none",
            background: "linear-gradient(135deg,#2563eb,#1d4ed8)" }}>
          Save Policy
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Init Balance Dialog ──────────────────────────────────────────────────────
function InitBalanceDialog({ open, onClose, employees }: { open: boolean; onClose: () => void; employees: any[] }) {
  const qc = useQueryClient();
  const [employeeId, setEmployeeId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());

  const initMut = useMutation({
    mutationFn: () => leaveApi.initBalances({ employeeId, year }),
    onSuccess: () => { toast.success("Balances initialised"); qc.invalidateQueries({ queryKey: ["leave-requests"] }); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "14px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Initialise Leave Balances</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl fullWidth size="small">
              <InputLabel>Employee</InputLabel>
              <Select value={employeeId} label="Employee" onChange={e => setEmployeeId(e.target.value)}>
                {employees.map((e: any) => (
                  <MenuItem key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Year" type="number"
              value={year} onChange={e => setYear(Number(e.target.value))} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} variant="text" sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button onClick={() => initMut.mutate()} variant="contained" disabled={initMut.isPending || !employeeId}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none",
            background: "linear-gradient(135deg,#2563eb,#1d4ed8)" }}>
          Initialise
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LeaveAdminPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [initBalOpen, setInitBalOpen] = useState(false);

  const { data: summaryData } = useQuery({
    queryKey: ["leave-summary"],
    queryFn: () => leaveApi.getSummary(),
  });
  const summary = summaryData?.data?.data ?? { pending: 0, approved: 0, rejected: 0, totalThisYear: 0 };

  const { data, isLoading } = useQuery({
    queryKey: ["leave-requests", statusFilter, typeFilter, year],
    queryFn: () => leaveApi.getRequests({
      ...(statusFilter && { status: statusFilter }),
      ...(typeFilter && { leaveType: typeFilter }),
      year,
      limit: 200,
    }),
  });
  let requests: any[] = Array.isArray(data?.data?.data?.data) ? data.data.data.data : [];

  if (search.trim()) {
    const q = search.toLowerCase();
    requests = requests.filter((r: any) =>
      `${r.employee?.firstName} ${r.employee?.lastName}`.toLowerCase().includes(q) ||
      r.employee?.employeeCode?.toLowerCase().includes(q) ||
      r.leaveCode?.toLowerCase().includes(q)
    );
  }

  const { data: policyData } = useQuery({
    queryKey: ["leave-policies"],
    queryFn: () => leaveApi.getPolicies(),
    enabled: tab === 1,
  });
  const policies: any[] = Array.isArray(policyData?.data?.data) ? policyData.data.data : [];

  const { data: empData } = useQuery({
    queryKey: ["employees-list-leave"],
    queryFn: () => employeesApi.getAll({ limit: 200 }),
  });
  const employees: any[] = Array.isArray(empData?.data?.data?.data) ? empData.data.data.data : [];

  const approveMut = useMutation({
    mutationFn: (id: string) => leaveApi.approveRequest(id),
    onSuccess: () => { toast.success("Leave approved"); qc.invalidateQueries({ queryKey: ["leave-requests"] }); qc.invalidateQueries({ queryKey: ["leave-summary"] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed"),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => leaveApi.rejectRequest(id, reason),
    onSuccess: () => { toast.success("Leave rejected"); qc.invalidateQueries({ queryKey: ["leave-requests"] }); qc.invalidateQueries({ queryKey: ["leave-summary"] }); setRejectTarget(null); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed"),
  });

  const pendingRequests = requests.filter(r => r.status === "PENDING");

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: "#0f172a", letterSpacing: "-0.02em" }}>
            Leave Management
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748b", mt: 0.25 }}>
            Approve &amp; manage employee leave requests and policies
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button variant="outlined" startIcon={<People />} onClick={() => setInitBalOpen(true)}
            sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 600, borderColor: "#e2e8f0", color: "#475569" }}>
            Init Balances
          </Button>
          <Button variant="contained" startIcon={<Settings />} onClick={() => setPolicyOpen(true)}
            sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 700, boxShadow: "none",
              background: "linear-gradient(135deg,#2563eb,#1d4ed8)" }}>
            Leave Policy
          </Button>
        </Box>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: "Pending", value: summary.pending, color: "#f59e0b", icon: <HourglassEmpty /> },
          { label: "Approved", value: summary.approved, color: "#16a34a", icon: <CheckCircle /> },
          { label: "Rejected", value: summary.rejected, color: "#dc2626", icon: <Cancel /> },
          { label: "Total This Year", value: summary.totalThisYear, color: "#2563eb", icon: <EventBusy /> },
        ].map(s => (
          <Grid item xs={6} sm={3} key={s.label}>
            <Card sx={{ borderRadius: "14px", boxShadow: "0 1px 8px rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.04)" }}>
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: "16px !important" }}>
                <Box sx={{ p: 1.25, borderRadius: "10px", background: `${s.color}18`, color: s.color }}>{s.icon}</Box>
                <Box>
                  <Typography variant="h5" fontWeight={800} sx={{ color: "#0f172a", lineHeight: 1 }}>{s.value}</Typography>
                  <Typography variant="caption" sx={{ color: "#64748b" }}>{s.label}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tabs */}
      <Card sx={{ borderRadius: "14px", boxShadow: "0 1px 8px rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.04)" }}>
        <Box sx={{ borderBottom: "1px solid #e2e8f0", px: 2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ "& .MuiTab-root": { textTransform: "none", fontWeight: 600 } }}>
            <Tab label="All Requests" />
            <Tab label="Leave Policies" />
          </Tabs>
        </Box>

        {tab === 0 && (
          <CardContent sx={{ p: "0 !important" }}>
            {/* Filters */}
            <Box sx={{ p: 2, display: "flex", gap: 1.5, flexWrap: "wrap", borderBottom: "1px solid #f1f5f9" }}>
              <TextField size="small" placeholder="Search by name, code..." value={search} onChange={e => setSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: "#94a3b8" }} /></InputAdornment> }}
                sx={{ minWidth: 220, "& .MuiOutlinedInput-root": { borderRadius: "8px" } }} />
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Status</InputLabel>
                <Select value={statusFilter} label="Status" onChange={e => setStatusFilter(e.target.value)}
                  sx={{ borderRadius: "8px" }}>
                  <MenuItem value="">All Status</MenuItem>
                  {["PENDING", "APPROVED", "REJECTED", "CANCELLED"].map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Leave Type</InputLabel>
                <Select value={typeFilter} label="Leave Type" onChange={e => setTypeFilter(e.target.value)}
                  sx={{ borderRadius: "8px" }}>
                  <MenuItem value="">All Types</MenuItem>
                  {LEAVE_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" label="Year" type="number" value={year} onChange={e => setYear(Number(e.target.value))}
                sx={{ width: 100, "& .MuiOutlinedInput-root": { borderRadius: "8px" } }} />
            </Box>

            {isLoading ? (
              <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={32} /></Box>
            ) : requests.length === 0 ? (
              <Box sx={{ p: 4, textAlign: "center" }}>
                <EventBusy sx={{ fontSize: 40, color: "#cbd5e1", mb: 1 }} />
                <Typography color="text.secondary">No leave requests found</Typography>
              </Box>
            ) : (
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ "& th": { fontWeight: 700, color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", background: "#f8fafc" } }}>
                      <TableCell>Code</TableCell>
                      <TableCell>Employee</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Start</TableCell>
                      <TableCell>End</TableCell>
                      <TableCell>Days</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Reason</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {requests.map((r: any) => (
                      <TableRow key={r.id} hover
                        sx={{ background: r.status === "PENDING" ? "rgba(245,158,11,0.03)" : "transparent" }}>
                        <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem", color: "#2563eb" }}>{r.leaveCode}</TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.2 }}>
                              {r.employee?.firstName} {r.employee?.lastName}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                              {r.employee?.employeeCode} · {r.employee?.department ?? "—"}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={leaveTypeLabel(r.leaveType)} size="small"
                            sx={{ fontWeight: 600, fontSize: "0.7rem", background: "#f1f5f9", color: "#475569" }} />
                        </TableCell>
                        <TableCell sx={{ fontSize: "0.8rem" }}>{new Date(r.startDate).toLocaleDateString("en-SG")}</TableCell>
                        <TableCell sx={{ fontSize: "0.8rem" }}>{new Date(r.endDate).toLocaleDateString("en-SG")}</TableCell>
                        <TableCell sx={{ fontSize: "0.8rem", fontWeight: 600 }}>{r.totalDays}{r.halfDay ? " (½)" : ""}</TableCell>
                        <TableCell>
                          <Chip label={r.status} size="small" color={statusColor(r.status)}
                            sx={{ fontWeight: 700, fontSize: "0.7rem" }} />
                        </TableCell>
                        <TableCell sx={{ fontSize: "0.8rem", maxWidth: 160 }}>
                          <Tooltip title={r.rejectionReason || r.reason || ""}>
                            <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>
                              {r.rejectionReason ? `❌ ${r.rejectionReason}` : (r.reason || "—")}
                            </span>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right">
                          {r.status === "PENDING" && (
                            <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                              <Tooltip title="Approve">
                                <IconButton size="small" color="success" onClick={() => approveMut.mutate(r.id)}
                                  disabled={approveMut.isPending}>
                                  <CheckCircle fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Reject">
                                <IconButton size="small" color="error" onClick={() => setRejectTarget(r.id)}
                                  disabled={rejectMut.isPending}>
                                  <Cancel fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          )}
                          {r.status !== "PENDING" && r.approver && (
                            <Typography variant="caption" sx={{ color: "#94a3b8", display: "block", textAlign: "right" }}>
                              By: {r.approver.firstName}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </CardContent>
        )}

        {tab === 1 && (
          <CardContent sx={{ p: "20px !important" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2, alignItems: "center" }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0f172a" }}>Leave Policies</Typography>
              <Button variant="outlined" size="small" startIcon={<Settings />} onClick={() => setPolicyOpen(true)}
                sx={{ borderRadius: "8px", textTransform: "none" }}>
                Configure
              </Button>
            </Box>
            {policies.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: "10px" }}>No leave policies configured. Click Configure to add.</Alert>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 700, color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", background: "#f8fafc" } }}>
                    <TableCell>Type</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell align="right">Days/Year</TableCell>
                    <TableCell align="right">Carry Forward Max</TableCell>
                    <TableCell>Paid</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {policies.map((p: any) => (
                    <TableRow key={p.id} hover>
                      <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem" }}>{p.leaveType}</TableCell>
                      <TableCell sx={{ fontSize: "0.8rem" }}>{p.name}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{p.daysPerYear}</TableCell>
                      <TableCell align="right">{p.carryForwardMax}</TableCell>
                      <TableCell>
                        <Chip label={p.isPaidLeave ? "Paid" : "Unpaid"} size="small"
                          color={p.isPaidLeave ? "success" : "default"} sx={{ fontWeight: 600, fontSize: "0.7rem" }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        )}
      </Card>

      <RejectDialog
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={(reason) => rejectTarget && rejectMut.mutate({ id: rejectTarget, reason })}
      />
      <PolicyDialog open={policyOpen} onClose={() => setPolicyOpen(false)} existing={policies} />
      <InitBalanceDialog open={initBalOpen} onClose={() => setInitBalOpen(false)} employees={employees} />
    </Box>
  );
}
