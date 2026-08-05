import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Card, CardContent, Button, Chip, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody, Grid,
  FormControl, InputLabel, Select, MenuItem, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, Divider,
} from "@mui/material";
import { Add } from "@mui/icons-material";
import { toast } from "sonner";
import { employeeCasesApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

const TYPES = ["GRIEVANCE", "DISCIPLINARY", "HELPDESK"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

function statusColor(s: string): "default" | "warning" | "info" | "success" {
  if (s === "RESOLVED" || s === "CLOSED") return "success";
  if (s === "IN_PROGRESS") return "info";
  return "warning";
}
function priorityColor(p: string): "default" | "warning" | "error" {
  if (p === "URGENT" || p === "HIGH") return "error";
  if (p === "MEDIUM") return "warning";
  return "default";
}

function NewCaseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ type: "HELPDESK", title: "", description: "", priority: "MEDIUM" });
  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const mut = useMutation({
    mutationFn: () => employeeCasesApi.create(form),
    onSuccess: () => { toast.success("Case submitted"); qc.invalidateQueries({ queryKey: ["employee-cases"] }); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to submit case"),
  });
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>New Case</DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select value={form.type} label="Type" onChange={e => set("type", e.target.value)}>
                {TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Priority</InputLabel>
              <Select value={form.priority} label="Priority" onChange={e => set("priority", e.target.value)}>
                {PRIORITIES.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}><TextField fullWidth size="small" label="Title" value={form.title} onChange={e => set("title", e.target.value)} /></Grid>
          <Grid item xs={12}><TextField fullWidth size="small" multiline rows={4} label="Description" value={form.description} onChange={e => set("description", e.target.value)} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button onClick={() => mut.mutate()} variant="contained" disabled={mut.isPending || !form.title}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>Submit</Button>
      </DialogActions>
    </Dialog>
  );
}

function CaseDetailDialog({ caseId, onClose, canManage }: { caseId: string | null; onClose: () => void; canManage: boolean }) {
  const qc = useQueryClient();
  const [comment, setComment] = useState("");

  const { data } = useQuery({ queryKey: ["employee-case", caseId], queryFn: () => employeeCasesApi.get(caseId!), enabled: !!caseId });
  const item = data?.data?.data;

  const { data: commentsData } = useQuery({ queryKey: ["employee-case-comments", caseId], queryFn: () => employeeCasesApi.getComments(caseId!), enabled: !!caseId });
  const comments: any[] = commentsData?.data?.data ?? [];

  const statusMut = useMutation({
    mutationFn: (status: string) => employeeCasesApi.update(caseId!, { status }),
    onSuccess: () => { toast.success("Status updated"); qc.invalidateQueries({ queryKey: ["employee-cases"] }); qc.invalidateQueries({ queryKey: ["employee-case", caseId] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to update"),
  });
  const commentMut = useMutation({
    mutationFn: () => employeeCasesApi.addComment(caseId!, { body: comment }),
    onSuccess: () => { setComment(""); qc.invalidateQueries({ queryKey: ["employee-case-comments", caseId] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to add comment"),
  });

  return (
    <Dialog open={!!caseId} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>{item?.caseCode} — {item?.title}</DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
        {!item ? <CircularProgress size={24} /> : (
          <Box>
            <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
              <Chip label={item.type} size="small" />
              <Chip label={item.status} size="small" color={statusColor(item.status)} />
              <Chip label={item.priority} size="small" color={priorityColor(item.priority)} />
            </Box>
            <Typography variant="body2" sx={{ mb: 2 }}>{item.description}</Typography>

            {canManage && (
              <Box sx={{ mb: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
                {STATUSES.map(s => (
                  <Button key={s} size="small" variant={item.status === s ? "contained" : "outlined"}
                    onClick={() => statusMut.mutate(s)} sx={{ textTransform: "none", borderRadius: "8px" }}>{s}</Button>
                ))}
              </Box>
            )}

            <Divider sx={{ my: 2 }} />
            <Typography sx={{ fontWeight: 700, mb: 1 }}>Comments</Typography>
            {comments.map(c => (
              <Box key={c.id} sx={{ mb: 1.5, p: 1.5, borderRadius: "8px", background: c.isInternal ? "#fef3c7" : "#f1f5f9" }}>
                <Typography variant="caption" sx={{ color: "#64748b" }}>{c.authorUser?.email} {c.isInternal ? "(internal)" : ""}</Typography>
                <Typography variant="body2">{c.body}</Typography>
              </Box>
            ))}
            {comments.length === 0 && <Typography variant="body2" sx={{ color: "#94a3b8" }}>No comments yet</Typography>}

            <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
              <TextField fullWidth size="small" placeholder="Add a comment..." value={comment} onChange={e => setComment(e.target.value)} />
              <Button variant="contained" disabled={!comment || commentMut.isPending} onClick={() => commentMut.mutate()}
                sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>Post</Button>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", color: "#64748b" }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function EmployeeCasesPage() {
  const role = useAuthStore(s => s.user?.role) ?? "";
  const canManage = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role);

  const [newOpen, setNewOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["employee-cases"], queryFn: () => employeeCasesApi.getAll() });
  const cases: any[] = data?.data?.data ?? [];

  return (
    <Box>
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: "#0f172a", letterSpacing: "-0.02em" }}>Employee Cases</Typography>
          <Typography variant="body2" sx={{ color: "#64748b", mt: 0.25 }}>
            {canManage ? "Grievances, disciplinary records, and HR helpdesk requests" : "Your grievances and HR helpdesk requests"}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setNewOpen(true)} sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>New Case</Button>
      </Box>

      <Card sx={{ borderRadius: "14px", boxShadow: "0 1px 8px rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.04)" }}>
        <CardContent sx={{ p: "0 !important" }}>
          {isLoading ? <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={28} /></Box> : cases.length === 0 ? (
            <Alert severity="info" sx={{ m: 2, borderRadius: "10px" }}>No cases yet.</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", background: "#f8fafc" } }}>
                  <TableCell>Code</TableCell><TableCell>Title</TableCell><TableCell>Type</TableCell>
                  {canManage && <TableCell>Employee</TableCell>}
                  <TableCell>Priority</TableCell><TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cases.map(c => (
                  <TableRow key={c.id} hover onClick={() => setDetailId(c.id)} sx={{ cursor: "pointer" }}>
                    <TableCell sx={{ fontWeight: 600, color: "#2563eb", fontSize: "0.8rem" }}>{c.caseCode}</TableCell>
                    <TableCell sx={{ fontSize: "0.8rem" }}>{c.title}</TableCell>
                    <TableCell sx={{ fontSize: "0.8rem" }}>{c.type}</TableCell>
                    {canManage && <TableCell sx={{ fontSize: "0.8rem" }}>{c.employee?.firstName} {c.employee?.lastName}</TableCell>}
                    <TableCell><Chip label={c.priority} size="small" color={priorityColor(c.priority)} sx={{ fontWeight: 600, fontSize: "0.7rem" }} /></TableCell>
                    <TableCell><Chip label={c.status} size="small" color={statusColor(c.status)} sx={{ fontWeight: 600, fontSize: "0.7rem" }} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NewCaseDialog open={newOpen} onClose={() => setNewOpen(false)} />
      <CaseDetailDialog caseId={detailId} onClose={() => setDetailId(null)} canManage={canManage} />
    </Box>
  );
}
