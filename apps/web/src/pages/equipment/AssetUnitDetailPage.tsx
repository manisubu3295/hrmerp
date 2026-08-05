import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, CircularProgress, Alert, Typography, Grid,
  Table, TableHead, TableRow, TableCell, TableBody, FormControl, InputLabel, Select, MenuItem,
} from "@mui/material";
import { ArrowBack, Devices } from "@mui/icons-material";
import { toast } from "sonner";
import { equipmentApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";

function InfoField({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "#0f172a" }}>{value ?? "—"}</Typography>
    </Box>
  );
}

const EDITABLE_STATUSES = ["IN_STOCK", "IN_MAINTENANCE", "RETIRED", "DISPOSED"];

export default function AssetUnitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["asset-unit", id],
    queryFn: () => equipmentApi.getAssetUnit(id!),
    enabled: !!id,
  });

  const statusMut = useMutation({
    mutationFn: (status: string) => equipmentApi.updateAssetUnitStatus(id!, status),
    onSuccess: () => { toast.success("Status updated"); qc.invalidateQueries({ queryKey: ["asset-unit", id] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to update status"),
  });

  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}><CircularProgress /></Box>;
  if (error || !data) return <Alert severity="error">Asset unit not found.</Alert>;

  const unit = data?.data?.data ?? data?.data ?? {};

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBack sx={{ fontSize: 16 }} />} onClick={() => navigate("/equipment/asset-units")} variant="text" size="small" sx={{ color: "#64748b" }}>Back</Button>
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: "#faf5ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Devices sx={{ fontSize: 20, color: "#7c3aed" }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>{unit.assetTag}</Typography>
            <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>{unit.item?.name} ({unit.item?.itemCode})</Typography>
          </Box>
        </Box>
        <Chip label={unit.status?.replace(/_/g, " ")} />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Change Status</InputLabel>
          <Select label="Change Status" value="" onChange={e => statusMut.mutate(e.target.value)} disabled={unit.status === "ISSUED"}>
            {EDITABLE_STATUSES.map(s => <MenuItem key={s} value={s}>{s.replace(/_/g, " ")}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Asset Details</Typography>
              <InfoField label="Asset Tag" value={unit.assetTag} />
              <InfoField label="Serial Number" value={unit.serialNumber} />
              <InfoField label="Item" value={unit.item?.name} />
              <InfoField label="Warehouse" value={unit.warehouse?.name} />
              <InfoField label="Purchase Cost" value={unit.purchaseCost != null ? `SGD ${Number(unit.purchaseCost).toFixed(2)}` : undefined} />
              <InfoField label="Purchase Date" value={unit.purchaseDate ? formatDate(unit.purchaseDate) : undefined} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Assignment & Maintenance</Typography>
              <InfoField label="Assigned To" value={unit.currentEmployee ? `${unit.currentEmployee.firstName} ${unit.currentEmployee.lastName}` : undefined} />
              <InfoField label="Current Project" value={unit.currentProject ? `${unit.currentProject.projectCode} — ${unit.currentProject.name}` : undefined} />
              <InfoField label="Next Maintenance Due" value={unit.nextMaintenanceAt ? formatDate(unit.nextMaintenanceAt) : undefined} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6}>
          <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
            <Box sx={{ px: 2, py: 1.5 }}><Typography sx={{ fontWeight: 700, fontSize: "0.875rem" }}>Maintenance History</Typography></Box>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.75rem", color: "#64748b", background: "#f8fafc" } }}>
                  <TableCell>Date</TableCell><TableCell>Description</TableCell><TableCell align="right">Cost</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(unit.maintenanceRecords ?? []).map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell sx={{ fontSize: "0.8125rem" }}>{formatDate(m.performedAt)}</TableCell>
                    <TableCell sx={{ fontSize: "0.8125rem" }}>{m.description}</TableCell>
                    <TableCell align="right">SGD {Number(m.cost ?? 0).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {(unit.maintenanceRecords ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={3}><Typography sx={{ textAlign: "center", py: 3, color: "#94a3b8" }}>None yet.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
            <Box sx={{ px: 2, py: 1.5 }}><Typography sx={{ fontWeight: 700, fontSize: "0.875rem" }}>Depreciation History</Typography></Box>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.75rem", color: "#64748b", background: "#f8fafc" } }}>
                  <TableCell>Period</TableCell><TableCell align="right">Amount</TableCell><TableCell align="right">Book Value</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(unit.depreciationEntries ?? []).map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell sx={{ fontSize: "0.8125rem" }}>{d.periodMonth}/{d.periodYear}</TableCell>
                    <TableCell align="right">SGD {Number(d.depreciationAmount).toFixed(2)}</TableCell>
                    <TableCell align="right">SGD {Number(d.bookValue).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {(unit.depreciationEntries ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={3}><Typography sx={{ textAlign: "center", py: 3, color: "#94a3b8" }}>None yet — run depreciation from the Depreciation page.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
