import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, Alert, Typography,
  TextField, Table, TableHead, TableRow, TableCell, TableBody,
  Pagination, InputAdornment, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, IconButton, Menu, Divider, LinearProgress,
} from "@mui/material";
import { Add, Search, Construction, MoreHoriz, Edit, Visibility } from "@mui/icons-material";
import { equipmentApi } from "@/lib/api";
import { formatDate, getStatusChipColor } from "@/lib/utils";

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

function RowMenu({ equipmentId }: { equipmentId: string }) {
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
        <MenuItem onClick={() => { setAnchor(null); navigate(`/equipment/${equipmentId}`); }}
          sx={{ fontSize: "0.875rem", gap: 1.5, py: 1 }}>
          <Visibility sx={{ fontSize: 16, color: "#64748b" }} /> View details
        </MenuItem>
        <MenuItem onClick={() => { setAnchor(null); navigate(`/equipment/${equipmentId}/edit`); }}
          sx={{ fontSize: "0.875rem", gap: 1.5, py: 1 }}>
          <Edit sx={{ fontSize: 16, color: "#64748b" }} /> Edit
        </MenuItem>
      </Menu>
    </>
  );
}

const statusIconBg: Record<string, string> = { AVAILABLE: "#eff6ff", IN_USE: "#f0fdf4", MAINTENANCE: "#fffbeb", RETIRED: "#f8fafc" };
const statusIconColor: Record<string, string> = { AVAILABLE: "#2563eb", IN_USE: "#059669", MAINTENANCE: "#d97706", RETIRED: "#94a3b8" };

export default function EquipmentPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["equipment", page, search, status],
    queryFn: () => equipmentApi.getAll({ page, limit: 20, search, status }),
  });

  const items = Array.isArray(data?.data?.data?.data) ? data.data.data.data : [];
  const meta = data?.data?.data?.meta;
  const total = isLoading ? "—" : (meta?.total ?? items.length);

  // Derive status from schema fields since EquipmentItem has no status column
  function deriveStatus(item: any): string {
    if (!item.isActive) return "RETIRED";
    if (item.availableQuantity === 0) return "IN_USE";
    if (item.availableQuantity <= item.minStockLevel) return "MAINTENANCE";
    return "AVAILABLE";
  }

  const availableCount = items.filter((i: any) => deriveStatus(i) === "AVAILABLE").length;
  const inUseCount = items.filter((i: any) => deriveStatus(i) === "IN_USE").length;
  const maintenanceCount = items.filter((i: any) => deriveStatus(i) === "MAINTENANCE").length;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 2 }}>
        <StatCard label="Total Assets" value={total} icon={<Construction sx={{ fontSize: 22 }} />} iconBg="#eff6ff" iconColor="#2563eb" />
        <StatCard label="Available" value={isLoading ? "—" : availableCount} icon={<Construction sx={{ fontSize: 22 }} />} iconBg="#f0fdf4" iconColor="#059669" />
        <StatCard label="In Use" value={isLoading ? "—" : inUseCount} icon={<Construction sx={{ fontSize: 22 }} />} iconBg="#fffbeb" iconColor="#d97706" />
        <StatCard label="Maintenance" value={isLoading ? "—" : maintenanceCount} icon={<Construction sx={{ fontSize: 22 }} />} iconBg="#fef2f2" iconColor="#b91c1c" />
      </Box>

      <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
        <Box sx={{ px: 3, pt: 2.5, pb: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Construction sx={{ fontSize: 20, color: "#64748b" }} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0f172a" }}>Equipment & Assets</Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: "#94a3b8" }}>
                {isLoading ? "Loading…" : `${total} items in inventory`}
              </Typography>
            </Box>
          </Box>
          <Button variant="contained" size="small" startIcon={<Add />} onClick={() => navigate("/equipment/new")}
            sx={{ borderRadius: "8px", height: 36, fontWeight: 600, textTransform: "none", px: 2, boxShadow: "none" }}>
            Add Equipment
          </Button>
        </Box>
        <Divider />

        <Box sx={{ px: 3, py: 2, display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          <TextField placeholder="Search equipment…" size="small" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: "#94a3b8" }} /></InputAdornment> }}
            sx={{ minWidth: 260, "& .MuiOutlinedInput-root": { borderRadius: "8px" } }} />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select value={status} label="Status" onChange={e => { setStatus(e.target.value); setPage(1); }}
              sx={{ borderRadius: "8px" }}>
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="AVAILABLE">Available</MenuItem>
              <MenuItem value="IN_USE">In Use</MenuItem>
              <MenuItem value="MAINTENANCE">Maintenance</MenuItem>
              <MenuItem value="RETIRED">Retired</MenuItem>
            </Select>
          </FormControl>
          {isLoading && <CircularProgress size={18} />}
        </Box>

        {error && <Alert severity="error" sx={{ mx: 3, mb: 2 }}>Failed to load equipment.</Alert>}

        <Box sx={{ borderTop: "1px solid #f1f5f9", overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                {["Equipment", "Category", "Stock (Avail/Total)", "Supplier", "Status", "Next Maintenance", ""].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", py: 1.25, width: h === "" ? 48 : "auto" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} sx={{ p: 0, borderBottom: 0 }}><LinearProgress /></TableCell></TableRow>
              )}
              {items.map((item: any) => {
                const derivedStatus = deriveStatus(item);
                return (
                  <TableRow key={item.id} hover
                    sx={{ cursor: "pointer", "&:hover": { backgroundColor: "#f8fafc" }, "&:last-child td": { borderBottom: 0 } }}
                    onClick={() => navigate(`/equipment/${item.id}`)}>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Box sx={{ width: 36, height: 36, borderRadius: "9px", backgroundColor: statusIconBg[derivedStatus] ?? "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Construction sx={{ fontSize: 17, color: statusIconColor[derivedStatus] ?? "#94a3b8" }} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontWeight: 600, fontSize: "0.875rem", color: "#0f172a" }}>{item.name}</Typography>
                          <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>{item.itemCode}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell><Typography sx={{ fontSize: "0.875rem", color: "#374151" }}>{item.category?.name ?? "—"}</Typography></TableCell>
                    <TableCell><Typography sx={{ fontSize: "0.875rem", color: "#374151", fontFamily: "monospace" }}>{item.availableQuantity} / {item.totalQuantity}</Typography></TableCell>
                    <TableCell><Typography sx={{ fontSize: "0.875rem", color: "#374151" }}>{item.supplierName ?? "—"}</Typography></TableCell>
                    <TableCell><Chip label={derivedStatus.replace(/_/g, " ")} color={getStatusChipColor(derivedStatus)} size="small" /></TableCell>
                    <TableCell><Typography sx={{ fontSize: "0.8125rem", color: "#374151" }}>{item.nextMaintenanceAt ? formatDate(item.nextMaintenanceAt) : "—"}</Typography></TableCell>
                    <TableCell onClick={e => e.stopPropagation()}><RowMenu equipmentId={item.id} /></TableCell>
                  </TableRow>
                );
              })}
              {!isLoading && items.length === 0 && (
                <TableRow><TableCell colSpan={7}>
                  <Box sx={{ textAlign: "center", py: 8 }}>
                    <Construction sx={{ fontSize: 36, color: "#cbd5e1", mb: 1 }} />
                    <Typography sx={{ fontWeight: 700, color: "#374151" }}>No equipment found</Typography>
                    <Typography sx={{ color: "#94a3b8", fontSize: "0.875rem" }}>Start by registering your equipment assets.</Typography>
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
