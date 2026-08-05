import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Card, CardContent, Button, Chip, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody, Grid, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab,
} from "@mui/material";
import { Add, Bolt } from "@mui/icons-material";
import { toast } from "sonner";
import { performanceApi } from "@/lib/api";

function statusColor(s: string): "default" | "warning" | "info" | "success" {
  if (s === "COMPLETED") return "success";
  if (s === "PENDING_MANAGER_REVIEW") return "info";
  return "warning";
}

function NewCycleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", periodStart: "", periodEnd: "" });
  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const mut = useMutation({
    mutationFn: () => performanceApi.createCycle(form),
    onSuccess: () => { toast.success("Review cycle created"); qc.invalidateQueries({ queryKey: ["review-cycles"] }); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to create cycle"),
  });
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>New Review Cycle</DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}><TextField fullWidth size="small" label="Cycle Name" placeholder="e.g. H1 2026 Review" value={form.name} onChange={e => set("name", e.target.value)} /></Grid>
          <Grid item xs={6}><TextField fullWidth size="small" type="date" label="Period Start" InputLabelProps={{ shrink: true }} value={form.periodStart} onChange={e => set("periodStart", e.target.value)} /></Grid>
          <Grid item xs={6}><TextField fullWidth size="small" type="date" label="Period End" InputLabelProps={{ shrink: true }} value={form.periodEnd} onChange={e => set("periodEnd", e.target.value)} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button onClick={() => mut.mutate()} variant="contained" disabled={mut.isPending || !form.name || !form.periodStart || !form.periodEnd}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>Create</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function PerformancePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [newCycleOpen, setNewCycleOpen] = useState(false);

  const { data: cycleData, isLoading: cyclesLoading } = useQuery({ queryKey: ["review-cycles"], queryFn: () => performanceApi.getCycles() });
  const cycles: any[] = cycleData?.data?.data ?? [];

  const { data: reviewData, isLoading: reviewsLoading } = useQuery({ queryKey: ["performance-reviews"], queryFn: () => performanceApi.getReviews() });
  const reviews: any[] = reviewData?.data?.data ?? [];

  const activateMut = useMutation({
    mutationFn: (id: string) => performanceApi.updateCycle(id, { status: "ACTIVE" }),
    onSuccess: () => { toast.success("Cycle activated"); qc.invalidateQueries({ queryKey: ["review-cycles"] }); },
  });
  const closeMut = useMutation({
    mutationFn: (id: string) => performanceApi.updateCycle(id, { status: "CLOSED" }),
    onSuccess: () => { toast.success("Cycle closed"); qc.invalidateQueries({ queryKey: ["review-cycles"] }); },
  });
  const generateMut = useMutation({
    mutationFn: (cycleId: string) => performanceApi.generateReviews(cycleId),
    onSuccess: () => { toast.success("Reviews generated for all active employees"); qc.invalidateQueries({ queryKey: ["performance-reviews"] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to generate reviews"),
  });

  return (
    <Box>
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: "#0f172a", letterSpacing: "-0.02em" }}>Performance</Typography>
          <Typography variant="body2" sx={{ color: "#64748b", mt: 0.25 }}>Review cycles and employee performance reviews</Typography>
        </Box>
        {tab === 0 && <Button variant="contained" startIcon={<Add />} onClick={() => setNewCycleOpen(true)} sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>New Cycle</Button>}
      </Box>

      <Card sx={{ borderRadius: "14px", boxShadow: "0 1px 8px rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.04)" }}>
        <Box sx={{ borderBottom: "1px solid #e2e8f0", px: 2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ "& .MuiTab-root": { textTransform: "none", fontWeight: 600 } }}>
            <Tab label="Cycles" />
            <Tab label="All Reviews" />
          </Tabs>
        </Box>

        {tab === 0 && (
          <CardContent sx={{ p: "0 !important" }}>
            {cyclesLoading ? <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={28} /></Box> : (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 700, color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", background: "#f8fafc" } }}>
                    <TableCell>Name</TableCell><TableCell>Period</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cycles.map(c => (
                    <TableRow key={c.id} hover>
                      <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem" }}>{c.name}</TableCell>
                      <TableCell sx={{ fontSize: "0.8rem" }}>{new Date(c.periodStart).toLocaleDateString("en-SG")} – {new Date(c.periodEnd).toLocaleDateString("en-SG")}</TableCell>
                      <TableCell><Chip label={c.status} size="small" sx={{ fontWeight: 600, fontSize: "0.7rem" }} /></TableCell>
                      <TableCell align="right">
                        {c.status === "DRAFT" && <Button size="small" onClick={() => activateMut.mutate(c.id)} sx={{ textTransform: "none" }}>Activate</Button>}
                        {c.status === "ACTIVE" && (
                          <>
                            <Button size="small" startIcon={<Bolt sx={{ fontSize: 14 }} />} onClick={() => generateMut.mutate(c.id)} sx={{ textTransform: "none" }}>Generate Reviews</Button>
                            <Button size="small" onClick={() => closeMut.mutate(c.id)} sx={{ textTransform: "none", color: "#64748b" }}>Close</Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {cycles.length === 0 && <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: "#94a3b8" }}>No review cycles yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </CardContent>
        )}

        {tab === 1 && (
          <CardContent sx={{ p: "0 !important" }}>
            {reviewsLoading ? <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={28} /></Box> : (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 700, color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", background: "#f8fafc" } }}>
                    <TableCell>Employee</TableCell><TableCell>Cycle</TableCell><TableCell>Reviewer</TableCell>
                    <TableCell align="right">Self Rating</TableCell><TableCell align="right">Manager Rating</TableCell><TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reviews.map(r => (
                    <TableRow key={r.id} hover>
                      <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem" }}>{r.employee?.firstName} {r.employee?.lastName}</TableCell>
                      <TableCell sx={{ fontSize: "0.8rem" }}>{r.cycle?.name}</TableCell>
                      <TableCell sx={{ fontSize: "0.8rem" }}>{r.reviewer ? `${r.reviewer.firstName} ${r.reviewer.lastName}` : "—"}</TableCell>
                      <TableCell align="right">{r.selfRating ?? "—"}</TableCell>
                      <TableCell align="right">{r.managerRating ?? "—"}</TableCell>
                      <TableCell><Chip label={r.status.replace(/_/g, " ")} size="small" color={statusColor(r.status)} sx={{ fontWeight: 600, fontSize: "0.7rem" }} /></TableCell>
                    </TableRow>
                  ))}
                  {reviews.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: "#94a3b8" }}>No reviews generated yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </CardContent>
        )}
      </Card>

      <NewCycleDialog open={newCycleOpen} onClose={() => setNewCycleOpen(false)} />
    </Box>
  );
}
