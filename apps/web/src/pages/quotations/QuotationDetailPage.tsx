import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, CircularProgress, Alert, Typography,
  Grid, Divider, Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
} from "@mui/material";
import { ArrowBack, Send, CheckCircle, TransformOutlined, RequestQuote } from "@mui/icons-material";
import { toast } from "sonner";
import { quotationsApi } from "@/lib/api";
import { formatDate, formatCurrency, getStatusChipColor } from "@/lib/utils";

function InfoField({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "#0f172a" }}>{value ?? "—"}</Typography>
    </Box>
  );
}

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["quotation", id],
    queryFn: () => quotationsApi.get(id!),
    enabled: !!id,
  });

  const statusMut = useMutation({
    mutationFn: ({ status, reason }: { status: string; reason?: string }) => quotationsApi.updateStatus(id!, status, reason),
    onSuccess: () => { toast.success("Status updated"); qc.invalidateQueries({ queryKey: ["quotation", id] }); },
    onError: () => toast.error("Failed to update status"),
  });

  const convertMut = useMutation({
    mutationFn: () => quotationsApi.convertToProject(id!),
    onSuccess: (res: any) => { toast.success("Converted to project"); navigate(`/projects/${res.data?.data?.id ?? res.data?.id}`); },
    onError: () => toast.error("Failed to convert to project"),
  });

  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}><CircularProgress /></Box>;
  if (error || !data) return <Alert severity="error">Quotation not found.</Alert>;

  const q = data?.data?.data ?? data?.data ?? {};
  const items = Array.isArray(q.lineItems) ? q.lineItems : [];

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBack sx={{ fontSize: 16 }} />} onClick={() => navigate("/quotations")} variant="text" size="small" sx={{ color: "#64748b" }}>Back</Button>
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RequestQuote sx={{ fontSize: 20, color: "#2563eb" }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>{q.quotationCode}</Typography>
            <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>{q.title ?? ""}</Typography>
          </Box>
        </Box>
        <Chip label={q.status} color={getStatusChipColor(q.status)} />
        {q.status === "DRAFT" && (
          <Button variant="outlined" size="small" startIcon={<Send sx={{ fontSize: 15 }} />} onClick={() => statusMut.mutate({ status: "SENT" })} disabled={statusMut.isPending} sx={{ borderRadius: "8px" }}>Send</Button>
        )}
        {q.status === "SENT" && (
          <>
            <Button variant="contained" size="small" startIcon={<CheckCircle sx={{ fontSize: 15 }} />} onClick={() => statusMut.mutate({ status: "APPROVED" })} sx={{ borderRadius: "8px", backgroundColor: "#059669" }}>Accept</Button>
            <Button variant="outlined" color="error" size="small" onClick={() => statusMut.mutate({ status: "REJECTED" })} sx={{ borderRadius: "8px" }}>Reject</Button>
          </>
        )}
        {q.status === "APPROVED" && (
          <Button variant="contained" size="small" startIcon={<TransformOutlined sx={{ fontSize: 15 }} />} onClick={() => convertMut.mutate()} disabled={convertMut.isPending} sx={{ borderRadius: "8px" }}>Convert to Project</Button>
        )}
      </Box>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Line Items</Typography>
              {items.length > 0 ? (
                <TableContainer sx={{ border: "none" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Description</TableCell>
                        <TableCell align="right">Qty</TableCell>
                        <TableCell align="right">Unit Price</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {items.map((item: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell sx={{ fontSize: "0.8125rem" }}>{item.description}</TableCell>
                          <TableCell align="right" sx={{ fontSize: "0.8125rem" }}>{item.quantity}</TableCell>
                          <TableCell align="right" sx={{ fontSize: "0.8125rem" }}>{formatCurrency(item.unitRate, q.currency)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.8125rem" }}>{formatCurrency(item.amount, q.currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography sx={{ color: "#94a3b8", fontSize: "0.875rem" }}>No line items.</Typography>
              )}
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.5 }}>
                <Box sx={{ display: "flex", gap: 4 }}>
                  <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>Subtotal</Typography>
                  <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>{formatCurrency(q.subtotal ?? q.totalAmount, q.currency)}</Typography>
                </Box>
                <Divider sx={{ width: "100%", my: 1 }} />
                <Box sx={{ display: "flex", gap: 4 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: "1rem" }}>Total</Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: "#0f172a" }}>{formatCurrency(q.totalAmount, q.currency)}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Details</Typography>
              <InfoField label="Client" value={q.client?.name} />
              <InfoField label="Created" value={formatDate(q.createdAt)} />
              <InfoField label="Valid Until" value={formatDate(q.validUntil)} />
              <InfoField label="Currency" value={q.currency ?? "SGD"} />
              {q.notes && <InfoField label="Notes" value={q.notes} />}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
