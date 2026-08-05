import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Card, CardContent, Button, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody, Divider,
  FormControl, InputLabel, Select, MenuItem, Grid,
} from "@mui/material";
import { PlayArrow, TrendingDown } from "@mui/icons-material";
import { toast } from "sonner";
import { equipmentApi } from "@/lib/api";

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 4 }, (_, i) => currentYear - 1 + i);

function fmt(n: unknown) {
  return Number(n ?? 0).toLocaleString("en-SG", { style: "currency", currency: "SGD", minimumFractionDigits: 2 });
}

export default function DepreciationPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: listData, isLoading } = useQuery({
    queryKey: ["depreciation-list", month, year],
    queryFn: () => equipmentApi.listDepreciation({ month, year }),
  });
  const entries: any[] = Array.isArray(listData?.data?.data) ? listData.data.data : [];

  const runMut = useMutation({
    mutationFn: () => equipmentApi.runDepreciation({ month, year }),
    onSuccess: (res) => {
      const n = res?.data?.data?.entriesGenerated ?? 0;
      toast.success(`Depreciation run complete — ${n} entr${n === 1 ? "y" : "ies"} generated`);
      qc.invalidateQueries({ queryKey: ["depreciation-list"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to run depreciation"),
  });

  const totalDep = entries.reduce((s, e) => s + Number(e.depreciationAmount), 0);
  const totalBookValue = entries.reduce((s, e) => s + Number(e.bookValue), 0);

  return (
    <Box>
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: "#0f172a", letterSpacing: "-0.02em" }}>Depreciation</Typography>
          <Typography variant="body2" sx={{ color: "#64748b", mt: 0.25 }}>
            Straight-line depreciation for serialized asset units
          </Typography>
        </Box>
      </Box>

      <Card elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: "14px", mb: 3 }}>
        <CardContent sx={{ px: 3, py: 2.5 }}>
          <Grid container spacing={2} alignItems="flex-end">
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
                startIcon={runMut.isPending ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <PlayArrow />}
                disabled={runMut.isPending}
                onClick={() => runMut.mutate()}
                sx={{
                  height: 40, px: 3, borderRadius: "10px", textTransform: "none", fontWeight: 700,
                  background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                  "&:hover": { background: "linear-gradient(135deg, #6d28d9 0%, #5b21b6 100%)" },
                }}
              >
                Run Depreciation
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: "14px" }}>
        <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
          <TrendingDown sx={{ fontSize: 20, color: "#64748b" }} />
          <Box>
            <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>Depreciation — {monthNames[month - 1]} {year}</Typography>
            <Typography sx={{ fontSize: "0.8125rem", color: "#94a3b8" }}>{entries.length} asset(s)</Typography>
          </Box>
        </Box>
        <Divider />
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
        ) : entries.length === 0 ? (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <TrendingDown sx={{ fontSize: 36, color: "#cbd5e1", mb: 1 }} />
            <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>No depreciation entries</Typography>
            <Typography sx={{ color: "#94a3b8", fontSize: "0.875rem" }}>Run depreciation for this period to generate entries.</Typography>
          </Box>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.8125rem", color: "#64748b", background: "#f8fafc" } }}>
                  <TableCell>Asset</TableCell><TableCell align="right">Amount</TableCell>
                  <TableCell align="right">Accumulated</TableCell><TableCell align="right">Book Value</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600, fontSize: "0.8125rem" }}>{e.assetUnit?.assetTag}</Typography>
                      <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>{e.assetUnit?.item?.name}</Typography>
                    </TableCell>
                    <TableCell align="right">{fmt(e.depreciationAmount)}</TableCell>
                    <TableCell align="right">{fmt(e.accumulatedDepreciation)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(e.bookValue)}</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ background: "#f8fafc", "& td": { fontWeight: 700, borderTop: "2px solid #e2e8f0" } }}>
                  <TableCell>Totals</TableCell>
                  <TableCell align="right">{fmt(totalDep)}</TableCell>
                  <TableCell />
                  <TableCell align="right">{fmt(totalBookValue)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Box>
        )}
      </Card>
    </Box>
  );
}
