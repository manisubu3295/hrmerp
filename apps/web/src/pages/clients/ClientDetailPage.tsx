import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Box, Button, Card, CardContent, Chip, CircularProgress, Alert, Typography,
  Grid, Divider, Tabs, Tab, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Avatar,
} from "@mui/material";
import { ArrowBack, Edit, Business } from "@mui/icons-material";
import { clientsApi } from "@/lib/api";
import { formatDate, formatCurrency, getStatusChipColor } from "@/lib/utils";

function InfoField({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2 }}>
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

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ["client", id],
    queryFn: () => clientsApi.get(id!),
    enabled: !!id,
  });

  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}><CircularProgress /></Box>;
  if (error || !data) return <Alert severity="error">Client not found.</Alert>;

  const c = data?.data?.data ?? data?.data ?? {};
  const projects = Array.isArray(c.projects) ? c.projects : [];
  const invoices = Array.isArray(c.invoices) ? c.invoices : [];

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBack sx={{ fontSize: 16 }} />} onClick={() => navigate("/clients")} variant="text" size="small" sx={{ color: "#64748b" }}>Back</Button>
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar sx={{ width: 44, height: 44, fontSize: "1.125rem", fontWeight: 700, backgroundColor: avatarColor(c.name ?? ""), borderRadius: "11px" }}>
            {(c.name ?? "?")[0]}
          </Avatar>
          <Box>
            <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>{c.name}</Typography>
            <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>{c.code ?? ""}</Typography>
          </Box>
        </Box>
        <Button variant="outlined" startIcon={<Edit sx={{ fontSize: 15 }} />} size="small" onClick={() => navigate(`/clients/${id}/edit`)} sx={{ borderRadius: "8px" }}>Edit</Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2.5, borderBottom: "1px solid #e2e8f0", "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: "0.875rem" } }}>
        <Tab label="Overview" />
        <Tab label={`Projects (${projects.length})`} />
        <Tab label={`Invoices (${invoices.length})`} />
      </Tabs>

      {tab === 0 && (
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Company Info</Typography>
                <InfoField label="Company Name" value={c.name} />
                <InfoField label="UEN" value={c.uen} />
                <InfoField label="Address" value={c.address} />
                <InfoField label="GST Registered" value={c.gstRegistered ? "Yes" : "No"} />
                <InfoField label="Credit Terms" value={c.creditTermDays != null ? `${c.creditTermDays} days` : undefined} />
                <InfoField label="Client Since" value={formatDate(c.createdAt)} />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Contact</Typography>
                <InfoField label="Contact Person" value={c.contactName} />
                <InfoField label="Email" value={c.contactEmail} />
                <InfoField label="Phone" value={c.contactPhone} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tab === 1 && (
        <TableContainer>
          <Table>
            <TableHead><TableRow><TableCell>Project</TableCell><TableCell>Status</TableCell><TableCell>End Date</TableCell></TableRow></TableHead>
            <TableBody>
              {projects.map((p: any) => (
                <TableRow key={p.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate(`/projects/${p.id}`)}>
                  <TableCell><Typography sx={{ fontWeight: 600, fontSize: "0.875rem" }}>{p.name}</Typography><Typography sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>{p.projectCode}</Typography></TableCell>
                  <TableCell><Chip label={p.status} color={getStatusChipColor(p.status)} size="small" /></TableCell>
                  <TableCell><Typography sx={{ fontSize: "0.8125rem" }}>{formatDate(p.endDate)}</Typography></TableCell>
                </TableRow>
              ))}
              {projects.length === 0 && <TableRow><TableCell colSpan={3}><Typography sx={{ color: "#94a3b8", py: 4, textAlign: "center" }}>No projects yet.</Typography></TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 2 && (
        <TableContainer>
          <Table>
            <TableHead><TableRow><TableCell>Invoice No.</TableCell><TableCell>Amount</TableCell><TableCell>Status</TableCell><TableCell>Due Date</TableCell></TableRow></TableHead>
            <TableBody>
              {invoices.map((inv: any) => (
                <TableRow key={inv.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate(`/billing/${inv.id}`)}>
                  <TableCell><Typography sx={{ fontWeight: 600, fontSize: "0.875rem" }}>{inv.invoiceCode}</Typography></TableCell>
                  <TableCell><Typography sx={{ fontWeight: 700, fontSize: "0.875rem" }}>{formatCurrency(inv.totalAmount, inv.currency)}</Typography></TableCell>
                  <TableCell><Chip label={inv.status} color={getStatusChipColor(inv.status)} size="small" /></TableCell>
                  <TableCell><Typography sx={{ fontSize: "0.8125rem" }}>{formatDate(inv.dueDate)}</Typography></TableCell>
                </TableRow>
              ))}
              {invoices.length === 0 && <TableRow><TableCell colSpan={4}><Typography sx={{ color: "#94a3b8", py: 4, textAlign: "center" }}>No invoices yet.</Typography></TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
