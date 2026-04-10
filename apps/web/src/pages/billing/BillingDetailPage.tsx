import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, CircularProgress, Alert, Typography,
  Grid, Divider, Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
} from "@mui/material";
import { ArrowBack, Send, Cancel, Receipt } from "@mui/icons-material";
import { toast } from "sonner";
import { billingApi } from "@/lib/api";
import { formatDate, formatCurrency, getStatusChipColor } from "@/lib/utils";

function InfoField({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "#0f172a" }}>{value ?? "—"}</Typography>
    </Box>
  );
}

export default function BillingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => billingApi.getInvoice(id!),
    enabled: !!id,
  });

  const sendMut = useMutation({
    mutationFn: () => billingApi.sendInvoice(id!),
    onSuccess: () => { toast.success("Invoice sent"); qc.invalidateQueries({ queryKey: ["invoice", id] }); },
    onError: () => toast.error("Failed to send invoice"),
  });

  const cancelMut = useMutation({
    mutationFn: () => billingApi.cancelInvoice(id!),
    onSuccess: () => { toast.success("Invoice cancelled"); qc.invalidateQueries({ queryKey: ["invoice", id] }); },
    onError: () => toast.error("Failed to cancel invoice"),
  });

  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}><CircularProgress /></Box>;
  if (error || !data) return <Alert severity="error">Invoice not found.</Alert>;

  const inv = data?.data?.data ?? data?.data ?? {};
  const items = Array.isArray(inv.items) ? inv.items : [];

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBack sx={{ fontSize: 16 }} />} onClick={() => navigate("/billing")} variant="text" size="small" sx={{ color: "#64748b" }}>Back</Button>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Receipt sx={{ fontSize: 20, color: "#2563eb" }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>{inv.invoiceNumber}</Typography>
            <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>{inv.project?.name ?? ""}</Typography>
          </Box>
        </Box>
        <Chip label={inv.status} color={getStatusChipColor(inv.status)} />
        {inv.status === "DRAFT" && (
          <Button variant="contained" startIcon={<Send sx={{ fontSize: 15 }} />} size="small" onClick={() => sendMut.mutate()} disabled={sendMut.isPending} sx={{ borderRadius: "8px" }}>
            Send Invoice
          </Button>
        )}
        {!["CANCELLED", "PAID"].includes(inv.status) && (
          <Button variant="outlined" color="error" startIcon={<Cancel sx={{ fontSize: 15 }} />} size="small" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending} sx={{ borderRadius: "8px" }}>
            Cancel
          </Button>
        )}
      </Box>

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
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
                          <TableCell align="right" sx={{ fontSize: "0.8125rem" }}>{formatCurrency(item.unitPrice, inv.currency)}</TableCell>
                          <TableCell align="right" sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>{formatCurrency(item.totalPrice ?? item.quantity * item.unitPrice, inv.currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography sx={{ color: "#94a3b8", fontSize: "0.875rem" }}>No line items.</Typography>
              )}
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: "flex", justifyContent: "flex-end", flexDirection: "column", alignItems: "flex-end", gap: 0.5 }}>
                <Box sx={{ display: "flex", gap: 4 }}>
                  <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>Subtotal</Typography>
                  <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>{formatCurrency(inv.subtotal ?? inv.totalAmount, inv.currency)}</Typography>
                </Box>
                {inv.taxAmount != null && (
                  <Box sx={{ display: "flex", gap: 4 }}>
                    <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>Tax ({inv.taxRate ?? 0}%)</Typography>
                    <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>{formatCurrency(inv.taxAmount, inv.currency)}</Typography>
                  </Box>
                )}
                <Divider sx={{ width: "100%", my: 1 }} />
                <Box sx={{ display: "flex", gap: 4 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: "1rem" }}>Total</Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: "#0f172a" }}>{formatCurrency(inv.totalAmount, inv.currency)}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Details</Typography>
              <InfoField label="Client" value={inv.client?.name} />
              <InfoField label="Issue Date" value={formatDate(inv.issueDate)} />
              <InfoField label="Due Date" value={formatDate(inv.dueDate)} />
              <InfoField label="Currency" value={inv.currency ?? "SGD"} />
              {inv.notes && <InfoField label="Notes" value={inv.notes} />}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
