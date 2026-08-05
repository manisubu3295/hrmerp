import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, Alert, Typography,
  TextField, Table, TableHead, TableRow, TableCell, TableBody,
  Pagination, InputAdornment, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, IconButton, Menu, Divider, LinearProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText,
} from "@mui/material";
import { Add, Search, Construction, MoreHoriz, Edit, Visibility, Category as CategoryIcon } from "@mui/icons-material";
import { toast } from "sonner";
import { equipmentApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";

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

function CategoriesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data } = useQuery({ queryKey: ["eq-categories-full"], queryFn: () => equipmentApi.listCategories(), enabled: open });
  const categories = Array.isArray(data?.data) ? data.data : Array.isArray(data?.data?.data) ? data.data.data : [];

  const createMut = useMutation({
    mutationFn: () => equipmentApi.createCategory({ name }),
    onSuccess: () => {
      toast.success("Category created");
      qc.invalidateQueries({ queryKey: ["eq-categories-full"] });
      qc.invalidateQueries({ queryKey: ["eq-categories"] });
      setName("");
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to create category"),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "14px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Equipment Categories</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField size="small" fullWidth label="New category name" value={name} onChange={e => setName(e.target.value)} />
          <Button variant="contained" disabled={!name || createMut.isPending} onClick={() => createMut.mutate()}
            sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>
            Add
          </Button>
        </Box>
        <List dense sx={{ maxHeight: 280, overflowY: "auto" }}>
          {categories.map((c: any) => (
            <ListItem key={c.id} divider>
              <ListItemText primary={c.name} secondary={`${c._count?.items ?? 0} item(s)`} />
            </ListItem>
          ))}
          {categories.length === 0 && <Typography sx={{ color: "#94a3b8", fontSize: "0.875rem", textAlign: "center", py: 2 }}>No categories yet.</Typography>}
        </List>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", fontWeight: 600 }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function EquipmentPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isActive, setIsActive] = useState("true");
  const [trackingMode, setTrackingMode] = useState("");
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["equipment", page, search, isActive, trackingMode],
    queryFn: () => equipmentApi.getAll({ page, limit: 20, search, isActive, ...(trackingMode && { trackingMode }) }),
  });

  const { data: summaryData } = useQuery({ queryKey: ["equipment-summary"], queryFn: () => equipmentApi.getSummary() });
  const summary = summaryData?.data?.data ?? {};

  const items = Array.isArray(data?.data?.data?.data) ? data.data.data.data : [];
  const meta = data?.data?.data?.meta;
  const total = isLoading ? "—" : (meta?.total ?? items.length);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 2 }}>
        <StatCard label="Total Items" value={total} icon={<Construction sx={{ fontSize: 22 }} />} iconBg="#eff6ff" iconColor="#2563eb" />
        <StatCard label="Units In Stock" value={summary.totalUnitsInStock ?? "—"} icon={<Construction sx={{ fontSize: 22 }} />} iconBg="#f0fdf4" iconColor="#059669" />
        <StatCard label="Low Stock Items" value={summary.lowStockItems ?? "—"} icon={<Construction sx={{ fontSize: 22 }} />} iconBg="#fef2f2" iconColor="#b91c1c" />
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
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" size="small" startIcon={<CategoryIcon />} onClick={() => setCategoriesOpen(true)}
              sx={{ borderRadius: "8px", height: 36, fontWeight: 600, textTransform: "none", px: 2, borderColor: "#e2e8f0", color: "#334155" }}>
              Categories
            </Button>
            <Button variant="contained" size="small" startIcon={<Add />} onClick={() => navigate("/equipment/new")}
              sx={{ borderRadius: "8px", height: 36, fontWeight: 600, textTransform: "none", px: 2, boxShadow: "none" }}>
              Add Equipment
            </Button>
          </Box>
        </Box>
        <Divider />

        <Box sx={{ px: 3, py: 2, display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          <TextField placeholder="Search equipment…" size="small" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: "#94a3b8" }} /></InputAdornment> }}
            sx={{ minWidth: 260, "& .MuiOutlinedInput-root": { borderRadius: "8px" } }} />
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Status</InputLabel>
            <Select value={isActive} label="Status" onChange={e => { setIsActive(e.target.value); setPage(1); }} sx={{ borderRadius: "8px" }}>
              <MenuItem value="true">Active</MenuItem>
              <MenuItem value="false">Retired</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Tracking</InputLabel>
            <Select value={trackingMode} label="Tracking" onChange={e => { setTrackingMode(e.target.value); setPage(1); }} sx={{ borderRadius: "8px" }}>
              <MenuItem value="">All Tracking Modes</MenuItem>
              <MenuItem value="BULK">Bulk</MenuItem>
              <MenuItem value="SERIALIZED">Serialized</MenuItem>
            </Select>
          </FormControl>
          {isLoading && <CircularProgress size={18} />}
        </Box>

        {error && <Alert severity="error" sx={{ mx: 3, mb: 2 }}>Failed to load equipment.</Alert>}

        <Box sx={{ borderTop: "1px solid #f1f5f9", overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                {["Equipment", "Category", "Tracking", "On Hand", "Supplier", "Status", "Next Maintenance", ""].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", py: 1.25, width: h === "" ? 48 : "auto" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={8} sx={{ p: 0, borderBottom: 0 }}><LinearProgress /></TableCell></TableRow>
              )}
              {items.map((item: any) => {
                const lowStock = item.trackingMode === "BULK" && item.onHand <= item.minStockLevel;
                return (
                  <TableRow key={item.id} hover
                    sx={{ cursor: "pointer", "&:hover": { backgroundColor: "#f8fafc" }, "&:last-child td": { borderBottom: 0 } }}
                    onClick={() => navigate(`/equipment/${item.id}`)}>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Box sx={{ width: 36, height: 36, borderRadius: "9px", backgroundColor: item.isActive ? "#eff6ff" : "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Construction sx={{ fontSize: 17, color: item.isActive ? "#2563eb" : "#94a3b8" }} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontWeight: 600, fontSize: "0.875rem", color: "#0f172a" }}>{item.name}</Typography>
                          <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>{item.itemCode}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell><Typography sx={{ fontSize: "0.875rem", color: "#374151" }}>{item.category?.name ?? "—"}</Typography></TableCell>
                    <TableCell><Chip label={item.trackingMode === "SERIALIZED" ? "Serialized" : "Bulk"} size="small" variant="outlined" /></TableCell>
                    <TableCell><Typography sx={{ fontSize: "0.875rem", color: "#374151", fontFamily: "monospace" }}>{item.onHand}</Typography></TableCell>
                    <TableCell><Typography sx={{ fontSize: "0.875rem", color: "#374151" }}>{item.supplierName ?? "—"}</Typography></TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        <Chip label={item.isActive ? "Active" : "Retired"} color={item.isActive ? "success" : "default"} size="small" />
                        {lowStock && <Chip label="Low Stock" color="warning" size="small" variant="outlined" />}
                      </Box>
                    </TableCell>
                    <TableCell><Typography sx={{ fontSize: "0.8125rem", color: "#374151" }}>{item.nextMaintenanceAt ? formatDate(item.nextMaintenanceAt) : "—"}</Typography></TableCell>
                    <TableCell onClick={e => e.stopPropagation()}><RowMenu equipmentId={item.id} /></TableCell>
                  </TableRow>
                );
              })}
              {!isLoading && items.length === 0 && (
                <TableRow><TableCell colSpan={8}>
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

      <CategoriesDialog open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
    </Box>
  );
}
