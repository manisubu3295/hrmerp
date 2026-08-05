import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Box, Typography, Card, CardContent, Divider, Button, CircularProgress,
  Alert, Chip, Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from "@mui/material";
import {
  CheckCircle, Cancel, BusinessCenter, AttachMoney,
  CalendarToday, TaskAlt,
} from "@mui/icons-material";
import { toast } from "sonner";
import { quotationsApi } from "@/lib/api";

function fmt(n: unknown) {
  return Number(n ?? 0).toLocaleString("en-SG", { style: "currency", currency: "SGD", minimumFractionDigits: 2 });
}

function statusChip(status: string) {
  const map: Record<string, { label: string; color: "success" | "warning" | "error" | "info" | "default" }> = {
    DRAFT: { label: "Draft", color: "default" },
    SENT: { label: "Sent", color: "info" },
    VIEWED: { label: "Viewed", color: "info" },
    APPROVED: { label: "Approved", color: "success" },
    REJECTED: { label: "Rejected", color: "error" },
    EXPIRED: { label: "Expired", color: "warning" },
  };
  const { label, color } = map[status] ?? { label: status, color: "default" as const };
  return <Chip label={label} color={color} size="small" sx={{ fontWeight: 700 }} />;
}

export default function QuotationPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["portal-quotation", token],
    queryFn: () => quotationsApi.getPortal(token!),
    enabled: !!token,
    retry: false,
  });

  const q: any = data?.data?.data;

  const approveMut = useMutation({
    mutationFn: () => quotationsApi.approvePortal(token!),
    onSuccess: () => { toast.success("Quotation approved!"); refetch(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to approve"),
  });

  const rejectMut = useMutation({
    mutationFn: () => quotationsApi.rejectPortal(token!, rejectReason || undefined),
    onSuccess: () => { toast.success("Quotation rejected"); setRejectOpen(false); refetch(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to reject"),
  });

  if (isLoading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !q) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", p: 2 }}>
        <Alert severity="error" sx={{ maxWidth: 480, borderRadius: "12px" }}>
          This quotation link is invalid or has expired. Please contact the company for a new link.
        </Alert>
      </Box>
    );
  }

  const isExpired = new Date(q.validUntil) < new Date();
  const canAct = q.status !== "APPROVED" && q.status !== "REJECTED" && !isExpired;

  return (
    <Box sx={{ minHeight: "100vh", background: "#f8fafc", py: 4, px: 2 }}>
      <Box sx={{ maxWidth: 800, mx: "auto" }}>
        {/* Company header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 40, height: 40, borderRadius: "10px",
                background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: "1rem" }}>A</Typography>
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: "#0f172a" }}>Aadhirai HRM OS</Typography>
          </Box>
          {statusChip(q.status)}
        </Box>

        <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none", borderRadius: "16px", mb: 3 }}>
          <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
            {/* Title block */}
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 3 }}>
              <Box sx={{ width: 48, height: 48, borderRadius: "12px", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <BusinessCenter sx={{ color: "#2563eb", fontSize: 24 }} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: "1.25rem", color: "#0f172a" }}>{q.title}</Typography>
                <Typography sx={{ color: "#64748b", fontSize: "0.875rem" }}>{q.quotationCode}</Typography>
              </Box>
            </Box>

            {q.description && (
              <Typography sx={{ color: "#334155", fontSize: "0.9rem", mb: 3, p: 2, background: "#f8fafc", borderRadius: "10px", borderLeft: "3px solid #2563eb" }}>
                {q.description}
              </Typography>
            )}

            {/* Meta row */}
            <Box sx={{ display: "flex", gap: 3, mb: 3, flexWrap: "wrap" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <CalendarToday sx={{ fontSize: 16, color: "#94a3b8" }} />
                <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>
                  Valid until: <strong>{new Date(q.validUntil).toLocaleDateString("en-SG")}</strong>
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <BusinessCenter sx={{ fontSize: 16, color: "#94a3b8" }} />
                <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>
                  Prepared for: <strong>{q.client?.name}</strong>
                </Typography>
              </Box>
            </Box>

            {isExpired && (
              <Alert severity="warning" sx={{ mb: 2, borderRadius: "10px" }}>
                This quotation has expired. Please contact us to request a new one.
              </Alert>
            )}
            {q.status === "APPROVED" && (
              <Alert severity="success" icon={<TaskAlt />} sx={{ mb: 2, borderRadius: "10px" }}>
                You have approved this quotation. Our team will be in touch shortly.
              </Alert>
            )}
            {q.status === "REJECTED" && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: "10px" }}>
                This quotation was rejected{q.rejectionReason ? `: "${q.rejectionReason}"` : ""}.
              </Alert>
            )}

            <Divider sx={{ mb: 3 }} />

            {/* Line items table */}
            <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0f172a", mb: 1.5 }}>
              Scope of Work
            </Typography>
            <Box sx={{ overflowX: "auto", mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 700, color: "#64748b", fontSize: "0.8125rem", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" } }}>
                    <TableCell>Description</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell>Unit</TableCell>
                    <TableCell align="right">Rate</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(q.lineItems ?? []).map((item: any) => (
                    <TableRow key={item.id} sx={{ "& td": { fontSize: "0.8125rem", color: "#334155", py: 1.25 } }}>
                      <TableCell sx={{ fontWeight: 500 }}>{item.description}</TableCell>
                      <TableCell sx={{ color: "#64748b" }}>{item.workerType ?? "—"}</TableCell>
                      <TableCell align="right">{Number(item.quantity).toFixed(0)}</TableCell>
                      <TableCell sx={{ color: "#64748b" }}>{item.unit}</TableCell>
                      <TableCell align="right">{fmt(item.unitRate)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>{fmt(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>

            {/* Totals */}
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Box sx={{ width: { xs: "100%", sm: 280 } }}>
                {[
                  ["Subtotal", q.subtotal],
                  ["Discount", `-${fmt(q.discountAmount)}`],
                  [`GST (${(Number(q.taxRate) * 100).toFixed(0)}%)`, q.taxAmount],
                ].map(([label, value]) => (
                  <Box key={String(label)} sx={{ display: "flex", justifyContent: "space-between", py: 0.75, borderBottom: "1px solid #f1f5f9" }}>
                    <Typography sx={{ fontSize: "0.875rem", color: "#64748b" }}>{label}</Typography>
                    <Typography sx={{ fontSize: "0.875rem", color: "#334155" }}>{typeof value === "string" && value.startsWith("-") ? value : fmt(value)}</Typography>
                  </Box>
                ))}
                <Box sx={{ display: "flex", justifyContent: "space-between", pt: 2, mt: 1, borderTop: "2px solid #0f172a" }}>
                  <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: "#0f172a", display: "flex", alignItems: "center", gap: 0.5 }}>
                    <AttachMoney sx={{ fontSize: 18 }} /> Total
                  </Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: "1.125rem", color: "#2563eb" }}>
                    {fmt(q.totalAmount)}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {q.notes && (
              <>
                <Divider sx={{ my: 3 }} />
                <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a", mb: 1 }}>Notes</Typography>
                <Typography sx={{ fontSize: "0.875rem", color: "#64748b", whiteSpace: "pre-line" }}>{q.notes}</Typography>
              </>
            )}
            {q.termsAndCond && (
              <>
                <Divider sx={{ my: 3 }} />
                <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a", mb: 1 }}>Terms & Conditions</Typography>
                <Typography sx={{ fontSize: "0.8125rem", color: "#94a3b8", whiteSpace: "pre-line" }}>{q.termsAndCond}</Typography>
              </>
            )}
          </CardContent>
        </Card>

        {/* Action buttons */}
        {canAct && (
          <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
            <Button
              variant="contained"
              size="large"
              startIcon={approveMut.isPending ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : <CheckCircle />}
              disabled={approveMut.isPending}
              onClick={() => approveMut.mutate()}
              sx={{
                borderRadius: "12px", textTransform: "none", fontWeight: 700,
                background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                px: 4, height: 48,
              }}
            >
              Approve Quotation
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<Cancel />}
              onClick={() => setRejectOpen(true)}
              sx={{
                borderRadius: "12px", textTransform: "none", fontWeight: 700,
                borderColor: "#dc2626", color: "#dc2626",
                "&:hover": { background: "#fef2f2", borderColor: "#dc2626" },
                px: 4, height: 48,
              }}
            >
              Reject
            </Button>
          </Box>
        )}

        <Typography sx={{ textAlign: "center", mt: 4, color: "#94a3b8", fontSize: "0.75rem" }}>
          Powered by Aadhirai HRM OS — Confidential quotation document
        </Typography>
      </Box>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Reject quotation</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: "#64748b", fontSize: "0.875rem", mb: 2 }}>
            Please let us know why you're rejecting this quotation (optional).
          </Typography>
          <TextField
            fullWidth multiline rows={3}
            placeholder="Reason for rejection…"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRejectOpen(false)} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => rejectMut.mutate()}
            disabled={rejectMut.isPending}
            sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700 }}
          >
            {rejectMut.isPending ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Confirm rejection"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
