import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, Alert, Typography,
  TextField, Table, TableHead, TableRow, TableCell, TableBody,
  Pagination, InputAdornment, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, IconButton, Menu, Divider, LinearProgress,
} from "@mui/material";
import { Add, Search, VerifiedUser, Warning, MoreHoriz, Edit, Visibility } from "@mui/icons-material";
import { complianceApi } from "@/lib/api";
import { formatDate, getStatusChipColor, daysUntil } from "@/lib/utils";

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

function RowMenu({ passId }: { passId: string }) {
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
        <MenuItem onClick={() => { setAnchor(null); navigate(`/compliance/${passId}`); }}
          sx={{ fontSize: "0.875rem", gap: 1.5, py: 1 }}>
          <Visibility sx={{ fontSize: 16, color: "#64748b" }} /> View details
        </MenuItem>
        <MenuItem onClick={() => { setAnchor(null); navigate(`/compliance/${passId}/edit`); }}
          sx={{ fontSize: "0.875rem", gap: 1.5, py: 1 }}>
          <Edit sx={{ fontSize: 16, color: "#64748b" }} /> Edit
        </MenuItem>
      </Menu>
    </>
  );
}

export default function CompliancePage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["compliance", page, search, status],
    queryFn: () => complianceApi.getAll({ page, limit: 20, search, status }),
  });

  const passes = Array.isArray(data?.data?.data?.data) ? data.data.data.data : [];
  const meta = data?.data?.data?.meta;
  const total = isLoading ? "—" : (meta?.total ?? passes.length);

  const validCount = passes.filter((p: any) => {
    const days = p.expiryDate ? daysUntil(p.expiryDate) : null;
    return days !== null && days > 30;
  }).length;
  const expiringSoonCount = passes.filter((p: any) => {
    const days = p.expiryDate ? daysUntil(p.expiryDate) : null;
    return days !== null && days >= 0 && days <= 30;
  }).length;
  const expiredCount = passes.filter((p: any) => {
    const days = p.expiryDate ? daysUntil(p.expiryDate) : null;
    return days !== null && days < 0;
  }).length;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 2 }}>
        <StatCard label="Total Passes" value={total} icon={<VerifiedUser sx={{ fontSize: 22 }} />} iconBg="#eff6ff" iconColor="#2563eb" />
        <StatCard label="Valid" value={isLoading ? "—" : validCount} icon={<VerifiedUser sx={{ fontSize: 22 }} />} iconBg="#f0fdf4" iconColor="#059669" />
        <StatCard label="Expiring Soon" value={isLoading ? "—" : expiringSoonCount} icon={<Warning sx={{ fontSize: 22 }} />} iconBg="#fffbeb" iconColor="#d97706" />
        <StatCard label="Expired" value={isLoading ? "—" : expiredCount} icon={<Warning sx={{ fontSize: 22 }} />} iconBg="#fef2f2" iconColor="#b91c1c" />
      </Box>

      <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
        <Box sx={{ px: 3, pt: 2.5, pb: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <VerifiedUser sx={{ fontSize: 20, color: "#64748b" }} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0f172a" }}>Compliance & Work Passes</Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: "#94a3b8" }}>
                {isLoading ? "Loading…" : `${total} work passes`}
              </Typography>
            </Box>
          </Box>
          <Button variant="contained" size="small" startIcon={<Add />} onClick={() => navigate("/compliance/new")}
            sx={{ borderRadius: "8px", height: 36, fontWeight: 600, textTransform: "none", px: 2, boxShadow: "none" }}>
            Add Work Pass
          </Button>
        </Box>
        <Divider />

        <Box sx={{ px: 3, py: 2, display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          <TextField placeholder="Search by name, FIN…" size="small" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: "#94a3b8" }} /></InputAdornment> }}
            sx={{ minWidth: 260, "& .MuiOutlinedInput-root": { borderRadius: "8px" } }} />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Status</InputLabel>
            <Select value={status} label="Status" onChange={e => { setStatus(e.target.value); setPage(1); }}
              sx={{ borderRadius: "8px" }}>
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="VALID">Valid</MenuItem>
              <MenuItem value="EXPIRING_SOON">Expiring Soon</MenuItem>
              <MenuItem value="EXPIRED">Expired</MenuItem>
              <MenuItem value="PENDING">Pending</MenuItem>
            </Select>
          </FormControl>
          {isLoading && <CircularProgress size={18} />}
        </Box>

        {error && <Alert severity="error" sx={{ mx: 3, mb: 2 }}>Failed to load compliance records.</Alert>}

        <Box sx={{ borderTop: "1px solid #f1f5f9", overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                {["Employee", "Pass Type", "FIN / Pass No.", "Status", "Expiry", "Days Left", ""].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", py: 1.25, width: h === "" ? 48 : "auto" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} sx={{ p: 0, borderBottom: 0 }}><LinearProgress /></TableCell></TableRow>
              )}
              {passes.map((p: any) => {
                const days = p.expiryDate ? daysUntil(p.expiryDate) : null;
                const isExpiringSoon = days !== null && days >= 0 && days <= 30;
                const isExpired = days !== null && days < 0;
                return (
                  <TableRow key={p.id} hover
                    sx={{ cursor: "pointer", "&:hover": { backgroundColor: "#f8fafc" }, "&:last-child td": { borderBottom: 0 }, backgroundColor: isExpired ? "rgba(185,28,28,0.02)" : isExpiringSoon ? "rgba(245,158,11,0.02)" : "transparent" }}
                    onClick={() => navigate(`/compliance/${p.id}`)}>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Box sx={{ width: 36, height: 36, borderRadius: "9px", backgroundColor: isExpired ? "#fee2e2" : isExpiringSoon ? "#fffbeb" : "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {isExpired || isExpiringSoon
                            ? <Warning sx={{ fontSize: 17, color: isExpired ? "#b91c1c" : "#d97706" }} />
                            : <VerifiedUser sx={{ fontSize: 17, color: "#059669" }} />}
                        </Box>
                        <Box>
                          <Typography sx={{ fontWeight: 600, fontSize: "0.875rem", color: "#0f172a" }}>{p.employee?.fullName ?? "—"}</Typography>
                          <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>{p.employee?.employeeId ?? ""}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell><Typography sx={{ fontSize: "0.875rem", color: "#374151" }}>{p.passType ?? "—"}</Typography></TableCell>
                    <TableCell><Typography sx={{ fontSize: "0.875rem", color: "#374151", fontFamily: "monospace" }}>{p.passNumber ?? "—"}</Typography></TableCell>
                    <TableCell><Chip label={p.status} color={getStatusChipColor(p.status)} size="small" /></TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: "0.8125rem", color: isExpired ? "#b91c1c" : "#374151", fontWeight: isExpired ? 700 : 400 }}>
                        {formatDate(p.expiryDate)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {days !== null && (
                        <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: isExpired ? "#b91c1c" : isExpiringSoon ? "#d97706" : "#059669" }}>
                          {isExpired ? `${Math.abs(days)}d ago` : `${days}d`}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}><RowMenu passId={p.id} /></TableCell>
                  </TableRow>
                );
              })}
              {!isLoading && passes.length === 0 && (
                <TableRow><TableCell colSpan={7}>
                  <Box sx={{ textAlign: "center", py: 8 }}>
                    <VerifiedUser sx={{ fontSize: 36, color: "#cbd5e1", mb: 1 }} />
                    <Typography sx={{ fontWeight: 700, color: "#374151" }}>No compliance records found</Typography>
                    <Typography sx={{ color: "#94a3b8", fontSize: "0.875rem" }}>Add work pass records to track compliance.</Typography>
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
