import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, CircularProgress, Alert, Typography, Grid,
} from "@mui/material";
import { ArrowBack, Edit, VerifiedUser, Warning } from "@mui/icons-material";
import { toast } from "sonner";
import { complianceApi } from "@/lib/api";
import { formatDate, getStatusChipColor, daysUntil } from "@/lib/utils";

function InfoField({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "#0f172a" }}>{value ?? "—"}</Typography>
    </Box>
  );
}

export default function ComplianceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["compliance", id],
    queryFn: () => complianceApi.get(id!),
    enabled: !!id,
  });

  const renewMut = useMutation({
    mutationFn: () => complianceApi.renew(id!, {}),
    onSuccess: () => { toast.success("Work pass renewed"); qc.invalidateQueries({ queryKey: ["compliance", id] }); },
    onError: () => toast.error("Failed to renew"),
  });

  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}><CircularProgress /></Box>;
  if (error || !data) return <Alert severity="error">Record not found.</Alert>;

  const p = data?.data?.data ?? data?.data ?? {};
  const days = p.expiryDate ? daysUntil(p.expiryDate) : null;
  const isExpired = days !== null && days < 0;
  const isExpiringSoon = days !== null && days >= 0 && days <= 30;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBack sx={{ fontSize: 16 }} />} onClick={() => navigate("/compliance")} variant="text" size="small" sx={{ color: "#64748b" }}>Back</Button>
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: isExpired ? "#fee2e2" : "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isExpired || isExpiringSoon ? <Warning sx={{ fontSize: 20, color: isExpired ? "#b91c1c" : "#d97706" }} /> : <VerifiedUser sx={{ fontSize: 20, color: "#059669" }} />}
          </Box>
          <Box>
            <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>{p.employee?.fullName ?? "Work Pass"}</Typography>
            <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>{p.passType ?? ""}</Typography>
          </Box>
        </Box>
        <Chip label={p.status} color={getStatusChipColor(p.status)} />
        {(isExpired || isExpiringSoon) && (
          <Button variant="contained" size="small" onClick={() => renewMut.mutate()} disabled={renewMut.isPending} sx={{ borderRadius: "8px", backgroundColor: "#d97706" }}>
            Renew Pass
          </Button>
        )}
      </Box>

      {days !== null && (
        <Alert severity={isExpired ? "error" : isExpiringSoon ? "warning" : "success"} sx={{ mb: 2.5 }}>
          {isExpired ? `Expired ${Math.abs(days)} days ago` : isExpiringSoon ? `Expiring in ${days} days — action required` : `Valid for ${days} more days`}
        </Alert>
      )}

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Pass Details</Typography>
              <InfoField label="Pass Type" value={p.passType} />
              <InfoField label="Pass Number / FIN" value={p.passNumber} />
              <InfoField label="Issue Date" value={formatDate(p.issueDate)} />
              <InfoField label="Expiry Date" value={formatDate(p.expiryDate)} />
              <InfoField label="Status" value={p.status} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Employee</Typography>
              <InfoField label="Full Name" value={p.employee?.fullName} />
              <InfoField label="Employee ID" value={p.employee?.employeeId} />
              <InfoField label="Nationality" value={p.employee?.nationality} />
              <InfoField label="Job Title" value={p.employee?.jobTitle} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
