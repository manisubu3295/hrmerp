import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, Alert, Typography,
  TextField, Table, TableHead, TableRow, TableCell, TableBody,
  Pagination, InputAdornment, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, IconButton, Menu, Divider, LinearProgress,
} from "@mui/material";
import { Add, Search, RequestQuote, MoreHoriz, Visibility, AutoAwesome } from "@mui/icons-material";
import { quotationsApi } from "@/lib/api";
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

function RowMenu({ quotationId }: { quotationId: string }) {
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
        <MenuItem onClick={() => { setAnchor(null); navigate(`/quotations/${quotationId}`); }}
          sx={{ fontSize: "0.875rem", gap: 1.5, py: 1 }}>
          <Visibility sx={{ fontSize: 16, color: "#64748b" }} /> View details
        </MenuItem>
      </Menu>
    </>
  );
}

export default function QuotationsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["quotations", page, search, status],
    queryFn: () => quotationsApi.getAll({ page, limit: 20, search, status }),
  });

  const quotations = Array.isArray(data?.data?.data?.data) ? data.data.data.data : [];
  const meta = data?.data?.data?.meta;
  const total = isLoading ? "—" : (meta?.total ?? quotations.length);
  const acceptedCount = quotations.filter((q: any) => q.status === "APPROVED").length;
  const draftCount = quotations.filter((q: any) => q.status === "DRAFT").length;
  const sentCount = quotations.filter((q: any) => q.status === "SENT").length;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 2 }}>
        <StatCard label="Total Quotations" value={total} icon={<RequestQuote sx={{ fontSize: 22 }} />} iconBg="#eff6ff" iconColor="#2563eb" />
        <StatCard label="Accepted" value={isLoading ? "—" : acceptedCount} icon={<RequestQuote sx={{ fontSize: 22 }} />} iconBg="#f0fdf4" iconColor="#059669" />
        <StatCard label="Sent" value={isLoading ? "—" : sentCount} icon={<RequestQuote sx={{ fontSize: 22 }} />} iconBg="#fffbeb" iconColor="#d97706" />
        <StatCard label="Draft" value={isLoading ? "—" : draftCount} icon={<RequestQuote sx={{ fontSize: 22 }} />} iconBg="#f8fafc" iconColor="#64748b" />
      </Box>

      <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
        <Box sx={{ px: 3, pt: 2.5, pb: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <RequestQuote sx={{ fontSize: 20, color: "#64748b" }} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0f172a" }}>Quotations</Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: "#94a3b8" }}>
                {isLoading ? "Loading…" : `${total} quotations`}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
            <Button variant="outlined" size="small" startIcon={<AutoAwesome sx={{ fontSize: 15 }} />}
              onClick={() => navigate("/quotations/templates")}
              sx={{ borderRadius: "8px", height: 36, fontWeight: 600, textTransform: "none", borderColor: "#e2e8f0", color: "#7c3aed" }}>
              Templates
            </Button>
            <Button variant="contained" size="small" startIcon={<Add />} onClick={() => navigate("/quotations/new")}
              sx={{ borderRadius: "8px", height: 36, fontWeight: 600, textTransform: "none", px: 2, boxShadow: "none" }}>
              New Quotation
            </Button>
          </Box>
        </Box>
        <Divider />

        <Box sx={{ px: 3, py: 2, display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          <TextField placeholder="Search quotations…" size="small" value={search}
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
              <MenuItem value="APPROVED">Approved</MenuItem>
              <MenuItem value="REJECTED">Rejected</MenuItem>
            </Select>
          </FormControl>
          {isLoading && <CircularProgress size={18} />}
        </Box>

        {error && <Alert severity="error" sx={{ mx: 3, mb: 2 }}>Failed to load quotations.</Alert>}

        <Box sx={{ borderTop: "1px solid #f1f5f9", overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                {["Quotation", "Client", "Amount", "Status", "Valid Until", "Created", ""].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", py: 1.25, width: h === "" ? 48 : "auto" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} sx={{ p: 0, borderBottom: 0 }}><LinearProgress /></TableCell></TableRow>
              )}
              {quotations.map((q: any) => (
                <TableRow key={q.id} hover
                  sx={{ cursor: "pointer", "&:hover": { backgroundColor: "#f8fafc" }, "&:last-child td": { borderBottom: 0 } }}
                  onClick={() => navigate(`/quotations/${q.id}`)}>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Box sx={{ width: 36, height: 36, borderRadius: "9px", backgroundColor: q.status === "APPROVED" ? "#f0fdf4" : "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <RequestQuote sx={{ fontSize: 17, color: q.status === "APPROVED" ? "#059669" : "#2563eb" }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: "0.875rem", color: "#0f172a" }}>{q.quotationCode}</Typography>
                        <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>{q.title ?? ""}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell><Typography sx={{ fontSize: "0.875rem", color: "#374151" }}>{q.client?.name ?? "—"}</Typography></TableCell>
                  <TableCell><Typography sx={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>{formatCurrency(q.totalAmount, q.currency ?? "SGD")}</Typography></TableCell>
                  <TableCell><Chip label={q.status} color={getStatusChipColor(q.status)} size="small" /></TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: "0.8125rem", color: q.validUntil && new Date(q.validUntil) < new Date() ? "#b91c1c" : "#374151" }}>
                      {formatDate(q.validUntil)}
                    </Typography>
                  </TableCell>
                  <TableCell><Typography sx={{ fontSize: "0.8125rem", color: "#374151" }}>{formatDate(q.createdAt)}</Typography></TableCell>
                  <TableCell onClick={e => e.stopPropagation()}><RowMenu quotationId={q.id} /></TableCell>
                </TableRow>
              ))}
              {!isLoading && quotations.length === 0 && (
                <TableRow><TableCell colSpan={7}>
                  <Box sx={{ textAlign: "center", py: 8 }}>
                    <RequestQuote sx={{ fontSize: 36, color: "#cbd5e1", mb: 1 }} />
                    <Typography sx={{ fontWeight: 700, color: "#374151" }}>No quotations found</Typography>
                    <Typography sx={{ color: "#94a3b8", fontSize: "0.875rem" }}>Create your first quotation to get started.</Typography>
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
