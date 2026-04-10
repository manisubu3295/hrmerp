import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, Alert, Typography,
  TextField, Table, TableHead, TableRow, TableCell, TableBody,
  Pagination, InputAdornment, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, IconButton, Menu, Divider, LinearProgress,
} from "@mui/material";
import { Add, Search, Receipt, MoreHoriz, Edit, Visibility } from "@mui/icons-material";
import { billingApi } from "@/lib/api";
import { formatDate, getStatusChipColor, formatCurrency } from "@/lib/utils";

function StatCard({ label, value, icon, iconBg, iconColor }: {
  label: string; value: string | number; icon: React.ReactNode; iconBg: string; iconColor: string;
}) {
  return (
    <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: iconColor }}>
            {icon}
          </Box>
          <Box>
            <Typography sx={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 500 }}>{label}</Typography>
            <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function RowMenu({ invoiceId }: { invoiceId: string }) {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  return (
    <>
      <IconButton size="small" onClick={e => { e.stopPropagation(); setAnchor(e.currentTarget); }}
        sx={{ color: "#94a3b8", "&:hover": { color: "#374151" } }}>
        <MoreHoriz sx={{ fontSize: 18 }} />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
        onClick={e => e.stopPropagation()}
        PaperProps={{ sx: { boxShadow: "0 4px 20px rgba(0,0,0,0.1)", borderRadius: "10px", border: "1px solid #e2e8f0", minWidth: 160 } }}>
        <MenuItem onClick={() => { setAnchor(null); navigate(`/billing/${invoiceId}`); }}
          sx={{ fontSize: "0.875rem", gap: 1.5, py: 1 }}>
          <Visibility sx={{ fontSize: 16, color: "#64748b" }} /> View details
        </MenuItem>
        <MenuItem onClick={() => { setAnchor(null); navigate(`/billing/${invoiceId}/edit`); }}
          sx={{ fontSize: "0.875rem", gap: 1.5, py: 1 }}>
          <Edit sx={{ fontSize: 16, color: "#64748b" }} /> Edit
        </MenuItem>
      </Menu>
    </>
  );
}

