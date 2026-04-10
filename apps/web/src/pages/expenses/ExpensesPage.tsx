import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, Alert, Typography,
  TextField, Table, TableHead, TableRow, TableCell, TableBody,
  Pagination, InputAdornment, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, IconButton, Menu, Divider, LinearProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Tooltip,
} from "@mui/material";
import { Add, Search, AccountBalanceWallet, MoreHoriz, Visibility, CheckCircle, Cancel } from "@mui/icons-material";
import { toast } from "sonner";
import { expensesApi } from "@/lib/api";
import { formatDate, getStatusChipColor, formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";

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

function RejectDialog({ open, onClose, onReject }: { open: boolean; onClose: () => void; onReject: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "14px" } }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: "1rem" }}>Reject Expense</DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2 }}>
        <TextField
          label="Rejection Reason (optional)"
          fullWidth multiline rows={3} size="small"
          value={reason} onChange={e => setReason(e.target.value)}
          placeholder="e.g. Receipt missing, amount too high…"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} variant="text" sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button onClick={() => { onReject(reason); setReason(""); }} variant="contained" color="error"
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>
          Reject
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RowMenu({ expenseId, status, onApprove, onReject }: {
  expenseId: string; status: string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
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
        <MenuItem onClick={() => { setAnchor(null); navigate(`/expenses/${expenseId}`); }}
          sx={{ fontSize: "0.875rem", gap: 1.5, py: 1 }}>
          <Visibility sx={{ fontSize: 16, color: "#64748b" }} /> View details
        </MenuItem>
        {status === "PENDING" && [
          <Divider key="div" />,
          <MenuItem key="approve" onClick={() => { setAnchor(null); onApprove(expenseId); }}
            sx={{ fontSize: "0.875rem", gap: 1.5, py: 1, color: "#059669" }}>
            <CheckCircle sx={{ fontSize: 16 }} /> Approve
          </MenuItem>,
          <MenuItem key="reject" onClick={() => { setAnchor(null); onReject(expenseId); }}
            sx={{ fontSize: "0.875rem", gap: 1.5, py: 1, color: "#ef4444" }}>
            <Cancel sx={{ fontSize: 16 }} /> Reject
          </MenuItem>,
        ]}
      </Menu>
    </>
  );
}

const categoryIcon: Record<string, string> = {
  TRANSPORT: "🚗", ACCOMMODATION: "🏨", MEALS: "🍽️", TOOLS: "🔧",
  UTILITIES: "💡", OFFICE: "🏢", OTHER: "📌",
};

