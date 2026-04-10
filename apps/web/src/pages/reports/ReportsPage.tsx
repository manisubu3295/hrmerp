import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Card, CardContent, Typography, Alert, Divider, Button, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Grid,
} from "@mui/material";
import {
  Assessment, People, AccountBalanceWallet, Receipt, Construction,
  FolderOpen, VerifiedUser, Download, TableChart, Payments, AccountBalance,
} from "@mui/icons-material";
import { toast } from "sonner";
import { reportsApi } from "@/lib/api";

const REPORT_TYPES = [
  { key: "projects",    label: "Projects Summary",    desc: "Overview of all projects, status, and progress",     icon: FolderOpen,          color: "#2563eb", bg: "#eff6ff" },
  { key: "employees",   label: "Employee Report",      desc: "Headcount, nationality, work pass status",           icon: People,              color: "#7c3aed", bg: "#f5f3ff" },
  { key: "billing",     label: "Billing & Revenue",    desc: "Invoices, payments, outstanding amounts",            icon: Receipt,             color: "#059669", bg: "#f0fdf4" },
  { key: "expenses",    label: "Expenses Report",      desc: "All expense records by category and status",         icon: AccountBalanceWallet, color: "#d97706", bg: "#fffbeb" },
  { key: "compliance",  label: "Compliance Report",    desc: "Work pass expiry and compliance status",             icon: VerifiedUser,        color: "#0891b2", bg: "#f0f9ff" },
  { key: "equipment",   label: "Equipment Report",     desc: "Asset utilization and maintenance schedule",         icon: Construction,        color: "#dc2626", bg: "#fef2f2" },
];

export default function ReportsPage() {
  const [generating, setGenerating] = useState<string | null>(null);
  const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1);
  const [exportYear, setExportYear] = useState(new Date().getFullYear());
  const [csvLoading, setCsvLoading] = useState<string | null>(null);

  async function handleGenerate(key: string) {
    setGenerating(key);
    try {
      const res = await reportsApi.generate({ type: key });
      const blob = new Blob([JSON.stringify(res.data?.data ?? res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${key}-report-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(null);
    }
  }

  async function downloadCsv(type: "timesheets" | "profit" | "payroll", filename: string) {
    setCsvLoading(type);
    try {
      const params = { month: exportMonth, year: exportYear };
      const res = type === "timesheets"
        ? await reportsApi.exportTimesheets(params)
        : type === "profit"
        ? await reportsApi.exportProfit(params)
        : await reportsApi.exportPayroll(params);
      const blob = new Blob([res.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Export failed");
    } finally {
      setCsvLoading(null);
    }
  }

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const years = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - 1 + i);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
        <Box sx={{ px: 3, pt: 2.5, pb: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Assessment sx={{ fontSize: 20, color: "#64748b" }} />
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0f172a" }}>Reports</Typography>
            <Typography sx={{ fontSize: "0.8125rem", color: "#94a3b8" }}>Generate and download business reports</Typography>
          </Box>
        </Box>
        <Divider />

        <Box sx={{ p: 3, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 2 }}>
          {REPORT_TYPES.map(({ key, label, desc, icon: Icon, color, bg }) => (
            <Box key={key} sx={{ border: "1px solid #e2e8f0", borderRadius: "12px", p: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                <Box sx={{ width: 44, height: 44, borderRadius: "12px", backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon sx={{ fontSize: 22, color }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0f172a", mb: 0.25 }}>{label}</Typography>
                  <Typography sx={{ fontSize: "0.8125rem", color: "#64748b", lineHeight: 1.4 }}>{desc}</Typography>
                </Box>
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={generating === key ? <CircularProgress size={12} /> : <Download sx={{ fontSize: 14 }} />}
                disabled={generating === key}
                onClick={() => handleGenerate(key)}
                fullWidth
                sx={{ borderRadius: "8px", fontSize: "0.8125rem", fontWeight: 600, textTransform: "none", height: 36 }}>
                {generating === key ? "Generating…" : "Download Report"}
              </Button>
            </Box>
          ))}
        </Box>
      </Card>

      {/* CSV Data Exports */}
      <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
        <Box sx={{ px: 3, pt: 2.5, pb: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
          <TableChart sx={{ fontSize: 20, color: "#64748b" }} />
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0f172a" }}>Data Exports (CSV)</Typography>
            <Typography sx={{ fontSize: "0.8125rem", color: "#94a3b8" }}>Export raw data for payroll, timesheets, and profitability</Typography>
          </Box>
        </Box>
        <Divider />

        {/* Period selector */}
        <Box sx={{ px: 3, pt: 2.5, pb: 2 }}>
          <Grid container spacing={2} sx={{ mb: 3, maxWidth: 400 }}>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Month</InputLabel>
                <Select value={exportMonth} label="Month" onChange={(e) => setExportMonth(Number(e.target.value))}
                  sx={{ borderRadius: "10px" }}>
                  {monthNames.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Year</InputLabel>
                <Select value={exportYear} label="Year" onChange={(e) => setExportYear(Number(e.target.value))}
                  sx={{ borderRadius: "10px" }}>
                  {years.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 2 }}>
            {[
              {
                key: "timesheets" as const,
                label: "Timesheets CSV",
                desc: "Attendance and hours worked with daily wages",
                icon: TableChart,
                color: "#2563eb",
                bg: "#eff6ff",
                filename: `timesheets_${monthNames[exportMonth - 1]}_${exportYear}.csv`,
              },
              {
                key: "profit" as const,
                label: "Profit Report CSV",
                desc: "Revenue vs cost analysis per project",
                icon: Payments,
                color: "#059669",
                bg: "#f0fdf4",
                filename: `profit_${monthNames[exportMonth - 1]}_${exportYear}.csv`,
              },
              {
                key: "payroll" as const,
                label: "Payroll CSV",
                desc: "Employee salary breakdown with CPF contributions",
                icon: AccountBalance,
                color: "#7c3aed",
                bg: "#f5f3ff",
                filename: `payroll_${monthNames[exportMonth - 1]}_${exportYear}.csv`,
              },
            ].map(({ key, label, desc, icon: Icon, color, bg, filename }) => (
              <Box key={key} sx={{ border: "1px solid #e2e8f0", borderRadius: "12px", p: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: "12px", backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon sx={{ fontSize: 22, color }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0f172a", mb: 0.25 }}>{label}</Typography>
                    <Typography sx={{ fontSize: "0.8125rem", color: "#64748b", lineHeight: 1.4 }}>{desc}</Typography>
                  </Box>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={csvLoading === key ? <CircularProgress size={12} /> : <Download sx={{ fontSize: 14 }} />}
                  disabled={csvLoading === key}
                  onClick={() => downloadCsv(key, filename)}
                  fullWidth
                  sx={{ borderRadius: "8px", fontSize: "0.8125rem", fontWeight: 600, textTransform: "none", height: 36 }}
                >
                  {csvLoading === key ? "Downloading…" : "Download CSV"}
                </Button>
              </Box>
            ))}
          </Box>
        </Box>
      </Card>
    </Box>
  );
}
