import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Card, CardContent, Button, Chip, CircularProgress,
  Alert, Table, TableHead, TableRow, TableCell, TableBody, Grid,
  FormControl, InputLabel, Select, MenuItem,
} from "@mui/material";
import { Download, AccountBalance } from "@mui/icons-material";
import { payrollApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmt(n: unknown) {
  return Number(n ?? 0).toLocaleString("en-SG", { style: "currency", currency: "SGD", minimumFractionDigits: 2 });
}

export default function MyPayslipsPage() {
  const { user } = useAuthStore();
  const employeeId = user?.employee?.id;
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const years = Array.from({ length: 4 }, (_, i) => currentYear - i);

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-payslips", employeeId],
    queryFn: () => payrollApi.getPayslips(employeeId!),
    enabled: !!employeeId,
  });

  const allPayslips: any[] = Array.isArray(data?.data?.data?.payslips) ? data.data.data.payslips : [];
  const payslips = allPayslips.filter((p: any) => p.year === year);
  const employee = data?.data?.data?.employee ?? {};

  const totalGross = payslips.reduce((s: number, p: any) => s + Number(p.basicPay || 0) + Number(p.overtimePay || 0) + Number(p.allowances || 0), 0);
  const totalNet = payslips.reduce((s: number, p: any) => s + Number(p.totalPayable || 0), 0);
  const totalCpf = payslips.reduce((s: number, p: any) => s + Number(p.cpfEmployee || 0), 0);

  async function handleDownload(payslipId: string, month: number, yr: number) {
    try {
      const res = await payrollApi.downloadPayslip(payslipId);
      const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payslip-${MONTH_NAMES[month - 1]}-${yr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Download failed silently
    }
  }

  if (!employeeId) {
    return (
      <Box sx={{ maxWidth: 560, mx: "auto", mt: 6 }}>
        <Alert severity="info">
          Your account is not linked to an employee profile. Please contact your administrator.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Box sx={{ width: 44, height: 44, borderRadius: "12px", backgroundColor: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <AccountBalance sx={{ fontSize: 22, color: "#2563eb" }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
            My Payslips
          </Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>
            {employee.firstName} {employee.lastName} · {employee.employeeCode}
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel>Year</InputLabel>
          <Select value={year} label="Year" onChange={e => setYear(Number(e.target.value))}>
            {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: "Total Gross Pay", value: fmt(totalGross), color: "#2563eb" },
          { label: "Total Net Pay", value: fmt(totalNet), color: "#059669" },
          { label: "Total CPF (Employee)", value: fmt(totalCpf), color: "#7c3aed" },
        ].map(({ label, value, color }) => (
          <Grid item xs={12} md={4} key={label}>
            <Card>
              <CardContent sx={{ p: 2.5 }}>
                <Typography sx={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", mb: 0.75 }}>
                  {label}
                </Typography>
                <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color }}>{value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}><CircularProgress /></Box>
          ) : error ? (
            <Alert severity="error" sx={{ m: 2 }}>Failed to load payslips</Alert>
          ) : payslips.length === 0 ? (
            <Alert severity="info" sx={{ m: 2 }}>No payslips found for {year}</Alert>
          ) : (
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                  {["Period", "Project", "Days Worked", "Gross Pay", "CPF (Emp)", "Net Pay", "Status", ""].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {payslips.map((p: any) => {
                  const gross = Number(p.basicPay || 0) + Number(p.overtimePay || 0) + Number(p.allowances || 0);
                  return (
                    <TableRow key={p.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {MONTH_NAMES[(p.month ?? 1) - 1]} {p.year}
                      </TableCell>
                      <TableCell sx={{ color: "#475569" }}>{p.project?.name ?? "—"}</TableCell>
                      <TableCell>{p.daysWorked}</TableCell>
                      <TableCell>{fmt(gross)}</TableCell>
                      <TableCell sx={{ color: "#7c3aed" }}>{fmt(p.cpfEmployee)}</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: "#059669" }}>{fmt(p.totalPayable)}</TableCell>
                      <TableCell>
                        <Chip
                          label={p.isPaid ? "Paid" : "Pending"}
                          color={p.isPaid ? "success" : "warning"}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          startIcon={<Download sx={{ fontSize: 14 }} />}
                          onClick={() => handleDownload(p.id, p.month, p.year)}
                          sx={{ textTransform: "none", fontSize: "0.75rem", fontWeight: 600 }}
                        >
                          PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
