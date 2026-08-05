import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, CircularProgress, Alert, Typography,
  Grid, Divider, Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl,
  InputLabel, Select, MenuItem,
} from "@mui/material";
import { ArrowBack, Send, Cancel, Receipt, PictureAsPdf, Payments } from "@mui/icons-material";
import { toast } from "sonner";
import { billingApi } from "@/lib/api";
import { formatDate, formatCurrency, getStatusChipColor } from "@/lib/utils";

const PAYMENT_METHODS = ["BANK_TRANSFER", "CHEQUE", "CASH", "PAYNOW", "CREDIT_CARD"];

function RecordPaymentDialog({ open, onClose, onConfirm, maxAmount, currency, isPending }: {
  open: boolean; onClose: () => void;
  onConfirm: (data: { amount: number; paymentDate: string; paymentMethod: string; reference?: string; notes?: string }) => void;
  maxAmount: number; currency?: string; isPending: boolean;
}) {
  const [amount, setAmount] = useState(String(maxAmount));
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "14px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Record Payment</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
        <TextField
          label={`Amount (${currency ?? "SGD"})`} type="number" size="small" fullWidth
          value={amount} onChange={e => setAmount(e.target.value)}
          inputProps={{ step: "0.01", min: 0, max: maxAmount }}
          helperText={`Outstanding: ${formatCurrency(maxAmount, currency)}`}
        />
        <TextField
          label="Payment Date" type="date" size="small" fullWidth
          value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <FormControl fullWidth size="small">
          <InputLabel>Payment Method</InputLabel>
          <Select value={paymentMethod} label="Payment Method" onChange={e => setPaymentMethod(e.target.value)}>
            {PAYMENT_METHODS.map(m => <MenuItem key={m} value={m}>{m.replace(/_/g, " ")}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField label="Reference (optional)" size="small" fullWidth value={reference} onChange={e => setReference(e.target.value)} />
        <TextField label="Notes (optional)" size="small" fullWidth multiline rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} variant="text" sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button
          variant="contained" disabled={isPending || !amount || Number(amount) <= 0}
          onClick={() => onConfirm({ amount: Number(amount), paymentDate, paymentMethod, reference: reference || undefined, notes: notes || undefined })}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}
        >
          {isPending ? <CircularProgress size={18} color="inherit" /> : "Record Payment"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

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
  const [paymentOpen, setPaymentOpen] = useState(false);

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

  const paymentMut = useMutation({
    mutationFn: (data: unknown) => billingApi.recordPayment(id!, data),
    onSuccess: () => {
      toast.success("Payment recorded");
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setPaymentOpen(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to record payment"),
  });

  const handleDownloadPdf = async () => {
    try {
      const res = await billingApi.downloadPdf(id!);
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${inv.invoiceCode ?? "invoice"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download PDF");
    }
  };

  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}><CircularProgress /></Box>;
  if (error || !data) return <Alert severity="error">Invoice not found.</Alert>;

  const inv = data?.data?.data ?? data?.data ?? {};
  const items = Array.isArray(inv.lineItems) ? inv.lineItems : [];

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBack sx={{ fontSize: 16 }} />} onClick={() => navigate("/billing")} variant="text" size="small" sx={{ color: "#64748b" }}>Back</Button>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Receipt sx={{ fontSize: 20, color: "#2563eb" }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>{inv.invoiceCode}</Typography>
            <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>{inv.project?.name ?? ""}</Typography>
          </Box>
        </Box>
        <Chip label={inv.status} color={getStatusChipColor(inv.status)} />
        <Button variant="outlined" size="small" startIcon={<PictureAsPdf sx={{ fontSize: 15 }} />} onClick={handleDownloadPdf} sx={{ borderRadius: "8px" }}>Download PDF</Button>
        {inv.status === "DRAFT" && (
          <Button variant="contained" startIcon={<Send sx={{ fontSize: 15 }} />} size="small" onClick={() => sendMut.mutate()} disabled={sendMut.isPending} sx={{ borderRadius: "8px" }}>
            Send Invoice
          </Button>
        )}
        {!["CANCELLED", "PAID"].includes(inv.status) && (
          <Button variant="contained" startIcon={<Payments sx={{ fontSize: 15 }} />} size="small" onClick={() => setPaymentOpen(true)} sx={{ borderRadius: "8px" }}>
            Record Payment
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
                          <TableCell align="right" sx={{ fontSize: "0.8125rem" }}>{formatCurrency(item.unitRate, inv.currency)}</TableCell>
                          <TableCell align="right" sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>{formatCurrency(item.amount, inv.currency)}</TableCell>
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
                    <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>GST ({(Number(inv.taxRate ?? 0.09) * 100).toFixed(0)}%)</Typography>
                    <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>{formatCurrency(inv.taxAmount, inv.currency)}</Typography>
                  </Box>
                )}
                <Divider sx={{ width: "100%", my: 1 }} />
                <Box sx={{ display: "flex", gap: 4 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: "1rem" }}>Total</Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: "#0f172a" }}>{formatCurrency(inv.totalAmount, inv.currency)}</Typography>
                </Box>
                <Box sx={{ display: "flex", gap: 4 }}>
                  <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>Paid</Typography>
                  <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "#059669" }}>{formatCurrency(inv.paidAmount ?? 0, inv.currency)}</Typography>
                </Box>
                <Box sx={{ display: "flex", gap: 4 }}>
                  <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>Outstanding</Typography>
                  <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: Number(inv.outstandingAmount ?? 0) > 0 ? "#dc2626" : "#059669" }}>
                    {formatCurrency(inv.outstandingAmount ?? 0, inv.currency)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ mt: 2.5 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Payment History</Typography>
              {Array.isArray(inv.payments) && inv.payments.length > 0 ? (
                <TableContainer sx={{ border: "none" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Method</TableCell>
                        <TableCell>Reference</TableCell>
                        <TableCell align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {inv.payments.map((pmt: any) => (
                        <TableRow key={pmt.id}>
                          <TableCell sx={{ fontSize: "0.8125rem" }}>{formatDate(pmt.paymentDate)}</TableCell>
                          <TableCell sx={{ fontSize: "0.8125rem" }}>{pmt.paymentMethod?.replace(/_/g, " ") ?? "—"}</TableCell>
                          <TableCell sx={{ fontSize: "0.8125rem" }}>{pmt.reference ?? "—"}</TableCell>
                          <TableCell align="right" sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>{formatCurrency(pmt.amount, inv.currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography sx={{ color: "#94a3b8", fontSize: "0.875rem" }}>No payments recorded yet.</Typography>
              )}
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

      <RecordPaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onConfirm={(data) => paymentMut.mutate(data)}
        maxAmount={Number(inv.outstandingAmount ?? 0)}
        currency={inv.currency}
        isPending={paymentMut.isPending}
      />
    </Box>
  );
}
