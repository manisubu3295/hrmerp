import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Typography, TextField, Table, TableHead,
  TableRow, TableCell, TableBody, Chip, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControlLabel, Checkbox,
} from "@mui/material";
import { Add, Warehouse as WarehouseIcon } from "@mui/icons-material";
import { toast } from "sonner";
import { equipmentApi } from "@/lib/api";

function NewWarehouseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const mutation = useMutation({
    mutationFn: () => equipmentApi.createWarehouse({ code, name, address: address || undefined, isDefault }),
    onSuccess: () => {
      toast.success("Warehouse created");
      qc.invalidateQueries({ queryKey: ["eq-warehouses"] });
      onClose();
      setCode(""); setName(""); setAddress(""); setIsDefault(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to create warehouse"),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "14px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>New Warehouse</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
        <TextField label="Code" size="small" fullWidth value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. SITE-A" />
        <TextField label="Name" size="small" fullWidth value={name} onChange={e => setName(e.target.value)} />
        <TextField label="Address (optional)" size="small" fullWidth multiline rows={2} value={address} onChange={e => setAddress(e.target.value)} />
        <FormControlLabel control={<Checkbox checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />} label="Set as default warehouse" />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} variant="text" sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button variant="contained" disabled={!code || !name || mutation.isPending} onClick={() => mutation.mutate()}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>
          {mutation.isPending ? <CircularProgress size={18} color="inherit" /> : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function WarehousesPage() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["eq-warehouses"], queryFn: () => equipmentApi.listWarehouses() });
  const warehouses = Array.isArray(data?.data) ? data.data : Array.isArray(data?.data?.data) ? data.data.data : [];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <WarehouseIcon sx={{ fontSize: 20, color: "#2563eb" }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>Warehouses</Typography>
            <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>Stock locations for equipment and assets</Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>Add Warehouse</Button>
      </Box>

      <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.75rem", color: "#64748b", background: "#f8fafc" } }}>
                <TableCell>Code</TableCell><TableCell>Name</TableCell><TableCell>Address</TableCell><TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {warehouses.map((w: any) => (
                <TableRow key={w.id} hover>
                  <TableCell sx={{ fontWeight: 600, fontFamily: "monospace", fontSize: "0.8125rem" }}>{w.code}</TableCell>
                  <TableCell sx={{ fontSize: "0.875rem" }}>{w.name}</TableCell>
                  <TableCell sx={{ fontSize: "0.8125rem", color: "#64748b" }}>{w.address ?? "—"}</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      <Chip label={w.isActive ? "Active" : "Inactive"} color={w.isActive ? "success" : "default"} size="small" />
                      {w.isDefault && <Chip label="Default" size="small" variant="outlined" />}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {warehouses.length === 0 && (
                <TableRow><TableCell colSpan={4}><Typography sx={{ textAlign: "center", py: 4, color: "#94a3b8" }}>No warehouses yet.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <NewWarehouseDialog open={open} onClose={() => setOpen(false)} />
    </Box>
  );
}