export default function BillingPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["billing", page, search, status],
    queryFn: () => billingApi.getAll({ page, limit: 20, search, status }),
  });

  const invoices = Array.isArray(data?.data?.data?.data) ? data.data.data.data : [];
  const meta = data?.data?.data?.meta;
  const total = isLoading ? "—" : (meta?.total ?? invoices.length);
  const paidCount = invoices.filter((i: any) => i.status === "PAID").length;
  const overdueCount = invoices.filter((i: any) => i.status === "OVERDUE" || (i.status !== "PAID" && i.dueDate && new Date(i.dueDate) < new Date())).length;
  const pendingCount = invoices.filter((i: any) => i.status === "SENT" || i.status === "DRAFT").length;

  const isOverdue = (inv: any) => inv.status === "OVERDUE" || (inv.status !== "PAID" && inv.dueDate && new Date(inv.dueDate) < new Date());

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 2 }}>
        <StatCard label="Total Invoices" value={total} icon={<Receipt sx={{ fontSize: 22 }} />} iconBg="#eff6ff" iconColor="#2563eb" />
        <StatCard label="Paid" value={isLoading ? "—" : paidCount} icon={<Receipt sx={{ fontSize: 22 }} />} iconBg="#f0fdf4" iconColor="#059669" />
        <StatCard label="Pending" value={isLoading ? "—" : pendingCount} icon={<Receipt sx={{ fontSize: 22 }} />} iconBg="#fffbeb" iconColor="#d97706" />
        <StatCard label="Overdue" value={isLoading ? "—" : overdueCount} icon={<Receipt sx={{ fontSize: 22 }} />} iconBg="#fef2f2" iconColor="#b91c1c" />
      </Box>

      <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
        <Box sx={{ px: 3, pt: 2.5, pb: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Receipt sx={{ fontSize: 20, color: "#64748b" }} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0f172a" }}>Billing & Invoices</Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: "#94a3b8" }}>
                {isLoading ? "Loading…" : `${total} invoices total`}
              </Typography>
            </Box>
          </Box>
          <Button variant="contained" size="small" startIcon={<Add />} onClick={() => navigate("/billing/new")}
            sx={{ borderRadius: "8px", height: 36, fontWeight: 600, textTransform: "none", px: 2, boxShadow: "none" }}>
            New Invoice
          </Button>
        </Box>
        <Divider />

        <Box sx={{ px: 3, py: 2, display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          <TextField placeholder="Search invoices…" size="small" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: "#94a3b8" }} /></InputAdornment> }}
            sx={{ minWidth: 260, "& .MuiOutlinedInput-root": { borderRadius: "8px" } }} />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select value={status} label="Status" onChange={e => { setStatus(e.target.value); setPage(1); }}
              sx={{ borderRadius: "8px" }}>
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="DRAFT">Draft</MenuItem>
              <MenuItem value="SENT">Sent</MenuItem>
              <MenuItem value="PAID">Paid</MenuItem>
              <MenuItem value="OVERDUE">Overdue</MenuItem>
              <MenuItem value="CANCELLED">Cancelled</MenuItem>
            </Select>
          </FormControl>
          {isLoading && <CircularProgress size={18} />}
        </Box>

        {error && <Alert severity="error" sx={{ mx: 3, mb: 2 }}>Failed to load invoices.</Alert>}

        <Box sx={{ borderTop: "1px solid #f1f5f9", overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                {["Invoice", "Client", "Amount", "Status", "Due Date", "Issued", ""].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", py: 1.25, width: h === "" ? 48 : "auto" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} sx={{ p: 0, borderBottom: 0 }}><LinearProgress /></TableCell></TableRow>
              )}
              {invoices.map((inv: any) => (
                <TableRow key={inv.id} hover
                  sx={{ cursor: "pointer", "&:hover": { backgroundColor: "#f8fafc" }, "&:last-child td": { borderBottom: 0 }, backgroundColor: isOverdue(inv) ? "rgba(185,28,28,0.02)" : "transparent" }}
                  onClick={() => navigate(`/billing/${inv.id}`)}>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Box sx={{ width: 36, height: 36, borderRadius: "9px", backgroundColor: isOverdue(inv) ? "#fee2e2" : "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Receipt sx={{ fontSize: 17, color: isOverdue(inv) ? "#b91c1c" : "#2563eb" }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: "0.875rem", color: "#0f172a" }}>{inv.invoiceNumber}</Typography>
                        <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>{inv.project?.name ?? ""}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell><Typography sx={{ fontSize: "0.875rem", color: "#374151" }}>{inv.client?.name ?? "—"}</Typography></TableCell>
                  <TableCell>
                    <Typography sx={{ fontWeight: 700, fontSize: "0.875rem", color: isOverdue(inv) ? "#b91c1c" : "#0f172a" }}>
                      {formatCurrency(inv.totalAmount, inv.currency ?? "SGD")}
                    </Typography>
                  </TableCell>
                  <TableCell><Chip label={inv.status} color={getStatusChipColor(inv.status)} size="small" /></TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: "0.8125rem", color: isOverdue(inv) ? "#b91c1c" : "#374151", fontWeight: isOverdue(inv) ? 700 : 400 }}>
                      {formatDate(inv.dueDate)}
                    </Typography>
                  </TableCell>
                  <TableCell><Typography sx={{ fontSize: "0.8125rem", color: "#374151" }}>{formatDate(inv.issueDate)}</Typography></TableCell>
                  <TableCell onClick={e => e.stopPropagation()}><RowMenu invoiceId={inv.id} /></TableCell>
                </TableRow>
              ))}
              {!isLoading && invoices.length === 0 && (
                <TableRow><TableCell colSpan={7}>
                  <Box sx={{ textAlign: "center", py: 8 }}>
                    <Receipt sx={{ fontSize: 36, color: "#cbd5e1", mb: 1 }} />
                    <Typography sx={{ fontWeight: 700, color: "#374151" }}>No invoices found</Typography>
                    <Typography sx={{ color: "#94a3b8", fontSize: "0.875rem" }}>Adjust filters or create a new invoice.</Typography>
                  </Box>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Box>

        {meta && meta.totalPages > 1 && (
          <><Divider /><Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <Pagination count={meta.totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" size="small" />
          </Box></>
        )}
      </Card>
    </Box>
  );
}
