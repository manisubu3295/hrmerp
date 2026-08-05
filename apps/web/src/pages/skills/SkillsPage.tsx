import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Card, CardContent, Button, Chip, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody, Grid,
  FormControl, InputLabel, Select, MenuItem, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab,
} from "@mui/material";
import { Add } from "@mui/icons-material";
import { toast } from "sonner";
import { skillsApi, employeesApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

const PROFICIENCIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];

function proficiencyColor(p: string): "default" | "info" | "warning" | "success" {
  if (p === "EXPERT") return "success";
  if (p === "ADVANCED") return "info";
  if (p === "INTERMEDIATE") return "warning";
  return "default";
}

function NewSkillDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const mut = useMutation({
    mutationFn: () => skillsApi.createSkill({ name, category }),
    onSuccess: () => { toast.success("Skill added to catalog"); qc.invalidateQueries({ queryKey: ["skill-catalog"] }); onClose(); setName(""); setCategory(""); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to add skill"),
  });
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>New Skill</DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}><TextField fullWidth size="small" label="Skill Name" value={name} onChange={e => setName(e.target.value)} /></Grid>
          <Grid item xs={12}><TextField fullWidth size="small" label="Category" value={category} onChange={e => setCategory(e.target.value)} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button onClick={() => mut.mutate()} variant="contained" disabled={mut.isPending || !name} sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>Add</Button>
      </DialogActions>
    </Dialog>
  );
}

function AssignSkillDialog({ open, onClose, skills }: { open: boolean; onClose: () => void; skills: any[] }) {
  const qc = useQueryClient();
  const [employeeId, setEmployeeId] = useState("");
  const [skillId, setSkillId] = useState("");
  const [proficiency, setProficiency] = useState("BEGINNER");

  const { data: empData } = useQuery({ queryKey: ["employees-for-skills"], queryFn: () => employeesApi.getAll({ limit: 200 }), enabled: open });
  const employees: any[] = empData?.data?.data?.data ?? [];

  const mut = useMutation({
    mutationFn: () => skillsApi.setEmployeeSkill(employeeId, skillId, { proficiency }),
    onSuccess: () => { toast.success("Skill assigned"); qc.invalidateQueries({ queryKey: ["skills-matrix"] }); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to assign skill"),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Assign Skill</DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl fullWidth size="small">
              <InputLabel>Employee</InputLabel>
              <Select value={employeeId} label="Employee" onChange={e => setEmployeeId(e.target.value)}>
                {employees.map(e => <MenuItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth size="small">
              <InputLabel>Skill</InputLabel>
              <Select value={skillId} label="Skill" onChange={e => setSkillId(e.target.value)}>
                {skills.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth size="small">
              <InputLabel>Proficiency</InputLabel>
              <Select value={proficiency} label="Proficiency" onChange={e => setProficiency(e.target.value)}>
                {PROFICIENCIES.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button onClick={() => mut.mutate()} variant="contained" disabled={mut.isPending || !employeeId || !skillId}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>Assign</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function SkillsPage() {
  const role = useAuthStore(s => s.user?.role) ?? "";
  const canManage = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role);

  const [tab, setTab] = useState(0);
  const [newSkillOpen, setNewSkillOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const { data: catalogData, isLoading: catalogLoading } = useQuery({ queryKey: ["skill-catalog"], queryFn: () => skillsApi.getCatalog() });
  const catalog: any[] = catalogData?.data?.data ?? [];

  const { data: matrixData, isLoading: matrixLoading } = useQuery({ queryKey: ["skills-matrix"], queryFn: () => skillsApi.getMatrix() });
  const matrix: any[] = matrixData?.data?.data ?? [];

  return (
    <Box>
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: "#0f172a", letterSpacing: "-0.02em" }}>Skills & Competency</Typography>
          <Typography variant="body2" sx={{ color: "#64748b", mt: 0.25 }}>Skill catalog and employee proficiency matrix</Typography>
        </Box>
        {canManage && (
          <Box sx={{ display: "flex", gap: 1 }}>
            {tab === 0 && <Button variant="contained" startIcon={<Add />} onClick={() => setNewSkillOpen(true)} sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>New Skill</Button>}
            {tab === 1 && <Button variant="contained" startIcon={<Add />} onClick={() => setAssignOpen(true)} sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>Assign Skill</Button>}
          </Box>
        )}
      </Box>

      <Card sx={{ borderRadius: "14px", boxShadow: "0 1px 8px rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.04)" }}>
        <Box sx={{ borderBottom: "1px solid #e2e8f0", px: 2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ "& .MuiTab-root": { textTransform: "none", fontWeight: 600 } }}>
            <Tab label="Catalog" />
            <Tab label="Matrix" />
          </Tabs>
        </Box>

        {tab === 0 && (
          <CardContent sx={{ p: "0 !important" }}>
            {catalogLoading ? <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={28} /></Box> : (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 700, color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", background: "#f8fafc" } }}>
                    <TableCell>Name</TableCell><TableCell>Category</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map(s => (
                    <TableRow key={s.id} hover>
                      <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem" }}>{s.name}</TableCell>
                      <TableCell sx={{ fontSize: "0.8rem" }}>{s.category ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                  {catalog.length === 0 && <TableRow><TableCell colSpan={2} align="center" sx={{ py: 4, color: "#94a3b8" }}>No skills in catalog yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </CardContent>
        )}

        {tab === 1 && (
          <CardContent sx={{ p: "0 !important" }}>
            {matrixLoading ? <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={28} /></Box> : (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 700, color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", background: "#f8fafc" } }}>
                    <TableCell>Employee</TableCell><TableCell>Skill</TableCell><TableCell>Proficiency</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {matrix.map((m: any) => (
                    <TableRow key={m.id} hover>
                      <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem" }}>{m.employee?.firstName} {m.employee?.lastName}</TableCell>
                      <TableCell sx={{ fontSize: "0.8rem" }}>{m.skill?.name}</TableCell>
                      <TableCell><Chip label={m.proficiency} size="small" color={proficiencyColor(m.proficiency)} sx={{ fontWeight: 600, fontSize: "0.7rem" }} /></TableCell>
                    </TableRow>
                  ))}
                  {matrix.length === 0 && <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4, color: "#94a3b8" }}>No skills assigned yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </CardContent>
        )}
      </Card>

      <NewSkillDialog open={newSkillOpen} onClose={() => setNewSkillOpen(false)} />
      <AssignSkillDialog open={assignOpen} onClose={() => setAssignOpen(false)} skills={catalog} />
    </Box>
  );
}
