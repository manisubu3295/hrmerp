import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Card, CardContent, Button, Chip, CircularProgress,
  Alert, Table, TableHead, TableRow, TableCell, TableBody, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, FormControl,
  InputLabel, Select, MenuItem, Grid, LinearProgress, Tooltip,
} from "@mui/material";
import { Add, EventBusy, CheckCircle, HourglassEmpty, Cancel } from "@mui/icons-material";
import { toast } from "sonner";
import { leaveApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

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

function leaveTypeLabel(t: string) {
  return LEAVE_TYPES.find((l) => l.value === t)?.label ?? t;
}

function statusColor(s: string): "warning" | "success" | "error" | "default" | "info" {
  if (s === "PENDING") return "warning";
  if (s === "APPROVED") return "success";
  if (s === "REJECTED") return "error";
  if (s === "CANCELLED" || s === "WITHDRAWN") return "default";
  return "info";
}

function leaveTypeColor(t: string) {
  const map: Record<string, string> = {
    ANNUAL: "#2563eb", SICK: "#dc2626", UNPAID: "#6b7280",
    MATERNITY: "#7c3aed", PATERNITY: "#0891b2", EMERGENCY: "#ea580c",
    COMPASSIONATE: "#16a34a", PUBLIC_HOLIDAY: "#d97706", OFF_IN_LIEU: "#0d9488",
  };
  return map[t] ?? "#64748b";
}

// ─── Apply Leave Dialog ───────────────────────────────────────────────────────
function ApplyLeaveDialog({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (d: any) => void }) {
  const [form, setForm] = useState({
    leaveType: "ANNUAL", startDate: "", endDate: "", halfDay: false, reason: "",
  });

  function set(k: string, v: any) { setForm((p) => ({ ...p, [k]: v })); }

  function handleSave() {
    if (!form.startDate || !form.endDate) { toast.error("Select start and end dates"); return; }
    onSave({ ...form, halfDay: form.halfDay });
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: "1.05rem", pb: 1 }}>Apply for Leave</DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl fullWidth size="small" required>
              <InputLabel>Leave Type</InputLabel>
              <Select value={form.leaveType} label="Leave Type" onChange={e => set("leaveType", e.target.value)}>
                {LEAVE_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Start Date" type="date" required
              value={form.startDate} onChange={e => set("startDate", e.target.value)}
              InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="End Date" type="date" required
              value={form.endDate} onChange={e => set("endDate", e.target.value)}
              InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth size="small">
              <InputLabel>Duration</InputLabel>
              <Select value={form.halfDay ? "half" : "full"} label="Duration"
                onChange={e => set("halfDay", e.target.value === "half")}>
                <MenuItem value="full">Full Day(s)</MenuItem>
                <MenuItem value="half">Half Day</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Reason (optional)" multiline rows={3}
              value={form.reason} onChange={e => set("reason", e.target.value)} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} variant="text" sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button onClick={handleSave} variant="contained"
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none",
            background: "linear-gradient(135deg,#2563eb,#1d4ed8)" }}>
          Submit Request
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MyLeavePage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [applyOpen, setApplyOpen] = useState(false);
  const [year] = useState(new Date().getFullYear());

  const { data: balanceData, isLoading: balanceLoading } = useQuery({
    queryKey: ["my-leave-balances", year],
    queryFn: () => leaveApi.getBalances({ year }),
  });
  const balances: any[] = Array.isArray(balanceData?.data?.data) ? balanceData.data.data : [];

  const { data: requestData, isLoading: requestLoading } = useQuery({
    queryKey: ["my-leave-requests", year],
    queryFn: () => leaveApi.getRequests({ year, limit: 100 }),
  });
  const requests: any[] = Array.isArray(requestData?.data?.data?.data)
    ? requestData.data.data.data
    : [];

  const createMut = useMutation({
    mutationFn: (d: any) => leaveApi.createRequest(d),
    onSuccess: () => {
      toast.success("Leave request submitted");
      qc.invalidateQueries({ queryKey: ["my-leave-requests"] });
      qc.invalidateQueries({ queryKey: ["my-leave-balances"] });
      setApplyOpen(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to submit"),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => leaveApi.cancelRequest(id),
    onSuccess: () => {
      toast.success("Request cancelled");
      qc.invalidateQueries({ queryKey: ["my-leave-requests"] });
      qc.invalidateQueries({ queryKey: ["my-leave-balances"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to cancel"),
  });

  const pendingCount = requests.filter(r => r.status === "PENDING").length;
  const approvedCount = requests.filter(r => r.status === "APPROVED").length;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: "#0f172a", letterSpacing: "-0.02em" }}>
            My Leave
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748b", mt: 0.25 }}>
            Apply for leave and track your requests — {user?.employee?.firstName}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setApplyOpen(true)}
          sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 700, boxShadow: "none",
            background: "linear-gradient(135deg,#2563eb,#1d4ed8)", px: 2.5 }}>
          Apply Leave
        </Button>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: "Pending", value: pendingCount, icon: <HourglassEmpty />, color: "#f59e0b" },
          { label: "Approved", value: approvedCount, icon: <CheckCircle />, color: "#16a34a" },
          { label: "Total Requests", value: requests.length, icon: <EventBusy />, color: "#2563eb" },
        ].map(stat => (
          <Grid item xs={12} sm={4} key={stat.label}>
            <Card sx={{ borderRadius: "14px", boxShadow: "0 1px 8px rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.04)" }}>
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: "16px !important" }}>
                <Box sx={{ p: 1.25, borderRadius: "10px", background: `${stat.color}18`, color: stat.color }}>
                  {stat.icon}
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={800} sx={{ color: "#0f172a", lineHeight: 1 }}>{stat.value}</Typography>
                  <Typography variant="body2" sx={{ color: "#64748b", mt: 0.25 }}>{stat.label}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Leave Balances */}
      {balances.length > 0 && (
        <Card sx={{ mb: 3, borderRadius: "14px", boxShadow: "0 1px 8px rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.04)" }}>
          <CardContent sx={{ p: "20px !important" }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, color: "#0f172a" }}>
              Leave Balances — {year}
            </Typography>
            <Grid container spacing={2}>
              {balances.map((b: any) => {
                const total = b.entitled + b.carriedOver;
                const used = b.used;
                const pending = b.pending;
                const available = total - used - pending;
                const pct = total > 0 ? Math.min(100, ((used + pending) / total) * 100) : 0;
                const color = leaveTypeColor(b.leaveType);
                return (
                  <Grid item xs={12} sm={6} md={4} key={b.id}>
                    <Box sx={{ p: 1.5, borderRadius: "10px", border: "1px solid rgba(0,0,0,0.06)", background: "#f8fafc" }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75 }}>
                        <Typography variant="body2" fontWeight={700} sx={{ color }}>{leaveTypeLabel(b.leaveType)}</Typography>
                        <Typography variant="body2" fontWeight={700} sx={{ color: "#0f172a" }}>
                          {available} / {total} days
                        </Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={pct}
                        sx={{ height: 6, borderRadius: 3, background: "#e2e8f0",
                          "& .MuiLinearProgress-bar": { background: color, borderRadius: 3 } }} />
                      <Box sx={{ display: "flex", gap: 1.5, mt: 0.75 }}>
                        <Typography variant="caption" sx={{ color: "#64748b" }}>Used: {used}</Typography>
                        {pending > 0 && <Typography variant="caption" sx={{ color: "#f59e0b" }}>Pending: {pending}</Typography>}
                      </Box>
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Leave Requests Table */}
      <Card sx={{ borderRadius: "14px", boxShadow: "0 1px 8px rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.04)" }}>
        <CardContent sx={{ p: "0 !important" }}>
          <Box sx={{ p: "20px 20px 16px" }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0f172a" }}>
              My Requests — {year}
            </Typography>
          </Box>

          {(requestLoading || balanceLoading) ? (
            <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={32} /></Box>
          ) : requests.length === 0 ? (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <EventBusy sx={{ fontSize: 40, color: "#cbd5e1", mb: 1 }} />
              <Typography color="text.secondary">No leave requests yet</Typography>
            </Box>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 700, color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", background: "#f8fafc" } }}>
                    <TableCell>Code</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Start</TableCell>
                    <TableCell>End</TableCell>
                    <TableCell>Days</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map((r: any) => (
                    <TableRow key={r.id} hover>
                      <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem", color: "#2563eb" }}>{r.leaveCode}</TableCell>
                      <TableCell>
                        <Chip label={leaveTypeLabel(r.leaveType)} size="small"
                          sx={{ fontWeight: 600, fontSize: "0.7rem", background: `${leaveTypeColor(r.leaveType)}18`, color: leaveTypeColor(r.leaveType) }} />
                      </TableCell>
                      <TableCell sx={{ fontSize: "0.8rem" }}>{new Date(r.startDate).toLocaleDateString("en-SG")}</TableCell>
                      <TableCell sx={{ fontSize: "0.8rem" }}>{new Date(r.endDate).toLocaleDateString("en-SG")}</TableCell>
                      <TableCell sx={{ fontSize: "0.8rem" }}>{r.totalDays}{r.halfDay ? " (½)" : ""}</TableCell>
                      <TableCell>
                        <Chip label={r.status} size="small" color={statusColor(r.status)}
                          sx={{ fontWeight: 700, fontSize: "0.7rem" }} />
                      </TableCell>
                      <TableCell sx={{ fontSize: "0.8rem", maxWidth: 200 }}>
                        <Tooltip title={r.rejectionReason || r.reason || ""}>
                          <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                            {r.rejectionReason ? `Rejected: ${r.rejectionReason}` : (r.reason || "—")}
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">
                        {r.status === "PENDING" && (
                          <Tooltip title="Cancel Request">
                            <Button size="small" color="error" variant="outlined"
                              onClick={() => cancelMut.mutate(r.id)}
                              disabled={cancelMut.isPending}
                              sx={{ borderRadius: "8px", textTransform: "none", fontSize: "0.75rem", py: 0.25 }}>
                              Cancel
                            </Button>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      <ApplyLeaveDialog
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        onSave={(d) => createMut.mutate(d)}
      />
    </Box>
  );
}
