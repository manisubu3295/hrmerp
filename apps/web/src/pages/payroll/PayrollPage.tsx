import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Card, CardContent, Button, Chip, CircularProgress,
  Alert, Table, TableHead, TableRow, TableCell, TableBody, Divider,
  FormControl, InputLabel, Select, MenuItem, Grid, Tooltip,
} from "@mui/material";
import { PlayArrow, CheckCircle, AccountBalance, PaidOutlined } from "@mui/icons-material";
import { toast } from "sonner";
import { payrollApi, projectsApi } from "@/lib/api";

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 4 }, (_, i) => currentYear - 1 + i);

function fmt(n: unknown) {
  return Number(n ?? 0).toLocaleString("en-SG", { style: "currency", currency: "SGD", minimumFractionDigits: 2 });
}

export default function PayrollPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [projectId, setProjectId] = useState("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [runResult, setRunResult] = useState<any[] | null>(null);

  const { data: projData } = useQuery({
    queryKey: ["projects-payroll"],
    queryFn: () => projectsApi.getAll({ limit: 200, status: "ACTIVE" }),
  });
  const projects: any[] = Array.isArray(projData?.data?.data?.data) ? projData.data.data.data : [];

  const { data: listData, isLoading: listLoading, refetch: refetchList } = useQuery({
    queryKey: ["payroll-list", projectId, month, year],
    queryFn: () =>
      payrollApi.list({ ...(projectId && { projectId }), month, year }),
    enabled: true,
  });
  const records: any[] = Array.isArray(listData?.data?.data) ? listData.data.data : [];

  const runMut = useMutation({
    mutationFn: () =>
      payrollApi.run({ projectId: projectId || undefined, month, year } as any),
    onSuccess: (res) => {
      const data = res?.data?.data;
      const records = Array.isArray(data?.records) ? data.records : null;
      toast.success(`Payroll processed — ${records ? records.length : data?.recordCount ?? "—"} records`);
      setRunResult(records);
      qc.invalidateQueries({ queryKey: ["payroll-list"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to run payroll"),
  });

  const markPaidMut = useMutation({
    mutationFn: (id: string) => payrollApi.markPaid(id),
    onSuccess: () => {
      toast.success("Marked as paid");
      qc.invalidateQueries({ queryKey: ["payroll-list"] });
      refetchList();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to update"),
  });

  const { data: runsData, isLoading: runsLoading } = useQuery({
    queryKey: ["payroll-runs", year],
    queryFn: () => payrollApi.getRuns({ year }),
  });
  const runs: any[] = Array.isArray(runsData?.data?.data) ? runsData.data.data : [];

  const markRunPaidMut = useMutation({
    mutationFn: (id: string) => payrollApi.markRunPaid(id),
    onSuccess: () => { toast.success("Payroll run marked as paid"); qc.invalidateQueries({ queryKey: ["payroll-runs"] }); qc.invalidateQueries({ queryKey: ["payroll-list"] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to mark run as paid"),
  });

  const displayRecords = records.length > 0 ? records : (runResult ?? []);

  // Totals
  const totalNetPayable = displayRecords.reduce((s, r) => s + Number(r.totalPayable ?? 0), 0);
  const totalCpfEr = displayRecords.reduce((s, r) => s + Number(r.cpfEmployer ?? 0), 0);
  const totalCostToCompany = displayRecords.reduce((s, r) => s + Number(r.totalCostToCompany ?? 0), 0);

  return (
    <Box>
      {/* Page header */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: "#0f172a", letterSpacing: "-0.02em" }}>
            Payroll
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748b", mt: 0.25 }}>
            Calculate and manage payroll with CPF contributions
          </Typography>
        </Box>
      </Box>

      {/* Controls card */}
      <Card elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: "14px", mb: 3 }}>
        <CardContent sx={{ px: 3, py: 2.5 }}>
          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={12} sm={4} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Project (optional)</InputLabel>
                <Select
                  value={projectId}
                  label="Project (optional)"
                  onChange={(e) => setProjectId(e.target.value)}
                  sx={{ borderRadius: "10px" }}
                >
                  <MenuItem value="">All projects</MenuItem>
                  {projects.map((p: any) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.projectCode} — {p.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6} sm={3} md={2.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Month</InputLabel>
                <Select value={month} label="Month" onChange={(e) => setMonth(Number(e.target.value))} sx={{ borderRadius: "10px" }}>
                  {monthNames.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6} sm={2} md={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Year</InputLabel>
                <Select value={year} label="Year" onChange={(e) => setYear(Number(e.target.value))} sx={{ borderRadius: "10px" }}>
                  {years.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm="auto">
              <Button
                variant="contained"
                startIcon={runMut.isPending
                  ? <CircularProgress size={16} sx={{ color: "#fff" }} />
                  : <PlayArrow />
                }
                disabled={runMut.isPending}
                onClick={() => runMut.mutate()}
                sx={{
                  height: 40, px: 3, borderRadius: "10px", textTransform: "none",
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
                  "&:hover": { background: "linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)" },
                }}
              >
                Run Payroll
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results */}
      {listLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : displayRecords.length === 0 ? (
        <Card elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: "14px" }}>
          <Box sx={{
            py: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5,
          }}>
            <Box sx={{ width: 56, height: 56, borderRadius: "14px", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AccountBalance sx={{ fontSize: 28, color: "#94a3b8" }} />
            </Box>
            <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>No payroll records</Typography>
            <Typography sx={{ color: "#94a3b8", fontSize: "0.875rem" }}>
              Select filters and click "Run Payroll" to calculate payroll for the period.
            </Typography>
          </Box>
        </Card>
      ) : (
        <Card elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: "14px" }}>
          <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
            <AccountBalance sx={{ fontSize: 20, color: "#64748b" }} />
            <Box>
              <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                Payroll — {monthNames[month - 1]} {year}
              </Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: "#94a3b8" }}>
                {displayRecords.length} employee{displayRecords.length !== 1 ? "s" : ""}
              </Typography>
            </Box>
          </Box>
          <Divider />
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{
                  "& th": {
                    fontWeight: 700, fontSize: "0.8125rem", color: "#64748b",
                    background: "#f8fafc", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap",
                  }
                }}>
                  <TableCell>Employee</TableCell>
                  <TableCell align="right">Days</TableCell>
                  <TableCell align="right">Paid Lv</TableCell>
                  <TableCell align="right">Unpaid Lv</TableCell>
                  <TableCell align="right">Leave Deduct.</TableCell>
                  <TableCell align="right">Basic Pay</TableCell>
                  <TableCell align="right">OT Pay</TableCell>
                  <TableCell align="right">Allowances</TableCell>
                  <TableCell align="right">Gross</TableCell>
                  <TableCell align="right">CPF (EE)</TableCell>
                  <TableCell align="right">CPF (ER)</TableCell>
                  <TableCell align="right">Net Payable</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {displayRecords.map((r: any) => (
                  <TableRow
                    key={r.id}
                    sx={{ "&:hover": { background: "#f8fafc" }, "& td": { fontSize: "0.8125rem", color: "#334155", py: 1.25 } }}
                  >
                    <TableCell>
                      <Typography sx={{ fontWeight: 600, fontSize: "0.8125rem", color: "#0f172a" }}>
                        {r.employee?.firstName} {r.employee?.lastName}
                      </Typography>
                      <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                        {r.employee?.employeeCode ?? r.employee?.id?.slice(0, 8)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{r.daysWorked ?? "—"}</TableCell>
                    <TableCell align="right">{Number(r.paidLeaveDays ?? 0) || "—"}</TableCell>
                    <TableCell align="right">{Number(r.unpaidLeaveDays ?? 0) || "—"}</TableCell>
                    <TableCell align="right" sx={{ color: Number(r.leaveDeduction ?? 0) > 0 ? "#dc2626" : undefined }}>
                      {Number(r.leaveDeduction ?? 0) > 0 ? fmt(r.leaveDeduction) : "—"}
                    </TableCell>
                    <TableCell align="right">{fmt(r.basicPay)}</TableCell>
                    <TableCell align="right">{fmt(r.overtimePay)}</TableCell>
                    <TableCell align="right">{fmt(r.allowances)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{fmt(r.grossPay ?? (Number(r.basicPay ?? 0) + Number(r.overtimePay ?? 0) + Number(r.allowances ?? 0)))}</TableCell>
                    <TableCell align="right" sx={{ color: "#dc2626" }}>{fmt(r.cpfEmployee)}</TableCell>
                    <TableCell align="right" sx={{ color: "#d97706" }}>{fmt(r.cpfEmployer)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: "#16a34a" }}>{fmt(r.totalPayable)}</TableCell>
                    <TableCell>
                      {r.status === "PAID" ? (
                        <Chip icon={<CheckCircle />} label="Paid" color="success" size="small" sx={{ fontWeight: 700 }} />
                      ) : (
                        <Chip label="Unpaid" color="warning" size="small" variant="outlined" sx={{ fontWeight: 700 }} />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {r.status !== "PAID" && (
                        <Tooltip title="Mark as paid">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={markPaidMut.isPending ? <CircularProgress size={12} /> : <PaidOutlined />}
                            disabled={markPaidMut.isPending}
                            onClick={() => markPaidMut.mutate(r.id)}
                            sx={{
                              borderRadius: "8px", textTransform: "none", fontSize: "0.75rem",
                              fontWeight: 600, borderColor: "#22c55e", color: "#16a34a",
                              "&:hover": { background: "#f0fdf4", borderColor: "#16a34a" },
                            }}
                          >
                            Mark Paid
                          </Button>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}

                {/* Totals row */}
                <TableRow sx={{ background: "#f8fafc", "& td": { fontWeight: 700, fontSize: "0.8125rem", borderTop: "2px solid #e2e8f0" } }}>
                  <TableCell colSpan={11} sx={{ color: "#0f172a" }}>Totals</TableCell>
                  <TableCell align="right" sx={{ color: "#16a34a", fontSize: "0.9rem !important" }}>{fmt(totalNetPayable)}</TableCell>
                  <TableCell colSpan={2} sx={{ color: "#64748b", fontSize: "0.75rem !important", fontWeight: 400 }}>
                    Cost to company: <strong style={{ color: "#0f172a" }}>{fmt(totalCostToCompany)}</strong>
                    <span style={{ marginLeft: 6, color: "#94a3b8" }}>(incl. CPF ER {fmt(totalCpfEr)})</span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Box>
        </Card>
      )}

      {/* Payroll Runs */}
      <Card elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: "14px", mt: 3 }}>
        <Box sx={{ px: 3, py: 2 }}>
          <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>Payroll Runs — {year}</Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "#94a3b8" }}>Batches generated by "Run Payroll", groupable for bulk pay-out</Typography>
        </Box>
        <Divider />
        {runsLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={24} /></Box>
        ) : runs.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center" }}><Typography sx={{ color: "#94a3b8", fontSize: "0.875rem" }}>No payroll runs yet</Typography></Box>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.75rem", color: "#64748b", background: "#f8fafc", textTransform: "uppercase" } }}>
                  <TableCell>Run Code</TableCell><TableCell>Period</TableCell><TableCell>Project</TableCell>
                  <TableCell align="right">Records</TableCell><TableCell align="right">Total Payable</TableCell>
                  <TableCell align="right">Cost to Company</TableCell><TableCell>Status</TableCell><TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {runs.map((r: any) => (
                  <TableRow key={r.id} sx={{ "& td": { fontSize: "0.8125rem" } }}>
                    <TableCell sx={{ fontWeight: 600, color: "#2563eb" }}>{r.runCode}</TableCell>
                    <TableCell>{monthNames[r.month - 1]} {r.year}</TableCell>
                    <TableCell>{r.project ? `${r.project.projectCode} — ${r.project.name}` : "All projects"}</TableCell>
                    <TableCell align="right">{r.recordCount}</TableCell>
                    <TableCell align="right">{fmt(r.totalPayable)}</TableCell>
                    <TableCell align="right">{fmt(r.totalCostToCompany)}</TableCell>
                    <TableCell>
                      {r.status === "PAID"
                        ? <Chip icon={<CheckCircle />} label="Paid" color="success" size="small" sx={{ fontWeight: 700 }} />
                        : <Chip label="Completed" color="warning" size="small" variant="outlined" sx={{ fontWeight: 700 }} />}
                    </TableCell>
                    <TableCell align="center">
                      {r.status !== "PAID" && (
                        <Button size="small" variant="outlined" disabled={markRunPaidMut.isPending} onClick={() => markRunPaidMut.mutate(r.id)}
                          sx={{ borderRadius: "8px", textTransform: "none", fontSize: "0.75rem", fontWeight: 600, borderColor: "#22c55e", color: "#16a34a" }}>
                          Mark Run Paid
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Card>
    </Box>
  );
}
