import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Card, CardContent, Button, Chip, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody, Grid,
  FormControl, InputLabel, Select, MenuItem, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Checkbox, LinearProgress,
} from "@mui/material";
import { Add } from "@mui/icons-material";
import { toast } from "sonner";
import { checklistsApi, employeesApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

function NewTemplateDialog({ open, onClose, purpose }: { open: boolean; onClose: () => void; purpose: "ONBOARDING" | "OFFBOARDING" }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const mut = useMutation({
    mutationFn: () => checklistsApi.createTemplate({ purpose, name }),
    onSuccess: () => { toast.success("Template created"); qc.invalidateQueries({ queryKey: ["checklist-templates", purpose] }); onClose(); setName(""); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to create template"),
  });
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>New {purpose === "ONBOARDING" ? "Onboarding" : "Offboarding"} Template</DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
        <TextField fullWidth size="small" label="Template Name" value={name} onChange={e => setName(e.target.value)} />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button onClick={() => mut.mutate()} variant="contained" disabled={mut.isPending || !name} sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>Create</Button>
      </DialogActions>
    </Dialog>
  );
}

function AddTaskDialog({ templateId, onClose }: { templateId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const mut = useMutation({
    mutationFn: () => checklistsApi.createTemplateTask(templateId!, { title }),
    onSuccess: () => { toast.success("Task added"); qc.invalidateQueries({ queryKey: ["checklist-templates"] }); onClose(); setTitle(""); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to add task"),
  });
  return (
    <Dialog open={!!templateId} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Add Task</DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
        <TextField fullWidth size="small" label="Task Title" value={title} onChange={e => setTitle(e.target.value)} />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button onClick={() => mut.mutate()} variant="contained" disabled={mut.isPending || !title} sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>Add</Button>
      </DialogActions>
    </Dialog>
  );
}

function StartInstanceDialog({ open, onClose, purpose, templates }: { open: boolean; onClose: () => void; purpose: "ONBOARDING" | "OFFBOARDING"; templates: any[] }) {
  const qc = useQueryClient();
  const [employeeId, setEmployeeId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: empData } = useQuery({ queryKey: ["employees-for-checklist"], queryFn: () => employeesApi.getAll({ limit: 200 }), enabled: open });
  const employees: any[] = empData?.data?.data?.data ?? [];

  const mut = useMutation({
    mutationFn: () => checklistsApi.createInstance({ employeeId, templateId, startDate }),
    onSuccess: () => { toast.success(`${purpose === "ONBOARDING" ? "Onboarding" : "Offboarding"} started`); qc.invalidateQueries({ queryKey: ["checklist-instances", purpose] }); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to start checklist"),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Start {purpose === "ONBOARDING" ? "Onboarding" : "Offboarding"}</DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl fullWidth size="small">
              <InputLabel>Employee</InputLabel>
              <Select value={employeeId} label="Employee" onChange={e => setEmployeeId(e.target.value)}>
                {employees.map(e => <MenuItem key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth size="small">
              <InputLabel>Template</InputLabel>
              <Select value={templateId} label="Template" onChange={e => setTemplateId(e.target.value)}>
                {templates.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" type="date" label="Start Date" InputLabelProps={{ shrink: true }} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button onClick={() => mut.mutate()} variant="contained" disabled={mut.isPending || !employeeId || !templateId}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>Start</Button>
      </DialogActions>
    </Dialog>
  );
}

function InstanceDialog({ instanceId, onClose }: { instanceId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["checklist-instance", instanceId], queryFn: () => checklistsApi.getInstance(instanceId!), enabled: !!instanceId });
  const instance = data?.data?.data;

  const toggleMut = useMutation({
    mutationFn: ({ taskId, isDone }: { taskId: string; isDone: boolean }) => checklistsApi.updateInstanceTask(instanceId!, taskId, isDone),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["checklist-instance", instanceId] }); qc.invalidateQueries({ queryKey: ["checklist-instances"] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to update task"),
  });

  return (
    <Dialog open={!!instanceId} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {instance?.employee?.firstName} {instance?.employee?.lastName} — {instance?.template?.name}
      </DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
        {!instance ? <CircularProgress size={24} /> : (
          <Box>
            {instance.tasks?.map((t: any) => (
              <Box key={t.id} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Checkbox checked={t.isDone} onChange={e => toggleMut.mutate({ taskId: t.id, isDone: e.target.checked })} />
                <Typography sx={{ textDecoration: t.isDone ? "line-through" : "none", color: t.isDone ? "#94a3b8" : "#0f172a" }}>{t.title}</Typography>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", color: "#64748b" }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function ChecklistBoard({ purpose }: { purpose: "ONBOARDING" | "OFFBOARDING" }) {
  const role = useAuthStore(s => s.user?.role) ?? "";
  const canManage = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role);

  const [newTemplateOpen, setNewTemplateOpen] = useState(false);
  const [addTaskTemplateId, setAddTaskTemplateId] = useState<string | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [openInstanceId, setOpenInstanceId] = useState<string | null>(null);

  const { data: templateData, isLoading: templatesLoading } = useQuery({
    queryKey: ["checklist-templates", purpose],
    queryFn: () => checklistsApi.getTemplates(purpose),
  });
  const templates: any[] = templateData?.data?.data ?? [];

  const { data: instanceData, isLoading: instancesLoading } = useQuery({
    queryKey: ["checklist-instances", purpose],
    queryFn: () => checklistsApi.getInstances({ purpose }),
  });
  const instances: any[] = instanceData?.data?.data ?? [];

  return (
    <Box>
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: "#0f172a", letterSpacing: "-0.02em" }}>
            {purpose === "ONBOARDING" ? "Onboarding" : "Offboarding"}
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748b", mt: 0.25 }}>
            {purpose === "ONBOARDING" ? "New-hire checklists and templates" : "Exit checklists and templates"}
          </Typography>
        </Box>
        {canManage && (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" onClick={() => setNewTemplateOpen(true)} sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 600, borderColor: "#e2e8f0", color: "#475569" }}>New Template</Button>
            <Button variant="contained" startIcon={<Add />} onClick={() => setStartOpen(true)} disabled={templates.length === 0}
              sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>Start Checklist</Button>
          </Box>
        )}
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Card sx={{ borderRadius: "14px", boxShadow: "0 1px 8px rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.04)" }}>
            <CardContent sx={{ p: "0 !important" }}>
              <Typography sx={{ p: 2, fontWeight: 700, borderBottom: "1px solid #f1f5f9" }}>Active Checklists</Typography>
              {instancesLoading ? <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={28} /></Box> : (
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ "& th": { fontWeight: 700, color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", background: "#f8fafc" } }}>
                      <TableCell>Employee</TableCell><TableCell>Template</TableCell><TableCell>Progress</TableCell><TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {instances.map(i => {
                      const total = i.tasks?.length ?? 0;
                      const done = i.tasks?.filter((t: any) => t.isDone).length ?? 0;
                      return (
                        <TableRow key={i.id} hover onClick={() => setOpenInstanceId(i.id)} sx={{ cursor: "pointer" }}>
                          <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem" }}>{i.employee?.firstName} {i.employee?.lastName}</TableCell>
                          <TableCell sx={{ fontSize: "0.8rem" }}>{i.template?.name}</TableCell>
                          <TableCell sx={{ width: 120 }}>
                            <LinearProgress variant="determinate" value={total ? (done / total) * 100 : 0} sx={{ height: 6, borderRadius: 4 }} />
                            <Typography variant="caption" sx={{ color: "#94a3b8" }}>{done}/{total}</Typography>
                          </TableCell>
                          <TableCell><Chip label={i.status} size="small" color={i.status === "COMPLETED" ? "success" : "warning"} sx={{ fontWeight: 600, fontSize: "0.7rem" }} /></TableCell>
                        </TableRow>
                      );
                    })}
                    {instances.length === 0 && <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: "#94a3b8" }}>No checklists started yet</TableCell></TableRow>}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Card sx={{ borderRadius: "14px", boxShadow: "0 1px 8px rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.04)" }}>
            <CardContent sx={{ p: "0 !important" }}>
              <Typography sx={{ p: 2, fontWeight: 700, borderBottom: "1px solid #f1f5f9" }}>Templates</Typography>
              {templatesLoading ? <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={28} /></Box> : (
                <Box sx={{ p: 2 }}>
                  {templates.map(t => (
                    <Box key={t.id} sx={{ mb: 2, pb: 2, borderBottom: "1px solid #f1f5f9", "&:last-child": { borderBottom: 0, mb: 0, pb: 0 } }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Typography sx={{ fontWeight: 600, fontSize: "0.875rem" }}>{t.name}</Typography>
                        {canManage && <Button size="small" onClick={() => setAddTaskTemplateId(t.id)} sx={{ textTransform: "none", fontSize: "0.75rem" }}>+ Task</Button>}
                      </Box>
                      {t.tasks?.map((task: any) => (
                        <Typography key={task.id} variant="caption" sx={{ display: "block", color: "#64748b", pl: 1 }}>• {task.title}</Typography>
                      ))}
                    </Box>
                  ))}
                  {templates.length === 0 && <Typography variant="body2" sx={{ color: "#94a3b8" }}>No templates configured yet</Typography>}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <NewTemplateDialog open={newTemplateOpen} onClose={() => setNewTemplateOpen(false)} purpose={purpose} />
      <AddTaskDialog templateId={addTaskTemplateId} onClose={() => setAddTaskTemplateId(null)} />
      <StartInstanceDialog open={startOpen} onClose={() => setStartOpen(false)} purpose={purpose} templates={templates} />
      <InstanceDialog instanceId={openInstanceId} onClose={() => setOpenInstanceId(null)} />
    </Box>
  );
}
