import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Card, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, CircularProgress, TextField, InputAdornment, FormControl, InputLabel,
  Select, MenuItem, Pagination,
} from "@mui/material";
import { Search, Devices } from "@mui/icons-material";
import { equipmentApi } from "@/lib/api";

const STATUS_COLORS: Record<string, "success" | "warning" | "error" | "default" | "info"> = {
  IN_STOCK: "success", ISSUED: "info", IN_MAINTENANCE: "warning",
  LOST: "error", DAMAGED: "error", RETIRED: "default", DISPOSED: "default",
};

export default function AssetUnitsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["asset-units", page, status],
    queryFn: () => equipmentApi.listAssetUnits({ page, limit: 20, ...(status && { status }) }),
  });
  const units = Array.isArray(data?.data?.data?.data) ? data.data.data.data : [];
  const meta = data?.data?.data?.meta;

  const filtered = search
    ? units.filter((u: any) => u.assetTag?.toLowerCase().includes(search.toLowerCase()) || u.serialNumber?.toLowerCase().includes(search.toLowerCase()) || u.item?.name?.toLowerCase().includes(search.toLowerCase()))
    : units;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: "#faf5ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Devices sx={{ fontSize: 20, color: "#7c3aed" }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>Asset Units</Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>Every individually-tracked (serialized) physical asset</Typography>
        </Box>
      </Box>

      <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
        <Box sx={{ px: 3, py: 2, display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          <TextField placeholder="Search asset tag, serial, or item…" size="small" value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: "#94a3b8" }} /></InputAdornment> }}
            sx={{ minWidth: 280 }} />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Status</InputLabel>
            <Select value={status} label="Status" onChange={e => { setStatus(e.target.value); setPage(1); }}>
              <MenuItem value="">All Statuses</MenuItem>
              {Object.keys(STATUS_COLORS).map(s => <MenuItem key={s} value={s}>{s.replace(/_/g, " ")}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>

        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.75rem", color: "#64748b", background: "#f8fafc" } }}>
                <TableCell>Asset Tag</TableCell><TableCell>Item</TableCell><TableCell>Warehouse</TableCell>
                <TableCell>Status</TableCell><TableCell>Assigned</TableCell><TableCell>Next Maintenance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((u: any) => (
                <TableRow key={u.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate(`/equipment/asset-units/${u.id}`)}>
                  <TableCell sx={{ fontWeight: 600, fontSize: "0.8125rem" }}>{u.assetTag}</TableCell>
                  <TableCell sx={{ fontSize: "0.8125rem" }}>{u.item?.name}</TableCell>
                  <TableCell sx={{ fontSize: "0.8125rem" }}>{u.warehouse?.name}</TableCell>
                  <TableCell><Chip label={u.status.replace(/_/g, " ")} color={STATUS_COLORS[u.status]} size="small" /></TableCell>
                  <TableCell sx={{ fontSize: "0.8125rem" }}>
                    {u.currentEmployee ? `${u.currentEmployee.firstName} ${u.currentEmployee.lastName}` : "—"}
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.8125rem" }}>{u.nextMaintenanceAt ? new Date(u.nextMaintenanceAt).toLocaleDateString("en-SG") : "—"}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6}><Typography sx={{ textAlign: "center", py: 4, color: "#94a3b8" }}>No asset units found.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}

        {meta && meta.totalPages > 1 && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <Pagination count={meta.totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" size="small" />
          </Box>
        )}
      </Card>
    </Box>
  );
}
