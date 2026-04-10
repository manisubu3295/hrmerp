import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, Typography, Grid,
  Divider, Alert, CircularProgress, Table, TableHead, TableRow,
  TableCell, TableBody,
} from "@mui/material";
import { ArrowBack, Edit, LocalShipping } from "@mui/icons-material";
import { suppliersApi } from "@/lib/api";

export default function SupplierDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["supplier", id],
    queryFn: () => suppliersApi.get(id!),
    enabled: !!id,
  });

  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>;
  if (error || !data) return <Alert severity="error">Supplier not found.</Alert>;

  const s = data.data.data;

  function Field({ label, value }: { label: string; value?: string | null }) {
    return (
      <Box>
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Typography>
        <Typography variant="body2" sx={{ mt: 0.25, color: value ? "#0f172a" : "#94a3b8" }}>{value || "—"}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Button startIcon={<ArrowBack sx={{ fontSize: 16 }} />} onClick={() => navigate("/suppliers")}
            variant="text" size="small" sx={{ color: "#64748b" }}>Back</Button>
          <Divider orientation="vertical" flexItem />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <LocalShipping sx={{ fontSize: 20, color: "#64748b" }} />
            <Typography variant="h6" fontWeight={700}>{s.name}</Typography>
            <Typography variant="body2" color="text.secondary">({s.supplierCode})</Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Chip label={s.isActive ? "Active" : "Inactive"} color={s.isActive ? "success" : "default"} size="small" variant="outlined" />
          <Button variant="outlined" startIcon={<Edit sx={{ fontSize: 15 }} />} size="small"
            onClick={() => navigate(`/suppliers/${id}/edit`)} sx={{ borderRadius: "8px" }}>
            Edit
          </Button>
        </Box>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 2, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.75rem" }}>
                Contact Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}><Field label="Contact Person" value={s.contactPerson} /></Grid>
                <Grid item xs={12} sm={6}><Field label="Email" value={s.email} /></Grid>
                <Grid item xs={12} sm={6}><Field label="Phone" value={s.phone} /></Grid>
                <Grid item xs={12} sm={6}><Field label="Tax ID / GST" value={s.taxId} /></Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 2, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.75rem" }}>
                Address
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}><Field label="Street Address" value={s.address} /></Grid>
                <Grid item xs={6}><Field label="City" value={s.city} /></Grid>
                <Grid item xs={6}><Field label="Country" value={s.country} /></Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {s.notes && (
          <Grid item xs={12}>
            <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.75rem" }}>Notes</Typography>
                <Typography variant="body2">{s.notes}</Typography>
              </CardContent>
            </Card>
          </Grid>
        )}

        {s.equipmentItems?.length > 0 && (
          <Grid item xs={12}>
            <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
              <CardContent sx={{ p: 3, pb: 0 }}>
                <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 2, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.75rem" }}>
                  Linked Equipment ({s.equipmentItems.length})
                </Typography>
              </CardContent>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f8fafc" }}>
                    {["Code", "Name", "Available", "Total", "Status"].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {s.equipmentItems.map((item: any) => (
                    <TableRow key={item.id} hover sx={{ cursor: "pointer", "&:last-child td": { borderBottom: 0 } }}
                      onClick={() => navigate(`/equipment/${item.id}`)}>
                      <TableCell sx={{ fontFamily: "monospace", fontSize: "0.8125rem" }}>{item.itemCode}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{item.name}</TableCell>
                      <TableCell>{item.availableQuantity}</TableCell>
                      <TableCell>{item.totalQuantity}</TableCell>
                      <TableCell>
                        <Chip label={item.isActive ? "Active" : "Retired"} color={item.isActive ? "success" : "default"} size="small" variant="outlined" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
