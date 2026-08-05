import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Card, CardContent, Button, Chip, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody, Grid,
  FormControl, InputLabel, Select, MenuItem, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab, IconButton, Menu,
} from "@mui/material";
import { Add, Work, People, Timeline, MoreHoriz } from "@mui/icons-material";
import { toast } from "sonner";
import { recruitmentApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

const STAGES = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED", "REJECTED", "WITHDRAWN"];

function stageColor(s: string): "default" | "info" | "warning" | "success" | "error" {
  if (s === "HIRED") return "success";
  if (s === "REJECTED" || s === "WITHDRAWN") return "error";
  if (s === "OFFER") return "warning";
  if (s === "APPLIED") return "default";
  return "info";
}

function NewRequisitionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", department: "", headcount: 1, description: "" });
  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const mut = useMutation({
    mutationFn: () => recruitmentApi.createRequisition(form),
    onSuccess: () => { toast.success("Requisition created"); qc.invalidateQueries({ queryKey: ["requisitions"] }); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to create requisition"),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>New Job Requisition</DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}><TextField fullWidth size="small" label="Title" value={form.title} onChange={e => set("title", e.target.value)} /></Grid>
          <Grid item xs={6}><TextField fullWidth size="small" label="Department" value={form.department} onChange={e => set("department", e.target.value)} /></Grid>
          <Grid item xs={6}><TextField fullWidth size="small" type="number" label="Headcount" value={form.headcount} onChange={e => set("headcount", Number(e.target.value))} /></Grid>
          <Grid item xs={12}><TextField fullWidth size="small" multiline rows={3} label="Description" value={form.description} onChange={e => set("description", e.target.value)} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button onClick={() => mut.mutate()} variant="contained" disabled={mut.isPending || !form.title}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>Create</Button>
      </DialogActions>
    </Dialog>
  );
}

function NewCandidateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", source: "" });
  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const mut = useMutation({
    mutationFn: () => recruitmentApi.createCandidate(form),
    onSuccess: () => { toast.success("Candidate added"); qc.invalidateQueries({ queryKey: ["candidates"] }); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to add candidate"),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>New Candidate</DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}><TextField fullWidth size="small" label="Full Name" value={form.fullName} onChange={e => set("fullName", e.target.value)} /></Grid>
          <Grid item xs={6}><TextField fullWidth size="small" label="Email" value={form.email} onChange={e => set("email", e.target.value)} /></Grid>
          <Grid item xs={6}><TextField fullWidth size="small" label="Phone" value={form.phone} onChange={e => set("phone", e.target.value)} /></Grid>
          <Grid item xs={12}><TextField fullWidth size="small" label="Source" placeholder="e.g. LinkedIn, Referral" value={form.source} onChange={e => set("source", e.target.value)} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button onClick={() => mut.mutate()} variant="contained" disabled={mut.isPending || !form.fullName}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>Add</Button>
      </DialogActions>
    </Dialog>
  );
}

function AddToPipelineDialog({ open, onClose, requisitions, candidates }: { open: boolean; onClose: () => void; requisitions: any[]; candidates: any[] }) {
  const qc = useQueryClient();
  const [requisitionId, setRequisitionId] = useState("");
  const [candidateId, setCandidateId] = useState("");

  const mut = useMutation({
    mutationFn: () => recruitmentApi.createApplication(requisitionId, candidateId),
    onSuccess: () => { toast.success("Added to pipeline"); qc.invalidateQueries({ queryKey: ["applications"] }); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to add to pipeline"),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Add Candidate to Pipeline</DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl fullWidth size="small">
              <InputLabel>Requisition</InputLabel>
              <Select value={requisitionId} label="Requisition" onChange={e => setRequisitionId(e.target.value)}>
                {requisitions.map(r => <MenuItem key={r.id} value={r.id}>{r.code} — {r.title}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth size="small">
              <InputLabel>Candidate</InputLabel>
              <Select value={candidateId} label="Candidate" onChange={e => setCandidateId(e.target.value)}>
                {candidates.map(c => <MenuItem key={c.id} value={c.id}>{c.fullName}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button onClick={() => mut.mutate()} variant="contained" disabled={mut.isPending || !requisitionId || !candidateId}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>Add</Button>
      </DialogActions>
    </Dialog>
  );
}

function HireDialog({ application, onClose }: { application: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    firstName: application?.candidate?.fullName?.split(" ")[0] ?? "",
    lastName: application?.candidate?.fullName?.split(" ").slice(1).join(" ") ?? "",
    email: application?.candidate?.email ?? "",
    phone: application?.candidate?.phone ?? "",
    jobTitle: "", dailyRate: 0, joinDate: new Date().toISOString().slice(0, 10),
  });
  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const mut = useMutation({
    mutationFn: () => recruitmentApi.hire(application.id, form),
    onSuccess: () => { toast.success("Candidate hired — employee record created"); qc.invalidateQueries({ queryKey: ["applications"] }); qc.invalidateQueries({ queryKey: ["requisitions"] }); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to hire"),
  });

  return (
    <Dialog open={!!application} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Hire {application?.candidate?.fullName}</DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
        <Grid container spacing={2}>
          <Grid item xs={6}><TextField fullWidth size="small" label="First Name" value={form.firstName} onChange={e => set("firstName", e.target.value)} /></Grid>
          <Grid item xs={6}><TextField fullWidth size="small" label="Last Name" value={form.lastName} onChange={e => set("lastName", e.target.value)} /></Grid>
          <Grid item xs={6}><TextField fullWidth size="small" label="Job Title" value={form.jobTitle} onChange={e => set("jobTitle", e.target.value)} /></Grid>
          <Grid item xs={6}><TextField fullWidth size="small" type="number" label="Daily Rate (SGD)" value={form.dailyRate} onChange={e => set("dailyRate", Number(e.target.value))} /></Grid>
          <Grid item xs={12}><TextField fullWidth size="small" type="date" label="Join Date" InputLabelProps={{ shrink: true }} value={form.joinDate} onChange={e => set("joinDate", e.target.value)} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button onClick={() => mut.mutate()} variant="contained" disabled={mut.isPending || !form.firstName || !form.lastName}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>Hire</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function RecruitmentPage() {
  const qc = useQueryClient();
  const role = useAuthStore(s => s.user?.role) ?? "";
  const canManage = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role);

  const [tab, setTab] = useState(0);
  const [newReqOpen, setNewReqOpen] = useState(false);
  const [newCandOpen, setNewCandOpen] = useState(false);
  const [addPipelineOpen, setAddPipelineOpen] = useState(false);
  const [hireTarget, setHireTarget] = useState<any>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; app: any } | null>(null);

  const { data: reqData, isLoading: reqLoading } = useQuery({ queryKey: ["requisitions"], queryFn: () => recruitmentApi.getRequisitions({ limit: 200 }) });
  const requisitions: any[] = reqData?.data?.data?.data ?? [];

  const { data: candData, isLoading: candLoading } = useQuery({ queryKey: ["candidates"], queryFn: () => recruitmentApi.getCandidates({ limit: 200 }) });
  const candidates: any[] = candData?.data?.data?.data ?? [];

  const { data: appData, isLoading: appLoading } = useQuery({ queryKey: ["applications"], queryFn: () => recruitmentApi.getApplications() });
  const applications: any[] = appData?.data?.data ?? [];

  const stageMut = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => recruitmentApi.updateApplicationStage(id, { stage }),
    onSuccess: () => { toast.success("Stage updated"); qc.invalidateQueries({ queryKey: ["applications"] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to update stage"),
  });

  return (
    <Box>
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: "#0f172a", letterSpacing: "-0.02em" }}>Recruitment</Typography>
          <Typography variant="body2" sx={{ color: "#64748b", mt: 0.25 }}>Job requisitions, candidates, and hiring pipeline</Typography>
        </Box>
        {canManage && (
          <Box sx={{ display: "flex", gap: 1 }}>
            {tab === 0 && <Button variant="contained" startIcon={<Add />} onClick={() => setNewReqOpen(true)} sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>New Requisition</Button>}
            {tab === 1 && <Button variant="contained" startIcon={<Add />} onClick={() => setNewCandOpen(true)} sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>New Candidate</Button>}
            {tab === 2 && <Button variant="contained" startIcon={<Add />} onClick={() => setAddPipelineOpen(true)} sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>Add to Pipeline</Button>}
          </Box>
        )}
      </Box>

      <Card sx={{ borderRadius: "14px", boxShadow: "0 1px 8px rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.04)" }}>
        <Box sx={{ borderBottom: "1px solid #e2e8f0", px: 2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ "& .MuiTab-root": { textTransform: "none", fontWeight: 600 } }}>
            <Tab icon={<Work sx={{ fontSize: 18 }} />} iconPosition="start" label="Requisitions" />
            <Tab icon={<People sx={{ fontSize: 18 }} />} iconPosition="start" label="Candidates" />
            <Tab icon={<Timeline sx={{ fontSize: 18 }} />} iconPosition="start" label="Pipeline" />
          </Tabs>
        </Box>

        {tab === 0 && (
          <CardContent sx={{ p: "0 !important" }}>
            {reqLoading ? <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={28} /></Box> : (
              <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 700, color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", background: "#f8fafc" } }}>
                    <TableCell>Code</TableCell><TableCell>Title</TableCell><TableCell>Department</TableCell>
                    <TableCell align="right">Headcount</TableCell><TableCell>Status</TableCell><TableCell align="right">Applications</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requisitions.map(r => (
                    <TableRow key={r.id} hover>
                      <TableCell sx={{ fontWeight: 600, color: "#2563eb", fontSize: "0.8rem" }}>{r.code}</TableCell>
                      <TableCell sx={{ fontSize: "0.8rem" }}>{r.title}</TableCell>
                      <TableCell sx={{ fontSize: "0.8rem" }}>{r.department ?? "—"}</TableCell>
                      <TableCell align="right">{r.headcount}</TableCell>
                      <TableCell><Chip label={r.status} size="small" sx={{ fontWeight: 600, fontSize: "0.7rem" }} /></TableCell>
                      <TableCell align="right">{r._count?.applications ?? 0}</TableCell>
                    </TableRow>
                  ))}
                  {requisitions.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: "#94a3b8" }}>No requisitions yet</TableCell></TableRow>}
                </TableBody>
              </Table>
              </Box>
            )}
          </CardContent>
        )}

        {tab === 1 && (
          <CardContent sx={{ p: "0 !important" }}>
            {candLoading ? <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={28} /></Box> : (
              <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 700, color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", background: "#f8fafc" } }}>
                    <TableCell>Name</TableCell><TableCell>Email</TableCell><TableCell>Phone</TableCell><TableCell>Source</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {candidates.map(c => (
                    <TableRow key={c.id} hover>
                      <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem" }}>{c.fullName}</TableCell>
                      <TableCell sx={{ fontSize: "0.8rem" }}>{c.email ?? "—"}</TableCell>
                      <TableCell sx={{ fontSize: "0.8rem" }}>{c.phone ?? "—"}</TableCell>
                      <TableCell sx={{ fontSize: "0.8rem" }}>{c.source ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                  {candidates.length === 0 && <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: "#94a3b8" }}>No candidates yet</TableCell></TableRow>}
                </TableBody>
              </Table>
              </Box>
            )}
          </CardContent>
        )}

        {tab === 2 && (
          <CardContent sx={{ p: "0 !important" }}>
            {appLoading ? <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={28} /></Box> : (
              <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 700, color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", background: "#f8fafc" } }}>
                    <TableCell>Candidate</TableCell><TableCell>Requisition</TableCell><TableCell>Stage</TableCell>
                    {canManage && <TableCell align="right">Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {applications.map(a => (
                    <TableRow key={a.id} hover>
                      <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem" }}>{a.candidate?.fullName}</TableCell>
                      <TableCell sx={{ fontSize: "0.8rem" }}>{a.requisition?.code} — {a.requisition?.title}</TableCell>
                      <TableCell><Chip label={a.stage} size="small" color={stageColor(a.stage)} sx={{ fontWeight: 700, fontSize: "0.7rem" }} /></TableCell>
                      {canManage && (
                        <TableCell align="right">
                          {a.stage !== "HIRED" && a.stage !== "REJECTED" && a.stage !== "WITHDRAWN" && (
                            <IconButton size="small" onClick={e => setMenuAnchor({ el: e.currentTarget, app: a })}><MoreHoriz fontSize="small" /></IconButton>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {applications.length === 0 && <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: "#94a3b8" }}>No applications yet</TableCell></TableRow>}
                </TableBody>
              </Table>
              </Box>
            )}
          </CardContent>
        )}
      </Card>

      <Menu anchorEl={menuAnchor?.el} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        {STAGES.filter(s => s !== "HIRED").map(s => (
          <MenuItem key={s} onClick={() => { stageMut.mutate({ id: menuAnchor!.app.id, stage: s }); setMenuAnchor(null); }}>
            Move to {s}
          </MenuItem>
        ))}
        <MenuItem onClick={() => { setHireTarget(menuAnchor!.app); setMenuAnchor(null); }} sx={{ color: "#16a34a", fontWeight: 700 }}>
          Hire
        </MenuItem>
      </Menu>

      <NewRequisitionDialog open={newReqOpen} onClose={() => setNewReqOpen(false)} />
      <NewCandidateDialog open={newCandOpen} onClose={() => setNewCandOpen(false)} />
      <AddToPipelineDialog open={addPipelineOpen} onClose={() => setAddPipelineOpen(false)} requisitions={requisitions} candidates={candidates} />
      {hireTarget && <HireDialog application={hireTarget} onClose={() => setHireTarget(null)} />}
    </Box>
  );
}