export default function ExpensesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["expenses", page, search, status],
    queryFn: () => expensesApi.getAll({ page, limit: 20, search, status }),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => expensesApi.approve(id, { approvedById: user?.employee?.id }),
    onSuccess: () => { toast.success("Expense approved"); qc.invalidateQueries({ queryKey: ["expenses"] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to approve"),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      expensesApi.reject(id, { approvedById: user?.employee?.id, rejectionReason: reason }),
    onSuccess: () => { toast.success("Expense rejected"); qc.invalidateQueries({ queryKey: ["expenses"] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to reject"),
  });

  const expenses = Array.isArray(data?.data?.data?.data) ? data.data.data.data : [];
  const meta = data?.data?.data?.meta;
  const total = isLoading ? "—" : (meta?.total ?? expenses.length);
  const pendingCount = expenses.filter((e: any) => e.status === "PENDING").length;
  const approvedCount = expenses.filter((e: any) => e.status === "APPROVED").length;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 2 }}>
        <StatCard label="Total Expenses" value={total} icon={<AccountBalanceWallet sx={{ fontSize: 22 }} />} iconBg="#eff6ff" iconColor="#2563eb" />
        <StatCard label="Pending" value={isLoading ? "—" : pendingCount} icon={<AccountBalanceWallet sx={{ fontSize: 22 }} />} iconBg="#fffbeb" iconColor="#d97706" />
        <StatCard label="Approved" value={isLoading ? "—" : approvedCount} icon={<AccountBalanceWallet sx={{ fontSize: 22 }} />} iconBg="#f0fdf4" iconColor="#059669" />
      </Box>

      <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
        <Box sx={{ px: 3, pt: 2.5, pb: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <AccountBalanceWallet sx={{ fontSize: 20, color: "#64748b" }} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0f172a" }}>Expenses</Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: "#94a3b8" }}>
                {isLoading ? "Loading…" : `${total} expense records`}
              </Typography>
            </Box>
          </Box>
          <Button variant="contained" size="small" startIcon={<Add />} onClick={() => navigate("/expenses/new")}
            sx={{ borderRadius: "8px", height: 36, fontWeight: 600, textTransform: "none", px: 2, boxShadow: "none" }}>
            Log Expense
          </Button>
        </Box>
        <Divider />

        <Box sx={{ px: 3, py: 2, display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          <TextField placeholder="Search expenses…" size="small" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: "#94a3b8" }} /></InputAdornment> }}
            sx={{ minWidth: 260, "& .MuiOutlinedInput-root": { borderRadius: "8px" } }} />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select value={status} label="Status" onChange={e => { setStatus(e.target.value); setPage(1); }}
              sx={{ borderRadius: "8px" }}>
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="PENDING">Pending</MenuItem>
              <MenuItem value="APPROVED">Approved</MenuItem>
              <MenuItem value="REJECTED">Rejected</MenuItem>
            </Select>
          </FormControl>
          {isLoading && <CircularProgress size={18} />}
        </Box>

        {error && <Alert severity="error" sx={{ mx: 3, mb: 2 }}>Failed to load expenses.</Alert>}

        <Box sx={{ borderTop: "1px solid #f1f5f9", overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                {["Description", "Category", "Submitted By", "Amount", "Status", "Date", ""].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", py: 1.25, width: h === "" ? 48 : "auto" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} sx={{ p: 0, borderBottom: 0 }}><LinearProgress /></TableCell></TableRow>
              )}
              {expenses.map((exp: any) => (
                <TableRow key={exp.id} hover
                  sx={{ cursor: "pointer", "&:hover": { backgroundColor: "#f8fafc" }, "&:last-child td": { borderBottom: 0 } }}
                  onClick={() => navigate(`/expenses/${exp.id}`)}>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Box sx={{ width: 36, height: 36, borderRadius: "9px", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                        {categoryIcon[exp.category] ?? "📌"}
                      </Box>
                      <Typography sx={{ fontWeight: 600, fontSize: "0.875rem", color: "#0f172a", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {exp.description}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell><Typography sx={{ fontSize: "0.875rem", color: "#374151" }}>{exp.category ?? "—"}</Typography></TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: "0.875rem", color: "#374151" }}>
                      {exp.submittedBy ? `${exp.submittedBy.firstName} ${exp.submittedBy.lastName}` : exp.employee?.fullName ?? "—"}
                    </Typography>
                  </TableCell>
                  <TableCell><Typography sx={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>{formatCurrency(exp.amount, exp.currency ?? "SGD")}</Typography></TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Chip label={exp.status} color={getStatusChipColor(exp.status)} size="small" />
                      {exp.status === "PENDING" && (
                        <Box sx={{ display: "flex", gap: 0.5 }} onClick={e => e.stopPropagation()}>
                          <Tooltip title="Approve">
                            <IconButton size="small" onClick={() => approveMut.mutate(exp.id)}
                              disabled={approveMut.isPending}
                              sx={{ color: "#059669", "&:hover": { backgroundColor: "#f0fdf4" } }}>
                              <CheckCircle sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reject">
                            <IconButton size="small" onClick={() => setRejectTarget(exp.id)}
                              sx={{ color: "#ef4444", "&:hover": { backgroundColor: "#fef2f2" } }}>
                              <Cancel sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell><Typography sx={{ fontSize: "0.8125rem", color: "#374151" }}>{formatDate(exp.date ?? exp.createdAt)}</Typography></TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <RowMenu expenseId={exp.id} status={exp.status}
                      onApprove={id => approveMut.mutate(id)}
                      onReject={id => setRejectTarget(id)} />
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && expenses.length === 0 && (
                <TableRow><TableCell colSpan={7}>
                  <Box sx={{ textAlign: "center", py: 8 }}>
                    <AccountBalanceWallet sx={{ fontSize: 36, color: "#cbd5e1", mb: 1 }} />
                    <Typography sx={{ fontWeight: 700, color: "#374151" }}>No expenses found</Typography>
                    <Typography sx={{ color: "#94a3b8", fontSize: "0.875rem" }}>Log your first expense to get started.</Typography>
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

      <RejectDialog
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onReject={reason => { rejectMut.mutate({ id: rejectTarget!, reason }); setRejectTarget(null); }}
      />
    </Box>
  );
}
