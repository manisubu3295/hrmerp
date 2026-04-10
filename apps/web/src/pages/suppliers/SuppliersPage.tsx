import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, Chip, Typography, TextField, Table, TableHead,
  TableRow, TableCell, TableBody, Pagination, InputAdornment, CircularProgress,
  IconButton, Menu, MenuItem, Divider, Alert, Tooltip, Switch,
} from "@mui/material";
import {
  Add, Search, LocalShipping, MoreHoriz, Edit, Visibility, Delete,
} from "@mui/icons-material";
import { suppliersApi } from "@/lib/api";
import { toast } from "sonner";

type Supplier = {
  id: string;
  supplierCode: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  isActive: boolean;
  _count: { equipmentItems: number };
};

function RowMenu({ supplier, onToggle }: { supplier: Supplier; onToggle: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const deleteMutation = useMutation({
    mutationFn: () => suppliersApi.remove(supplier.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast.success("Supplier deleted"); },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Cannot delete supplier"),
  });

  return (
    <>
      <IconButton size="small" onClick={e => { e.stopPropagation(); setAnchor(e.currentTarget); }}
        sx={{ color: "#94a3b8", "&:hover": { color: "#374151" } }}>
        <MoreHoriz sx={{ fontSize: 18 }} />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
        onClick={e => e.stopPropagation()}
        PaperProps={{ sx: { boxShadow: "0 4px 20px rgba(0,0,0,0.1)", borderRadius: "10px", border: "1px solid #e2e8f0", minWidth: 160 } }}>
        <MenuItem onClick={() => { setAnchor(null); navigate(`/suppliers/${supplier.id}`); }}
          sx={{ fontSize: "0.875rem", gap: 1.5, py: 1 }}>
          <Visibility sx={{ fontSize: 16, color: "#64748b" }} /> View
        </MenuItem>
        <MenuItem onClick={() => { setAnchor(null); navigate(`/suppliers/${supplier.id}/edit`); }}
          sx={{ fontSize: "0.875rem", gap: 1.5, py: 1 }}>
          <Edit sx={{ fontSize: 16, color: "#64748b" }} /> Edit
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { setAnchor(null); onToggle(); }}
          sx={{ fontSize: "0.875rem", gap: 1.5, py: 1 }}>
          {supplier.isActive ? "Deactivate" : "Activate"}
        </MenuItem>
        {supplier._count.equipmentItems === 0 && (
          <MenuItem onClick={() => { setAnchor(null); deleteMutation.mutate(); }}
            sx={{ fontSize: "0.875rem", gap: 1.5, py: 1, color: "error.main" }}>
            <Delete sx={{ fontSize: 16 }} /> Delete
          </MenuItem>
        )}
      </Menu>
    </>
  );
}

export default function SuppliersPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["suppliers", page, search],
    queryFn: () => suppliersApi.list({ page, limit: 20, search: search || undefined }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      suppliersApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });

  const suppliers: Supplier[] = data?.data?.data?.data ?? [];
  const meta = data?.data?.data?.meta;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
        <Box sx={{ px: 3, pt: 2.5, pb: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <LocalShipping sx={{ fontSize: 20, color: "#64748b" }} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0f172a" }}>Suppliers</Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: "#94a3b8" }}>
                {isLoading ? "Loading…" : `${meta?.total ?? suppliers.length} suppliers`}
              </Typography>
            </Box>
          </Box>
          <Button variant="contained" size="small" startIcon={<Add />} onClick={() => navigate("/suppliers/new")}
            sx={{ borderRadius: "8px", height: 36, fontWeight: 600, textTransform: "none", px: 2, boxShadow: "none" }}>
            New Supplier
          </Button>
        </Box>
        <Divider />

        <Box sx={{ px: 3, py: 2 }}>
          <TextField
            placeholder="Search by name, code, contact…"
            size="small"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: "#94a3b8" }} /></InputAdornment> }}
            sx={{ width: 320, "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
          />
        </Box>

        {error && <Alert severity="error" sx={{ mx: 3, mb: 2 }}>Failed to load suppliers.</Alert>}

        <Box sx={{ borderTop: "1px solid #f1f5f9", overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                {["Supplier", "Contact Person", "Email", "Phone", "City", "Items", "Status", ""].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", py: 1.25, width: h === "" ? 48 : "auto" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              )}
              {suppliers.map((s) => (
                <TableRow key={s.id} hover
                  sx={{ cursor: "pointer", "&:hover": { backgroundColor: "#f8fafc" }, "&:last-child td": { borderBottom: 0 } }}
                  onClick={() => navigate(`/suppliers/${s.id}`)}>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Box sx={{ width: 36, height: 36, borderRadius: "9px", bgcolor: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <LocalShipping sx={{ fontSize: 17, color: "#2563eb" }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: "0.875rem", color: "#0f172a" }}>{s.name}</Typography>
                        <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>{s.supplierCode}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell><Typography sx={{ fontSize: "0.875rem", color: "#374151" }}>{s.contactPerson ?? "—"}</Typography></TableCell>
                  <TableCell><Typography sx={{ fontSize: "0.875rem", color: "#374151" }}>{s.email ?? "—"}</Typography></TableCell>
                  <TableCell><Typography sx={{ fontSize: "0.875rem", color: "#374151" }}>{s.phone ?? "—"}</Typography></TableCell>
                  <TableCell><Typography sx={{ fontSize: "0.875rem", color: "#374151" }}>{s.city ? `${s.city}${s.country ? `, ${s.country}` : ""}` : "—"}</Typography></TableCell>
                  <TableCell>
                    <Chip label={`${s._count.equipmentItems} items`} size="small" variant="outlined" color={s._count.equipmentItems > 0 ? "primary" : "default"} />
                  </TableCell>
                  <TableCell>
                    <Tooltip title={s.isActive ? "Deactivate" : "Activate"}>
                      <Switch
                        size="small"
                        checked={s.isActive}
                        onClick={e => e.stopPropagation()}
                        onChange={(_, checked) => toggleMutation.mutate({ id: s.id, isActive: checked })}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <RowMenu supplier={s} onToggle={() => toggleMutation.mutate({ id: s.id, isActive: !s.isActive })} />
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && suppliers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Box sx={{ textAlign: "center", py: 8 }}>
                      <LocalShipping sx={{ fontSize: 36, color: "#cbd5e1", mb: 1 }} />
                      <Typography sx={{ fontWeight: 700, color: "#374151" }}>No suppliers found</Typography>
                      <Typography sx={{ color: "#94a3b8", fontSize: "0.875rem" }}>Add your first supplier to get started.</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>

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
