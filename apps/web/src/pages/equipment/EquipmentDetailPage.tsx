import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, CircularProgress, Alert, Typography, Grid,
} from "@mui/material";
import { ArrowBack, Edit, Construction } from "@mui/icons-material";
import { toast } from "sonner";
import { equipmentApi } from "@/lib/api";
import { formatDate, getStatusChipColor } from "@/lib/utils";

function InfoField({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "#0f172a" }}>{value ?? "—"}</Typography>
    </Box>
  );
}

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["equipment-item", id],
    queryFn: () => equipmentApi.get(id!),
    enabled: !!id,
  });

  const updateStatusMut = useMutation({
    mutationFn: (status: string) => equipmentApi.updateStatus(id!, status),
    onSuccess: () => { toast.success("Status updated"); qc.invalidateQueries({ queryKey: ["equipment-item", id] }); },
    onError: () => toast.error("Failed to update status"),
  });

  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}><CircularProgress /></Box>;
  if (error || !data) return <Alert severity="error">Equipment not found.</Alert>;

  const item = data?.data?.data ?? data?.data ?? {};
  const derivedStatus = !item.isActive ? "RETIRED" : item.availableQuantity === 0 ? "IN_USE" : item.availableQuantity <= item.minStockLevel ? "MAINTENANCE" : "AVAILABLE";
  const statusColor: Record<string, string> = { AVAILABLE: "#eff6ff", IN_USE: "#f0fdf4", MAINTENANCE: "#fffbeb", RETIRED: "#f8fafc" };
  const iconColor: Record<string, string> = { AVAILABLE: "#2563eb", IN_USE: "#059669", MAINTENANCE: "#d97706", RETIRED: "#94a3b8" };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBack sx={{ fontSize: 16 }} />} onClick={() => navigate("/equipment")} variant="text" size="small" sx={{ color: "#64748b" }}>Back</Button>
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: statusColor[derivedStatus] ?? "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Construction sx={{ fontSize: 20, color: iconColor[derivedStatus] ?? "#94a3b8" }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>{item.name}</Typography>
            <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>{item.itemCode} {item.category?.name ? `· ${item.category.name}` : ""}</Typography>
          </Box>
        </Box>
        <Chip label={derivedStatus} color={getStatusChipColor(derivedStatus)} />
        <Button variant="outlined" startIcon={<Edit sx={{ fontSize: 15 }} />} size="small" onClick={() => navigate(`/equipment/${id}/edit`)} sx={{ borderRadius: "8px" }}>Edit</Button>
      </Box>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Asset Details</Typography>
              <InfoField label="Name" value={item.name} />
              <InfoField label="Item Code" value={item.itemCode} />
              <InfoField label="Category" value={item.category?.name} />
              <InfoField label="Description" value={item.description} />
              <InfoField label="Unit" value={item.unit} />
              <InfoField label="Unit Cost" value={item.unitCost != null ? `SGD ${Number(item.unitCost).toFixed(2)}` : undefined} />
              <InfoField label="Supplier" value={item.supplierName} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Maintenance & Assignment</Typography>
              <InfoField label="Status" value={derivedStatus} />
              <InfoField label="Total Quantity" value={item.totalQuantity} />
              <InfoField label="Available" value={item.availableQuantity} />
              <InfoField label="Min Stock Level" value={item.minStockLevel} />
              <InfoField label="Next Maintenance" value={formatDate(item.nextMaintenanceAt)} />
              <InfoField label="Supplier Contact" value={item.supplierContact} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
