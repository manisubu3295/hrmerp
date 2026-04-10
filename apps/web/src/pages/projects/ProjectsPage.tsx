import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, Alert, Typography,
  TextField, Table, TableHead, TableRow, TableCell, TableBody,
  Pagination, InputAdornment, Select, MenuItem, FormControl, InputLabel,
  LinearProgress, CircularProgress, IconButton, Menu, Divider,
} from "@mui/material";
import {
  Add, Search, FolderOpen, MoreHoriz, Edit, Visibility,
  CheckCircleOutline, PauseCircleOutline, CancelOutlined,
} from "@mui/icons-material";
import { projectsApi } from "@/lib/api";
import { formatDate, formatCurrency, getStatusChipColor } from "@/lib/utils";

const STATUS_FILTERS = [
  { value: "", label: "All Statuses" },
  { value: "ACTIVE",    label: "Active" },
  { value: "DRAFT",     label: "Draft" },
  { value: "ON_HOLD",   label: "On Hold" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

function StatCard({ label, value, icon, iconBg, iconColor }: {
  label: string; value: string | number; icon: React.ReactNode; iconBg: string; iconColor: string;
}) {
  return (
    <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: iconColor }}>
            {icon}
          </Box>
          <Box>
            <Typography sx={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 500 }}>{label}</Typography>
            <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function RowMenu({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  return (
    <>
      <IconButton size="small" onClick={e => { e.stopPropagation(); setAnchor(e.currentTarget); }}
        sx={{ color: "#94a3b8", "&:hover": { color: "#374151" } }}>
        <MoreHoriz sx={{ fontSize: 18 }} />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
        onClick={e => e.stopPropagation()}
        PaperProps={{ sx: { boxShadow: "0 4px 20px rgba(0,0,0,0.1)", borderRadius: "10px", border: "1px solid #e2e8f0", minWidth: 160 } }}>
        <MenuItem onClick={() => { setAnchor(null); navigate(`/projects/${projectId}`); }}
          sx={{ fontSize: "0.875rem", gap: 1.5, py: 1 }}>
          <Visibility sx={{ fontSize: 16, color: "#64748b" }} /> View details
        </MenuItem>
        <MenuItem onClick={() => { setAnchor(null); navigate(`/projects/${projectId}/edit`); }}
          sx={{ fontSize: "0.875rem", gap: 1.5, py: 1 }}>
          <Edit sx={{ fontSize: 16, color: "#64748b" }} /> Edit project
        </MenuItem>
      </Menu>
    </>
  );
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["projects", page, search, status],
    queryFn: () => projectsApi.getAll({ page, limit: 20, search, status }),
  });

  const projects: any[] = Array.isArray(data?.data?.data?.data) ? data.data.data.data : [];
  const meta = data?.data?.data?.meta;
  const total = meta?.total ?? projects.length;

  const active    = projects.filter(p => p.status === "ACTIVE").length;
  const completed = projects.filter(p => p.status === "COMPLETED").length;
  const onHold    = projects.filter(p => p.status === "ON_HOLD").length;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>

      {/* ── Summary stat cards ── */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 2 }}>
        <StatCard label="Total Projects"    value={total}     icon={<FolderOpen sx={{ fontSize: 20 }} />}              iconBg="#eff6ff" iconColor="#2563eb" />
        <StatCard label="Active"            value={active}    icon={<CheckCircleOutline sx={{ fontSize: 20 }} />}       iconBg="#f0fdf4" iconColor="#16a34a" />
        <StatCard label="On Hold"           value={onHold}    icon={<PauseCircleOutline sx={{ fontSize: 20 }} />}      iconBg="#fffbeb" iconColor="#d97706" />
        <StatCard label="Completed"         value={completed} icon={<CancelOutlined sx={{ fontSize: 20 }} />}          iconBg="#f1f5f9" iconColor="#64748b" />
      </Box>

      {/* ── Main card ── */}
      <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>

        {/* Card header */}
        <Box sx={{ px: 3, pt: 2.5, pb: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <FolderOpen sx={{ fontSize: 20, color: "#64748b" }} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0f172a" }}>Projects</Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: "#94a3b8", mt: 0.25 }}>
                Manage active projects, timelines and budgets.
              </Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            size="small"
            startIcon={<Add sx={{ fontSize: 16 }} />}
            onClick={() => navigate("/projects/new")}
            sx={{ borderRadius: "8px", height: 36, fontWeight: 600, textTransform: "none", px: 2, boxShadow: "none", "&:hover": { boxShadow: "none" } }}
          >
            New Project
          </Button>
        </Box>

        <Divider />

        {/* Search + filter bar */}
        <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <TextField
            placeholder="Search by name or code…"
            size="small"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: "#94a3b8" }} /></InputAdornment> }}
            sx={{ minWidth: 260, "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={status}
              label="Status"
              onChange={e => { setStatus(e.target.value); setPage(1); }}
              sx={{ borderRadius: "8px" }}
            >
              {STATUS_FILTERS.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
            </Select>
          </FormControl>
          {isLoading && <CircularProgress size={16} thickness={4} sx={{ ml: 0.5 }} />}
          {(search || status) && (
            <Typography sx={{ fontSize: "0.8125rem", color: "#94a3b8", ml: "auto", fontVariantNumeric: "tabular-nums" }}>
              {projects.length} result{projects.length !== 1 ? "s" : ""}
            </Typography>
          )}
        </Box>

        {error && <Alert severity="error" sx={{ mx: 3, mb: 2 }}>Failed to load projects.</Alert>}

        {/* Table */}
        <Box sx={{ borderTop: "1px solid #f1f5f9", overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", py: 1.25 }}>Project</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", py: 1.25 }}>Client</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", py: 1.25 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", py: 1.25 }}>Progress</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", py: 1.25 }}>Budget</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", py: 1.25 }}>Timeline</TableCell>
                <TableCell sx={{ py: 1.25, width: 48 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {projects.map((p: any) => (
                <TableRow
                  key={p.id}
                  hover
                  sx={{ cursor: "pointer", "&:hover": { backgroundColor: "#f8fafc" }, "&:last-child td": { borderBottom: 0 } }}
                  onClick={() => navigate(`/projects/${p.id}`)}
                >
                  <TableCell sx={{ py: 1.75 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box sx={{ width: 34, height: 34, borderRadius: "8px", backgroundColor: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <FolderOpen sx={{ fontSize: 16, color: "#2563eb" }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: "0.875rem", color: "#0f172a" }}>{p.name}</Typography>
                        <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8", fontFamily: "monospace" }}>{p.projectCode}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 1.75 }}>
                    <Typography sx={{ fontSize: "0.875rem", color: "#374151" }}>{p.client?.name ?? "—"}</Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1.75 }}>
                    <Chip
                      label={p.status?.replace("_", " ")}
                      color={getStatusChipColor(p.status)}
                      size="small"
                      sx={{ fontWeight: 600, fontSize: "0.6875rem", height: 22 }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1.75, minWidth: 140 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                      <LinearProgress
                        variant="determinate"
                        value={p.progress ?? 0}
                        sx={{ flex: 1, height: 5, borderRadius: 99, backgroundColor: "#f1f5f9",
                          "& .MuiLinearProgress-bar": { borderRadius: 99, backgroundColor: (p.progress ?? 0) >= 80 ? "#16a34a" : (p.progress ?? 0) >= 50 ? "#2563eb" : "#d97706" } }}
                      />
                      <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", minWidth: 28, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {p.progress ?? 0}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 1.75 }}>
                    <Typography sx={{ fontSize: "0.875rem", color: "#374151", fontVariantNumeric: "tabular-nums" }}>
                      {p.quotedBudget ? formatCurrency(Number(p.quotedBudget)) : "—"}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1.75 }}>
                    <Typography sx={{ fontSize: "0.8125rem", color: "#374151" }}>{formatDate(p.startDate)}</Typography>
                    {p.endDate && (
                      <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>→ {formatDate(p.endDate)}</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 1.75 }} onClick={e => e.stopPropagation()}>
                    <RowMenu projectId={p.id} />
                  </TableCell>
                </TableRow>
              ))}

              {!isLoading && projects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 8, textAlign: "center", borderBottom: 0 }}>
                    <Box sx={{ width: 52, height: 52, borderRadius: "14px", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", mx: "auto", mb: 1.5 }}>
                      <FolderOpen sx={{ fontSize: 26, color: "#cbd5e1" }} />
                    </Box>
                    <Typography sx={{ fontWeight: 600, color: "#374151", mb: 0.5 }}>No projects found</Typography>
                    <Typography sx={{ color: "#94a3b8", fontSize: "0.875rem" }}>
                      {search || status ? "Try adjusting your filters." : "Create your first project to get started."}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}

              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 6, textAlign: "center", borderBottom: 0 }}>
                    <CircularProgress size={24} thickness={3} sx={{ color: "#94a3b8" }} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <>
            <Divider />
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <Pagination count={meta.totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" size="small" />
            </Box>
          </>
        )}
      </Card>
    </Box>
  );
}
