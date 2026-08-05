import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Card, CardContent, Button, Chip, CircularProgress,
  Alert, Table, TableHead, TableRow, TableCell, TableBody, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, FormControl,
  InputLabel, Select, MenuItem, Grid, IconButton, Tooltip,
} from "@mui/material";
import { Add, Edit, AccessTime, CalendarToday } from "@mui/icons-material";
import { toast } from "sonner";
import { timesheetsApi } from "@/lib/api";
import { formatDate, getStatusChipColor } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";

const STATUS_OPTIONS = ["PRESENT", "ABSENT", "HALF_DAY", "OVERTIME", "LEAVE"] as const;
type AttStatus = typeof STATUS_OPTIONS[number];

function statusLabel(s: string) {
  return { PRESENT: "Present", ABSENT: "Absent", HALF_DAY: "Half Day", OVERTIME: "Overtime", LEAVE: "Leave" }[s] ?? s;
}

// ─── Entry Dialog ─────────────────────────────────────────────────────────────
function EntryDialog({
  open, onClose, onSave, entry, projects,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  entry?: any;
  projects: any[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    projectId: entry?.projectId ?? "",
    date: entry?.date ? new Date(entry.date).toISOString().slice(0, 10) : today,
    status: (entry?.status ?? "PRESENT") as AttStatus,
    hoursWorked: entry?.hoursWorked ?? "",
    overtimeHours: entry?.overtimeHours ?? "",
    notes: entry?.notes ?? "",
  });

  const isEdit = !!entry;

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (!form.projectId) { toast.error("Select a project"); return; }
    if (!form.date) { toast.error("Enter a date"); return; }
    onSave({
      projectId: form.projectId,
      date: form.date,
      status: form.status,
      hoursWorked: form.hoursWorked ? Number(form.hoursWorked) : undefined,
      overtimeHours: form.overtimeHours ? Number(form.overtimeHours) : undefined,
      notes: form.notes || undefined,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: "1.05rem", pb: 1 }}>
        {isEdit ? "Edit Timesheet Entry" : "Log Timesheet Entry"}
      </DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl fullWidth size="small" required>
              <InputLabel>Project</InputLabel>
              <Select value={form.projectId} label="Project" onChange={e => set("projectId", e.target.value)}>
                {projects.length === 0 && (
                  <MenuItem disabled value="">No assigned projects</MenuItem>
                )}
                {projects.map((p: any) => (
                  <MenuItem key={p.project.id} value={p.project.id}>
                    {p.project.projectCode} — {p.project.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Date" type="date" required
              value={form.date} onChange={e => set("date", e.target.value)}
              InputLabelProps={{ shrink: true }} />
          </Grid>

          <Grid item xs={6}>
            <FormControl fullWidth size="small" required>
              <InputLabel>Status</InputLabel>
              <Select value={form.status} label="Status" onChange={e => set("status", e.target.value as AttStatus)}>
                {STATUS_OPTIONS.map(s => (
                  <MenuItem key={s} value={s}>{statusLabel(s)}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {(form.status === "PRESENT" || form.status === "OVERTIME") && (
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Hours Worked" type="number"
                inputProps={{ min: 0, max: 24, step: 0.5 }}
                value={form.hoursWorked} onChange={e => set("hoursWorked", e.target.value)} />
            </Grid>
          )}

          {form.status === "OVERTIME" && (
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Overtime Hours" type="number"
                inputProps={{ min: 0, max: 12, step: 0.5 }}
                value={form.overtimeHours} onChange={e => set("overtimeHours", e.target.value)} />
            </Grid>
          )}

          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Notes (optional)" multiline rows={2}
              value={form.notes} onChange={e => set("notes", e.target.value)} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} variant="text" sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button onClick={handleSave} variant="contained"
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none",
            background: "linear-gradient(135deg,#2563eb,#1d4ed8)" }}>
          {isEdit ? "Update" : "Submit"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TimesheetPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.role === "MANAGER";
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  // Fetch assigned projects for this employee
  const { data: projData, isLoading: projLoading } = useQuery({
    queryKey: ["my-projects"],
    queryFn: () => timesheetsApi.getMyProjects(),
  });
  const myProjects: any[] = Array.isArray(projData?.data?.data) ? projData.data.data : [];

  // Fetch timesheet entries for selected month
  const { data, isLoading, error } = useQuery({
    queryKey: ["timesheets-mine", month, year],
    queryFn: () => timesheetsApi.getAll({ month, year, limit: 200 }),
  });
  const entries: any[] = Array.isArray(data?.data?.data?.data) ? data.data.data.data : [];

  const createMut = useMutation({
    mutationFn: (d: any) => timesheetsApi.create(d),
    onSuccess: () => {
      toast.success("Timesheet entry saved");
      qc.invalidateQueries({ queryKey: ["timesheets-mine"] });
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to save"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => timesheetsApi.update(id, data),
    onSuccess: () => {
      toast.success("Entry updated");
      qc.invalidateQueries({ queryKey: ["timesheets-mine"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to update"),
  });

  const totalDays = entries.filter(e => e.status === "PRESENT" || e.status === "OVERTIME").length;
  const halfDays = entries.filter(e => e.status === "HALF_DAY").length;
  const totalHours = entries.reduce((s, e) => s + Number(e.hoursWorked ?? 0), 0);
  const otHours = entries.reduce((s, e) => s + Number(e.overtimeHours ?? 0), 0);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: "#0f172a", letterSpacing: "-0.02em" }}>
            My Timesheet
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748b", mt: 0.25 }}>
            Log your daily attendance and hours for assigned projects
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          {isAdmin && (
            <Button variant="outlined" onClick={() => navigate("/timesheets/admin")}
              sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 600, borderColor: "#e2e8f0", color: "#334155" }}>
              Admin View
            </Button>
          )}
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}
            disabled={myProjects.length === 0}
            sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 700, boxShadow: "none",
              background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
              "&:hover": { boxShadow: "0 4px 12px rgba(37,99,235,0.35)" } }}>
            Log Entry
          </Button>
        </Box>
      </Box>

      {myProjects.length === 0 && !projLoading && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: "10px" }}>
          You have no active project assignments. Contact your manager to be assigned to a project.
        </Alert>
      )}

      {/* Month picker + stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4} md={3}>
          <Card elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: "12px" }}>
            <CardContent sx={{ p: "16px !important" }}>
              <Typography sx={{ color: "#64748b", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", mb: 1.5 }}>
                Period
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <FormControl size="small" sx={{ flex: 1 }}>
                  <Select value={month} onChange={e => setMonth(Number(e.target.value))}>
                    {monthNames.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ width: 90 }}>
                  <Select value={year} onChange={e => setYear(Number(e.target.value))}>
                    {[2023, 2024, 2025, 2026].map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {[
          { label: "Days Present", value: totalDays + (halfDays * 0.5), icon: <CalendarToday sx={{ fontSize: 20, color: "#2563eb" }} /> },
          { label: "Hours Worked", value: `${totalHours.toFixed(1)} h`, icon: <AccessTime sx={{ fontSize: 20, color: "#7c3aed" }} /> },
          { label: "Overtime Hours", value: `${otHours.toFixed(1)} h`, icon: <AccessTime sx={{ fontSize: 20, color: "#f59e0b" }} /> },
        ].map((stat) => (
          <Grid key={stat.label} item xs={12} sm={4} md={3}>
            <Card elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: "12px" }}>
              <CardContent sx={{ p: "16px !important" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Typography sx={{ color: "#64748b", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {stat.label}
                  </Typography>
                  {stat.icon}
                </Box>
                <Typography sx={{ color: "#0f172a", fontWeight: 800, fontSize: "1.5rem", mt: 0.5 }}>
                  {stat.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Entries table */}
      <Card elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: "14px", overflow: "hidden" }}>
        <Box sx={{ px: 3, py: 2, borderBottom: "1px solid #f1f5f9" }}>
          <Typography fontWeight={700} sx={{ color: "#0f172a" }}>
            Entries — {monthNames[month - 1]} {year}
          </Typography>
        </Box>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress size={28} /></Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>Failed to load timesheet</Alert>
        ) : entries.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <CalendarToday sx={{ fontSize: 40, color: "#cbd5e1", mb: 1 }} />
            <Typography color="text.secondary">No entries for this period</Typography>
          </Box>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                {["Date", "Project", "Status", "Hours", "OT Hrs", "Notes", ""].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, color: "#475569", fontSize: "0.75rem", py: 1.25 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((e: any) => (
                <TableRow key={e.id} hover>
                  <TableCell sx={{ fontWeight: 600, color: "#0f172a" }}>{formatDate(e.date)}</TableCell>
                  <TableCell sx={{ color: "#334155" }}>
                    {e.project ? `${e.project.projectCode} — ${e.project.name}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Chip label={statusLabel(e.status)} size="small"
                      color={e.status === "PRESENT" || e.status === "OVERTIME" ? "success" : e.status === "ABSENT" ? "error" : e.status === "HALF_DAY" ? "warning" : "default"} />
                  </TableCell>
                  <TableCell>{e.hoursWorked ?? "—"}</TableCell>
                  <TableCell>{e.overtimeHours ?? "—"}</TableCell>
                  <TableCell sx={{ color: "#64748b", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.notes || "—"}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => setEditing(e)}>
                        <Edit sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </Box>
        )}
      </Card>

      {/* Log new entry */}
      <EntryDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={(d) => createMut.mutate(d)}
        projects={myProjects}
      />

      {/* Edit entry */}
      {editing && (
        <EntryDialog
          open={!!editing}
          onClose={() => setEditing(null)}
          onSave={(d) => updateMut.mutate({ id: editing.id, data: d })}
          entry={editing}
          projects={myProjects}
        />
      )}
    </Box>
  );
}
