import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, Alert, Typography, Avatar,
  TextField, Table, TableHead, TableRow, TableCell, TableBody,
  Pagination, InputAdornment, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, IconButton, Menu, Divider, LinearProgress,
} from "@mui/material";
import { Add, Search, People, MoreHoriz, Edit, Visibility } from "@mui/icons-material";
import { employeesApi } from "@/lib/api";
import { formatDate, getStatusChipColor } from "@/lib/utils";

function stringAvatar(name: string) {
  const parts = (name ?? "?").split(" ");
  return { children: parts.map((p: string) => p[0]).join("").slice(0, 2).toUpperCase() };
}

function avatarColor(name: string) {
  const colors = ["#2563eb", "#7c3aed", "#059669", "#dc2626", "#d97706", "#0891b2"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

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

function RowMenu({ employeeId }: { employeeId: string }) {
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
        <MenuItem onClick={() => { setAnchor(null); navigate(`/employees/${employeeId}`); }}
          sx={{ fontSize: "0.875rem", gap: 1.5, py: 1 }}>
          <Visibility sx={{ fontSize: 16, color: "#64748b" }} /> View details
        </MenuItem>
        <MenuItem onClick={() => { setAnchor(null); navigate(`/employees/${employeeId}/edit`); }}
          sx={{ fontSize: "0.875rem", gap: 1.5, py: 1 }}>
          <Edit sx={{ fontSize: 16, color: "#64748b" }} /> Edit
        </MenuItem>
      </Menu>
    </>
  );
}

export default function EmployeesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["employees", page, search, status],
    queryFn: () => employeesApi.getAll({ page, limit: 20, search, status }),
  });

  const employees = Array.isArray(data?.data?.data?.data) ? data.data.data.data : [];
  const meta = data?.data?.data?.meta;
  const total = isLoading ? "—" : (meta?.total ?? employees.length);
  const activeCount = employees.filter((e: any) => e.isActive === true).length;
  const onLeaveCount = 0; // on-leave count requires a separate query

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 2 }}>
        <StatCard label="Total Employees" value={total} icon={<People sx={{ fontSize: 22 }} />} iconBg="#eff6ff" iconColor="#2563eb" />
        <StatCard label="Active" value={isLoading ? "—" : activeCount} icon={<People sx={{ fontSize: 22 }} />} iconBg="#f0fdf4" iconColor="#059669" />
        <StatCard label="On Leave" value={isLoading ? "—" : onLeaveCount} icon={<People sx={{ fontSize: 22 }} />} iconBg="#fffbeb" iconColor="#d97706" />
      </Box>

      <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
        <Box sx={{ px: 3, pt: 2.5, pb: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <People sx={{ fontSize: 20, color: "#64748b" }} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0f172a" }}>Team Directory</Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: "#94a3b8" }}>
                {isLoading ? "Loading…" : `${total} team members`}
              </Typography>
            </Box>
          </Box>
          <Button variant="contained" size="small" startIcon={<Add />} onClick={() => navigate("/employees/new")}
            sx={{ borderRadius: "8px", height: 36, fontWeight: 600, textTransform: "none", px: 2, boxShadow: "none" }}>
            Add Employee
          </Button>
        </Box>
        <Divider />

        <Box sx={{ px: 3, py: 2, display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          <TextField placeholder="Search employees…" size="small" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: "#94a3b8" }} /></InputAdornment> }}
            sx={{ minWidth: 260, "& .MuiOutlinedInput-root": { borderRadius: "8px" } }} />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select value={status} label="Status" onChange={e => { setStatus(e.target.value); setPage(1); }}
              sx={{ borderRadius: "8px" }}>
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="ACTIVE">Active</MenuItem>
              <MenuItem value="INACTIVE">Inactive</MenuItem>
              <MenuItem value="ON_LEAVE">On Leave</MenuItem>
            </Select>
          </FormControl>
          {isLoading && <CircularProgress size={18} />}
        </Box>

        {error && <Alert severity="error" sx={{ mx: 3, mb: 2 }}>Failed to load employees.</Alert>}

        <Box sx={{ borderTop: "1px solid #f1f5f9", overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                {["Employee", "Role / Department", "Nationality", "Work Pass", "Status", "Joined", ""].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", py: 1.25, width: h === "" ? 48 : "auto" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} sx={{ p: 0, borderBottom: 0 }}><LinearProgress /></TableCell></TableRow>
              )}
              {employees.map((e: any) => (
                <TableRow key={e.id} hover
                  sx={{ cursor: "pointer", "&:hover": { backgroundColor: "#f8fafc" }, "&:last-child td": { borderBottom: 0 } }}
                  onClick={() => navigate(`/employees/${e.id}`)}>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Avatar sx={{ width: 36, height: 36, fontSize: "0.75rem", fontWeight: 700, backgroundColor: avatarColor(`${e.firstName ?? ''} ${e.lastName ?? ''}`), borderRadius: "9px" }} {...stringAvatar(`${e.firstName ?? ''} ${e.lastName ?? ''}`)} />
                      <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: "0.875rem", color: "#0f172a" }}>{e.firstName} {e.lastName}</Typography>
                        <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>{e.employeeCode}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: "0.875rem", color: "#374151" }}>{e.jobTitle ?? "—"}</Typography>
                    <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>{e.department ?? ""}</Typography>
                  </TableCell>
                  <TableCell><Typography sx={{ fontSize: "0.875rem", color: "#374151" }}>{e.nationality ?? "—"}</Typography></TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: "0.875rem", color: "#374151" }}>{e.workPass?.[0]?.type ?? "—"}</Typography>
                    {e.workPass?.[0]?.expiryDate && (
                      <Typography sx={{ fontSize: "0.75rem", color: new Date(e.workPass[0].expiryDate) < new Date() ? "#b91c1c" : "#94a3b8" }}>
                        Exp: {formatDate(e.workPass[0].expiryDate)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell><Chip label={e.isActive ? 'Active' : 'Inactive'} color={e.isActive ? 'success' : 'default'} size="small" /></TableCell>
                  <TableCell><Typography sx={{ fontSize: "0.8125rem", color: "#374151" }}>{formatDate(e.joinDate)}</Typography></TableCell>
                  <TableCell onClick={e2 => e2.stopPropagation()}><RowMenu employeeId={e.id} /></TableCell>
                </TableRow>
              ))}
              {!isLoading && employees.length === 0 && (
                <TableRow><TableCell colSpan={7}>
                  <Box sx={{ textAlign: "center", py: 8 }}>
                    <People sx={{ fontSize: 36, color: "#cbd5e1", mb: 1 }} />
                    <Typography sx={{ fontWeight: 700, color: "#374151" }}>No employees found</Typography>
                    <Typography sx={{ color: "#94a3b8", fontSize: "0.875rem" }}>Adjust filters or add a new employee.</Typography>
                  </Box>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Box>

        {meta && meta.totalPages > 1 && (
          <><Divider /><Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <Pagination count={meta.totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" size="small" />
          </Box></>
        )}
      </Card>
    </Box>
  );
}
