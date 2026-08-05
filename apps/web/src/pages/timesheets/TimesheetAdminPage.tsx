import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Card, CardContent, Button, Chip, CircularProgress,
  Alert, Table, TableHead, TableRow, TableCell, TableBody, Grid,
  FormControl, InputLabel, Select, MenuItem, TextField, InputAdornment,
  IconButton, Tooltip, Collapse, Dialog, DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import {
  Search, Delete, FilterList, ExpandMore, ExpandLess, Download, Upload,
  CalendarToday, People, AccessTime, CheckCircle, Cancel,
} from "@mui/icons-material";
import { toast } from "sonner";
import { timesheetsApi, employeesApi, projectsApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const STATUS_OPTIONS = ["", "PRESENT", "ABSENT", "HALF_DAY", "OVERTIME", "LEAVE"] as const;
const APPROVAL_STATUS_OPTIONS = ["", "PENDING", "APPROVED", "REJECTED"] as const;

function statusLabel(s: string) {
  return { PRESENT: "Present", ABSENT: "Absent", HALF_DAY: "Half Day", OVERTIME: "Overtime", LEAVE: "Leave" }[s] ?? s;
}

function statusColor(s: string): "success" | "error" | "warning" | "info" | "default" {
  if (s === "PRESENT" || s === "OVERTIME") return "success";
  if (s === "ABSENT") return "error";
  if (s === "HALF_DAY") return "warning";
  if (s === "LEAVE") return "info";
  return "default";
}

function approvalColor(s: string): "success" | "error" | "warning" | "default" {
  if (s === "APPROVED") return "success";
  if (s === "REJECTED") return "error";
  if (s === "PENDING") return "warning";
  return "default";
}

function RejectTimesheetDialog({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "14px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Reject Timesheet Entry</DialogTitle>
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

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function TimesheetAdminPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterApproval, setFilterApproval] = useState("");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page] = useState(1);
  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: empData } = useQuery({
    queryKey: ["employees-list-ts"],
    queryFn: () => employeesApi.getAll({ limit: 200 }),
  });
  const employees: any[] = Array.isArray(empData?.data?.data?.data) ? empData.data.data.data : [];

  const { data: projData } = useQuery({
    queryKey: ["projects-list-ts"],
    queryFn: () => projectsApi.getAll({ limit: 200 }),
  });
  const projects: any[] = Array.isArray(projData?.data?.data?.data) ? projData.data.data.data : [];

  const { data, isLoading, error } = useQuery({
    queryKey: ["timesheets-admin", month, year, filterEmployee, filterProject, filterStatus, page],
    queryFn: () => timesheetsApi.getAll({
      month,
      year,
      ...(filterEmployee && { employeeId: filterEmployee }),
      ...(filterProject && { projectId: filterProject }),
      limit: 200,
    }),
  });

  let entries: any[] = Array.isArray(data?.data?.data?.data) ? data.data.data.data : [];

  // Client-side filter by status and search
  if (filterStatus) entries = entries.filter((e: any) => e.status === filterStatus);
  if (filterApproval) entries = entries.filter((e: any) => e.approvalStatus === filterApproval);
  if (search.trim()) {
    const q = search.toLowerCase();
    entries = entries.filter((e: any) =>
      `${e.employee?.firstName} ${e.employee?.lastName}`.toLowerCase().includes(q) ||
      e.employee?.employeeCode?.toLowerCase().includes(q) ||
      e.project?.projectCode?.toLowerCase().includes(q) ||
      e.project?.name?.toLowerCase().includes(q)
    );
  }

  const importMut = useMutation({
    mutationFn: (file: File) => timesheetsApi.bulkImport(file),
    onSuccess: (res) => {
      const r = res?.data?.data;
      setImportResult(r);
      setImportOpen(true);
      toast.success(`Imported ${r?.imported ?? "—"} records`);
      qc.invalidateQueries({ queryKey: ["timesheets-admin"] });
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Import failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => timesheetsApi.remove(id),
    onSuccess: () => { toast.success("Entry deleted"); qc.invalidateQueries({ queryKey: ["timesheets-admin"] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to delete"),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => timesheetsApi.approve(id),
    onSuccess: () => { toast.success("Entry approved"); qc.invalidateQueries({ queryKey: ["timesheets-admin"] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to approve"),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => timesheetsApi.reject(id, reason),
    onSuccess: () => { toast.success("Entry rejected"); qc.invalidateQueries({ queryKey: ["timesheets-admin"] }); setRejectTarget(null); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to reject"),
  });

  // Aggregate stats
  const totalPresent = entries.filter((e: any) => e.status === "PRESENT" || e.status === "OVERTIME").length;
  const totalHours = entries.reduce((s: number, e: any) => s + Number(e.hoursWorked ?? 0), 0);
  const uniqueEmployees = new Set(entries.map((e: any) => e.employeeId)).size;
  const totalWage = entries.reduce((s: number, e: any) => s + Number(e.dailyWage ?? 0) + Number(e.overtimePay ?? 0), 0);
  const pendingApprovalCount = entries.filter((e: any) => e.approvalStatus === "PENDING").length;

  function exportCsv() {
    const header = ["Date", "Employee", "Employee Code", "Project", "Status", "Hours", "OT Hrs", "Daily Wage", "OT Pay", "Notes"];
    const rows = entries.map((e: any) => [
      formatDate(e.date),
      `${e.employee?.firstName} ${e.employee?.lastName}`,
      e.employee?.employeeCode ?? "",
      e.project ? `${e.project.projectCode} - ${e.project.name}` : "",
      statusLabel(e.status),
      e.hoursWorked ?? "",
      e.overtimeHours ?? "",
      e.dailyWage ?? "",
      e.overtimePay ?? "",
      (e.notes ?? "").replace(/,/g, " "),
    ]);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timesheets_${monthNames[month - 1]}_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: "#0f172a", letterSpacing: "-0.02em" }}>
            Timesheets
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748b", mt: 0.25 }}>
            Review attendance and hours across all employees and projects
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button variant="outlined" startIcon={<FilterList />}
            onClick={() => setShowFilters(p => !p)}
            endIcon={showFilters ? <ExpandLess /> : <ExpandMore />}
            sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 600, borderColor: "#e2e8f0", color: "#334155" }}>
            Filters
          </Button>
          <Button variant="outlined" startIcon={<Download />} onClick={exportCsv}
            disabled={entries.length === 0}
            sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 600, borderColor: "#e2e8f0", color: "#334155" }}>
            Export CSV
          </Button>
          <Button
            variant="outlined"
            startIcon={importMut.isPending ? <CircularProgress size={16} /> : <Upload />}
            disabled={importMut.isPending}
            onClick={() => fileRef.current?.click()}
            sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 600, borderColor: "#e2e8f0", color: "#334155" }}
          >
            Import CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importMut.mutate(file);
            }}
          />
        </Box>
      </Box>

      {/* Filters */}
      <Collapse in={showFilters}>
        <Card elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: "12px", mb: 3 }}>
          <CardContent sx={{ px: 3, py: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Month</InputLabel>
                  <Select value={month} label="Month" onChange={e => setMonth(Number(e.target.value))}>
                    {monthNames.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={3} md={1.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Year</InputLabel>
                  <Select value={year} label="Year" onChange={e => setYear(Number(e.target.value))}>
                    {[2023, 2024, 2025, 2026].map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Employee</InputLabel>
                  <Select value={filterEmployee} label="Employee" onChange={e => setFilterEmployee(e.target.value)}>
                    <MenuItem value="">All Employees</MenuItem>
                    {employees.map((e: any) => (
                      <MenuItem key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Project</InputLabel>
                  <Select value={filterProject} label="Project" onChange={e => setFilterProject(e.target.value)}>
                    <MenuItem value="">All Projects</MenuItem>
                    {projects.map((p: any) => (
                      <MenuItem key={p.id} value={p.id}>{p.projectCode} — {p.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select value={filterStatus} label="Status" onChange={e => setFilterStatus(e.target.value)}>
                    {STATUS_OPTIONS.map(s => (
                      <MenuItem key={s} value={s}>{s ? statusLabel(s) : "All Statuses"}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Approval</InputLabel>
                  <Select value={filterApproval} label="Approval" onChange={e => setFilterApproval(e.target.value)}>
                    {APPROVAL_STATUS_OPTIONS.map(s => (
                      <MenuItem key={s} value={s}>{s || "All Approvals"}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={1.5}>
                <TextField fullWidth size="small" placeholder="Search…" value={search}
                  onChange={e => setSearch(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: "#94a3b8" }} /></InputAdornment> }} />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Collapse>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: "Days Present", value: totalPresent, icon: <CalendarToday sx={{ fontSize: 20, color: "#2563eb" }} /> },
          { label: "Unique Employees", value: uniqueEmployees, icon: <People sx={{ fontSize: 20, color: "#7c3aed" }} /> },
          { label: "Total Hours", value: `${totalHours.toFixed(1)} h`, icon: <AccessTime sx={{ fontSize: 20, color: "#059669" }} /> },
          { label: "Total Wage Cost", value: `$${totalWage.toLocaleString("en-SG", { minimumFractionDigits: 2 })}`, icon: <AccessTime sx={{ fontSize: 20, color: "#f59e0b" }} /> },
          { label: "Pending Approval", value: pendingApprovalCount, icon: <CheckCircle sx={{ fontSize: 20, color: pendingApprovalCount > 0 ? "#d97706" : "#94a3b8" }} /> },
        ].map(stat => (
          <Grid key={stat.label} item xs={6} sm={3}>
            <Card elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: "12px" }}>
              <CardContent sx={{ p: "14px !important" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Typography sx={{ color: "#64748b", fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {stat.label}
                  </Typography>
                  {stat.icon}
                </Box>
                <Typography sx={{ color: "#0f172a", fontWeight: 800, fontSize: "1.35rem", mt: 0.5 }}>
                  {stat.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Table */}
      <Card elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: "14px", overflow: "hidden" }}>
        <Box sx={{ px: 3, py: 2, borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography fontWeight={700} sx={{ color: "#0f172a" }}>
            {entries.length} {entries.length === 1 ? "entry" : "entries"} — {monthNames[month - 1]} {year}
          </Typography>
        </Box>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress size={28} /></Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>Failed to load timesheets</Alert>
        ) : entries.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <CalendarToday sx={{ fontSize: 40, color: "#cbd5e1", mb: 1 }} />
            <Typography color="text.secondary">No timesheet entries for this period</Typography>
          </Box>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                {["Date", "Employee", "Project", "Attendance", "Approval", "Hours", "OT Hrs", "Daily Wage", "OT Pay", "Notes", ""].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, color: "#475569", fontSize: "0.75rem", py: 1.25 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((e: any) => (
                <TableRow key={e.id} hover>
                  <TableCell sx={{ fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>{formatDate(e.date)}</TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0f172a" }}>
                      {e.employee?.firstName} {e.employee?.lastName}
                    </Typography>
                    <Typography sx={{ fontSize: "0.7rem", color: "#94a3b8" }}>{e.employee?.employeeCode}</Typography>
                  </TableCell>
                  <TableCell sx={{ color: "#334155" }}>
                    {e.project ? (
                      <>
                        <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0f172a" }}>{e.project.projectCode}</Typography>
                        <Typography sx={{ fontSize: "0.7rem", color: "#94a3b8" }}>{e.project.name}</Typography>
                      </>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <Chip label={statusLabel(e.status)} size="small" color={statusColor(e.status)} />
                  </TableCell>
                  <TableCell>
                    <Tooltip title={e.rejectionReason ? `Rejected: ${e.rejectionReason}` : ""}>
                      <Chip label={e.approvalStatus ?? "PENDING"} size="small" color={approvalColor(e.approvalStatus ?? "PENDING")} />
                    </Tooltip>
                  </TableCell>
                  <TableCell>{e.hoursWorked ?? "—"}</TableCell>
                  <TableCell>{e.overtimeHours ?? "—"}</TableCell>
                  <TableCell>${Number(e.dailyWage ?? 0).toFixed(2)}</TableCell>
                  <TableCell>${Number(e.overtimePay ?? 0).toFixed(2)}</TableCell>
                  <TableCell sx={{ color: "#64748b", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.notes || "—"}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      {e.approvalStatus === "PENDING" && (
                        <>
                          <Tooltip title="Approve">
                            <IconButton size="small" color="success" disabled={approveMut.isPending}
                              onClick={() => approveMut.mutate(e.id)}>
                              <CheckCircle sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reject">
                            <IconButton size="small" color="error" disabled={rejectMut.isPending}
                              onClick={() => setRejectTarget(e.id)}>
                              <Cancel sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      <Tooltip title="Delete entry">
                        <IconButton size="small" color="error"
                          onClick={() => { if (window.confirm("Delete this timesheet entry?")) deleteMut.mutate(e.id); }}>
                          <Delete sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </Box>
        )}
      </Card>

      {/* Import results dialog */}
      <Dialog open={importOpen} onClose={() => setImportOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Import Results</DialogTitle>
        <DialogContent>
          {importResult && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                {[
                  { label: "Imported", value: importResult.imported, color: "#16a34a" },
                  { label: "Skipped", value: importResult.skipped, color: "#d97706" },
                  { label: "Total", value: importResult.total, color: "#2563eb" },
                ].map(({ label, value, color }) => (
                  <Box key={label} sx={{ flex: 1, minWidth: 80, textAlign: "center", p: 1.5, border: "1px solid #e2e8f0", borderRadius: "10px" }}>
                    <Typography sx={{ fontSize: "1.5rem", fontWeight: 800, color }}>{value ?? 0}</Typography>
                    <Typography sx={{ fontSize: "0.75rem", color: "#64748b" }}>{label}</Typography>
                  </Box>
                ))}
              </Box>
              {Array.isArray(importResult.results) && importResult.results.length > 0 && (
                <Box sx={{ maxHeight: 280, overflowY: "auto" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.75rem", color: "#64748b", background: "#f8fafc" } }}>
                        <TableCell>Row</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Message</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {importResult.results.map((row: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell sx={{ fontSize: "0.8125rem" }}>{row.row ?? i + 2}</TableCell>
                          <TableCell>
                            <Chip
                              label={row.status ?? (row.error ? "error" : "ok")}
                              size="small"
                              color={row.status === "imported" || (!row.error) ? "success" : "error"}
                            />
                          </TableCell>
                          <TableCell sx={{ fontSize: "0.8125rem", color: "#64748b" }}>{row.message ?? row.error ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setImportOpen(false)} sx={{ textTransform: "none", fontWeight: 600 }}>Close</Button>
        </DialogActions>
      </Dialog>

      <RejectTimesheetDialog
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={(reason) => rejectTarget && rejectMut.mutate({ id: rejectTarget, reason })}
      />
    </Box>
  );
}
