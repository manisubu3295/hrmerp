import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, CircularProgress, Alert, Typography,
  Grid, Divider, Tabs, Tab, Avatar,
} from "@mui/material";
import { ArrowBack, Edit, People } from "@mui/icons-material";
import { employeesApi } from "@/lib/api";
import { formatDate, getStatusChipColor } from "@/lib/utils";

function InfoField({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "#0f172a" }}>{value ?? "—"}</Typography>
    </Box>
  );
}

function avatarColor(name: string) {
  const colors = ["#2563eb", "#7c3aed", "#059669", "#dc2626", "#d97706", "#0891b2"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => employeesApi.get(id!),
    enabled: !!id,
  });

  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}><CircularProgress /></Box>;
  if (error || !data) return <Alert severity="error">Employee not found.</Alert>;

  const e = data?.data?.data ?? data?.data ?? {};
  const initials = (e.fullName ?? "?").split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBack sx={{ fontSize: 16 }} />} onClick={() => navigate("/employees")} variant="text" size="small" sx={{ color: "#64748b" }}>Back</Button>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar sx={{ width: 44, height: 44, fontSize: "1rem", fontWeight: 700, backgroundColor: avatarColor(e.fullName ?? ""), borderRadius: "11px" }}>{initials}</Avatar>
            <Box>
              <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>{e.fullName}</Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>{e.jobTitle ?? ""} {e.department ? `· ${e.department}` : ""}</Typography>
            </Box>
          </Box>
        </Box>
        <Chip label={e.status} color={getStatusChipColor(e.status)} />
        <Button variant="outlined" startIcon={<Edit sx={{ fontSize: 15 }} />} size="small" onClick={() => navigate(`/employees/${id}/edit`)} sx={{ borderRadius: "8px" }}>Edit</Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2.5, borderBottom: "1px solid #e2e8f0", "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: "0.875rem" } }}>
        <Tab label="Personal Info" />
        <Tab label="Employment" />
        <Tab label="Work Pass" />
      </Tabs>

      {tab === 0 && (
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Identity</Typography>
                <InfoField label="Full Name" value={e.fullName} />
                <InfoField label="Employee ID" value={e.employeeId} />
                <InfoField label="Nationality" value={e.nationality} />
                <InfoField label="Date of Birth" value={formatDate(e.dateOfBirth)} />
                <InfoField label="Gender" value={e.gender} />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Contact</Typography>
                <InfoField label="Email" value={e.email} />
                <InfoField label="Phone" value={e.phone} />
                <InfoField label="Emergency Contact" value={e.emergencyContact} />
                <InfoField label="Address" value={e.address} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tab === 1 && (
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Job Details</Typography>
                <InfoField label="Job Title" value={e.jobTitle} />
                <InfoField label="Department" value={e.department} />
                <InfoField label="Employment Type" value={e.employmentType} />
                <InfoField label="Join Date" value={formatDate(e.joinDate)} />
                <InfoField label="Reporting To" value={e.manager?.fullName} />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Compensation</Typography>
                <InfoField label="Basic Salary" value={e.basicSalary != null ? `SGD ${e.basicSalary.toLocaleString()}` : undefined} />
                <InfoField label="Bank Account" value={e.bankAccount} />
                <InfoField label="CPF Account" value={e.cpfAccount} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tab === 2 && (
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Work Pass</Typography>
                <InfoField label="Pass Type" value={e.workPassType} />
                <InfoField label="Pass Number" value={e.workPassNumber} />
                <InfoField label="Issue Date" value={formatDate(e.workPassIssueDate)} />
                <InfoField label="Expiry Date" value={formatDate(e.workPassExpiry)} />
                <InfoField label="Status" value={e.workPassStatus} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
