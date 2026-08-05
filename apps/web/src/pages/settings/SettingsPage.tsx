import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Card, CardContent, TextField, Button, Grid,
  CircularProgress, Divider, Tabs, Tab, Table, TableHead, TableRow, TableCell, TableBody,
  FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
} from "@mui/material";
import { Settings as SettingsIcon, Business, Save, Add, Delete } from "@mui/icons-material";
import { toast } from "sonner";
import { settingsApi, approvalChainsApi, usersApi } from "@/lib/api";

type OrgForm = {
  name: string;
  uen: string;
  gstNo: string;
  email: string;
  phone: string;
  address: string;
};

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
      {icon}
      <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {children}
      </Typography>
    </Box>
  );
}

function OrganizationTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: () => settingsApi.get() });
  const org = data?.data?.data ?? {};

  const { register, handleSubmit, reset } = useForm<OrgForm>({
    defaultValues: { name: "", uen: "", gstNo: "", email: "", phone: "", address: "" },
  });

  useEffect(() => {
    if (org.name !== undefined) {
      reset({ name: org.name ?? "", uen: org.uen ?? "", gstNo: org.gstNo ?? "", email: org.email ?? "", phone: org.phone ?? "", address: org.address ?? "" });
    }
  }, [org.name]);

  const mutation = useMutation({
    mutationFn: (data: OrgForm) => settingsApi.update(data),
    onSuccess: () => { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["settings"] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to save settings"),
  });

  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}><CircularProgress /></Box>;

  return (
    <Box component="form" onSubmit={handleSubmit(d => mutation.mutate(d))}>
      <Card>
        <CardContent sx={{ p: 3 }}>
          <SectionLabel icon={<Business sx={{ color: "#64748b", fontSize: 18 }} />}>Organisation Details</SectionLabel>
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}><TextField label="Company Name" fullWidth required {...register("name")} placeholder="e.g. Sanko Construction Pte Ltd" /></Grid>
            <Grid item xs={12} md={6}><TextField label="UEN (Singapore)" fullWidth {...register("uen")} placeholder="e.g. 202300001A" helperText="Unique Entity Number issued by ACRA" /></Grid>
            <Grid item xs={12} md={6}><TextField label="GST Registration No." fullWidth {...register("gstNo")} placeholder="Leave blank if not GST-registered" /></Grid>
            <Grid item xs={12} md={6}><TextField label="Company Email" type="email" fullWidth {...register("email")} placeholder="billing@yourcompany.com" /></Grid>
            <Grid item xs={12} md={6}><TextField label="Phone" fullWidth {...register("phone")} placeholder="+65 XXXX XXXX" /></Grid>
            <Grid item xs={12}><TextField label="Registered Address" fullWidth multiline rows={2} {...register("address")} placeholder="e.g. 1 Business Park Ave, #01-01, Singapore 123456" /></Grid>
          </Grid>
        </CardContent>
      </Card>
      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
        <Button type="submit" variant="contained" disabled={mutation.isPending}
          startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <Save sx={{ fontSize: 16 }} />}
          sx={{ borderRadius: "10px", px: 3, textTransform: "none", fontWeight: 600 }}>
          Save Settings
        </Button>
      </Box>
    </Box>
  );
}

function SsoTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings-sso"], queryFn: () => settingsApi.getSso() });
  const sso = data?.data?.data;

  const [form, setForm] = useState({ provider: "OIDC", issuerUrl: "", clientId: "", clientSecret: "", enabled: false });
  useEffect(() => {
    if (sso) setForm({ provider: sso.provider ?? "OIDC", issuerUrl: sso.issuerUrl ?? "", clientId: sso.clientId ?? "", clientSecret: "", enabled: sso.enabled ?? false });
  }, [sso?.id]);
  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const mut = useMutation({
    mutationFn: () => settingsApi.updateSso(form),
    onSuccess: () => { toast.success("SSO configuration saved"); qc.invalidateQueries({ queryKey: ["settings-sso"] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to save SSO config"),
  });

  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}><CircularProgress /></Box>;

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <SectionLabel icon={<SettingsIcon sx={{ color: "#64748b", fontSize: 18 }} />}>Enterprise SSO</SectionLabel>
        <Typography variant="body2" sx={{ color: "#64748b", mb: 2.5 }}>
          Federate Employer-persona logins with an OIDC/SAML identity provider. Stays disabled until you provide real IdP credentials and turn it on.
        </Typography>
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Provider</InputLabel>
              <Select value={form.provider} label="Provider" onChange={e => set("provider", e.target.value)}>
                <MenuItem value="OIDC">OIDC</MenuItem>
                <MenuItem value="SAML">SAML</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={8}><TextField label="Issuer URL" fullWidth value={form.issuerUrl} onChange={e => set("issuerUrl", e.target.value)} /></Grid>
          <Grid item xs={12} md={6}><TextField label="Client ID" fullWidth value={form.clientId} onChange={e => set("clientId", e.target.value)} /></Grid>
          <Grid item xs={12} md={6}>
            <TextField label="Client Secret" fullWidth type="password" value={form.clientSecret} onChange={e => set("clientSecret", e.target.value)}
              placeholder={sso?.hasClientSecret ? "•••••••• (leave blank to keep current)" : ""} />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel control={<Switch checked={form.enabled} onChange={e => set("enabled", e.target.checked)} />} label="Enabled" />
          </Grid>
        </Grid>
      </CardContent>
      <Box sx={{ px: 3, pb: 3, display: "flex", justifyContent: "flex-end" }}>
        <Button variant="contained" disabled={mut.isPending} onClick={() => mut.mutate()} sx={{ borderRadius: "10px", px: 3, textTransform: "none", fontWeight: 600 }}>Save</Button>
      </Box>
    </Card>
  );
}

function NewSchemeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ code: "", name: "", strategy: "FLAT_RATE", employeeRate: 0, employerRate: 0, wageCeiling: 0 });
  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const mut = useMutation({
    mutationFn: () => settingsApi.createStatutoryScheme(form),
    onSuccess: () => { toast.success("Statutory scheme created"); qc.invalidateQueries({ queryKey: ["settings-statutory-schemes"] }); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to create scheme"),
  });
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>New Statutory Scheme</DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
        <Grid container spacing={2}>
          <Grid item xs={6}><TextField fullWidth size="small" label="Code" value={form.code} onChange={e => set("code", e.target.value)} /></Grid>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Strategy</InputLabel>
              <Select value={form.strategy} label="Strategy" onChange={e => set("strategy", e.target.value)}>
                <MenuItem value="FLAT_RATE">Flat Rate</MenuItem>
                <MenuItem value="SG_CPF">SG CPF (built-in graduated rates)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}><TextField fullWidth size="small" label="Name" value={form.name} onChange={e => set("name", e.target.value)} /></Grid>
          {form.strategy === "FLAT_RATE" && (
            <>
              <Grid item xs={4}><TextField fullWidth size="small" type="number" label="Employee %" inputProps={{ step: "0.01" }} value={form.employeeRate} onChange={e => set("employeeRate", Number(e.target.value))} /></Grid>
              <Grid item xs={4}><TextField fullWidth size="small" type="number" label="Employer %" inputProps={{ step: "0.01" }} value={form.employerRate} onChange={e => set("employerRate", Number(e.target.value))} /></Grid>
              <Grid item xs={4}><TextField fullWidth size="small" type="number" label="Wage Ceiling" value={form.wageCeiling} onChange={e => set("wageCeiling", Number(e.target.value))} /></Grid>
            </>
          )}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button onClick={() => mut.mutate()} variant="contained" disabled={mut.isPending || !form.code || !form.name}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>Create</Button>
      </DialogActions>
    </Dialog>
  );
}

function StatutorySchemesTab() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["settings-statutory-schemes"], queryFn: () => settingsApi.getStatutorySchemes() });
  const schemes: any[] = data?.data?.data ?? [];

  return (
    <Card>
      <CardContent sx={{ p: "0 !important" }}>
        <Box sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9" }}>
          <SectionLabel icon={<SettingsIcon sx={{ color: "#64748b", fontSize: 18 }} />}>Statutory Contribution Schemes</SectionLabel>
          <Button size="small" variant="contained" startIcon={<Add />} onClick={() => setOpen(true)} sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>New Scheme</Button>
        </Box>
        {isLoading ? <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={24} /></Box> : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", background: "#f8fafc" } }}>
                <TableCell>Code</TableCell><TableCell>Name</TableCell><TableCell>Strategy</TableCell>
                <TableCell align="right">Employee %</TableCell><TableCell align="right">Employer %</TableCell><TableCell>Active</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {schemes.map(s => (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem" }}>{s.code}</TableCell>
                  <TableCell sx={{ fontSize: "0.8rem" }}>{s.name}</TableCell>
                  <TableCell><Chip label={s.strategy} size="small" sx={{ fontWeight: 600, fontSize: "0.7rem" }} /></TableCell>
                  <TableCell align="right">{s.employeeRate != null ? `${(Number(s.employeeRate) * 100).toFixed(1)}%` : "—"}</TableCell>
                  <TableCell align="right">{s.employerRate != null ? `${(Number(s.employerRate) * 100).toFixed(1)}%` : "—"}</TableCell>
                  <TableCell><Chip label={s.isActive ? "Active" : "Inactive"} size="small" color={s.isActive ? "success" : "default"} sx={{ fontWeight: 600, fontSize: "0.7rem" }} /></TableCell>
                </TableRow>
              ))}
              {schemes.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: "#94a3b8" }}>No statutory schemes configured yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <NewSchemeDialog open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}

function NewChainDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [entityType, setEntityType] = useState("LeaveRequest");
  const [steps, setSteps] = useState<Array<{ approverUserId: string }>>([{ approverUserId: "" }]);

  const { data: usersData } = useQuery({ queryKey: ["users-for-approval-chain"], queryFn: () => usersApi.list({ limit: 200 }), enabled: open });
  const users: any[] = usersData?.data?.data?.data ?? usersData?.data?.data ?? [];

  const mut = useMutation({
    mutationFn: () => approvalChainsApi.create({
      name, entityType,
      steps: steps.filter(s => s.approverUserId).map((s, i) => ({ stepOrder: i + 1, approverUserId: s.approverUserId, required: true })),
    }),
    onSuccess: () => { toast.success("Approval chain created"); qc.invalidateQueries({ queryKey: ["approval-chains"] }); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to create approval chain"),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>New Approval Chain</DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
        <Grid container spacing={2}>
          <Grid item xs={6}><TextField fullWidth size="small" label="Name" value={name} onChange={e => setName(e.target.value)} /></Grid>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Entity Type</InputLabel>
              <Select value={entityType} label="Entity Type" onChange={e => setEntityType(e.target.value)}>
                <MenuItem value="LeaveRequest">Leave Request</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="caption" sx={{ color: "#94a3b8", fontWeight: 600 }}>APPROVAL STEPS (IN ORDER)</Typography>
            {steps.map((s, i) => (
              <Box key={i} sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1 }}>
                <Typography variant="caption" sx={{ width: 20, color: "#64748b" }}>{i + 1}.</Typography>
                <FormControl fullWidth size="small">
                  <InputLabel>Approver</InputLabel>
                  <Select value={s.approverUserId} label="Approver" onChange={e => setSteps(p => p.map((x, idx) => idx === i ? { approverUserId: e.target.value } : x))}>
                    {users.map(u => <MenuItem key={u.id} value={u.id}>{u.email}</MenuItem>)}
                  </Select>
                </FormControl>
                <IconButton size="small" onClick={() => setSteps(p => p.filter((_, idx) => idx !== i))} disabled={steps.length === 1}>
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Button size="small" onClick={() => setSteps(p => [...p, { approverUserId: "" }])} sx={{ mt: 1, textTransform: "none" }}>+ Add Step</Button>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button onClick={() => mut.mutate()} variant="contained" disabled={mut.isPending || !name || !steps.some(s => s.approverUserId)}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>Create</Button>
      </DialogActions>
    </Dialog>
  );
}

function ApprovalChainsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["approval-chains"], queryFn: () => approvalChainsApi.getAll() });
  const chains: any[] = data?.data?.data ?? [];

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => approvalChainsApi.update(id, { isActive }),
    onSuccess: () => { toast.success("Chain updated"); qc.invalidateQueries({ queryKey: ["approval-chains"] }); },
  });

  return (
    <Card>
      <CardContent sx={{ p: "0 !important" }}>
        <Box sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9" }}>
          <Box>
            <SectionLabel icon={<SettingsIcon sx={{ color: "#64748b", fontSize: 18 }} />}>Approval Chains</SectionLabel>
            <Typography variant="body2" sx={{ color: "#64748b", mt: -1.5 }}>Configure a multi-step approval chain for Leave requests. No chain configured = the existing single-step approve/reject flow.</Typography>
          </Box>
          <Button size="small" variant="contained" startIcon={<Add />} onClick={() => setOpen(true)} sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>New Chain</Button>
        </Box>
        {isLoading ? <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={24} /></Box> : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", background: "#f8fafc" } }}>
                <TableCell>Name</TableCell><TableCell>Entity</TableCell><TableCell>Steps</TableCell><TableCell>Active</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {chains.map(c => (
                <TableRow key={c.id} hover>
                  <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem" }}>{c.name}</TableCell>
                  <TableCell sx={{ fontSize: "0.8rem" }}>{c.entityType}</TableCell>
                  <TableCell sx={{ fontSize: "0.8rem" }}>{c.steps?.length ?? 0}</TableCell>
                  <TableCell>
                    <Switch checked={c.isActive} size="small" onChange={e => toggleMut.mutate({ id: c.id, isActive: e.target.checked })} />
                  </TableCell>
                </TableRow>
              ))}
              {chains.length === 0 && <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: "#94a3b8" }}>No approval chains configured yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <NewChainDialog open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}

function PresetsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings-presets"], queryFn: () => settingsApi.getPresets() });
  const presets: any[] = data?.data?.data ?? [];

  const applyMut = useMutation({
    mutationFn: (presetKey: string) => settingsApi.applyPreset(presetKey),
    onSuccess: () => { toast.success("Preset applied"); qc.invalidateQueries({ queryKey: ["settings"] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to apply preset"),
  });

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <SectionLabel icon={<SettingsIcon sx={{ color: "#64748b", fontSize: 18 }} />}>Industry Presets</SectionLabel>
        <Typography variant="body2" sx={{ color: "#64748b", mb: 2.5 }}>
          Seed default leave policies, custom fields, roles, and statutory schemes for your industry vertical. Safe to re-apply.
        </Typography>
        {isLoading ? <CircularProgress size={24} /> : (
          <Grid container spacing={2}>
            {presets.map(p => (
              <Grid item xs={12} sm={6} key={p.key}>
                <Card variant="outlined" sx={{ borderRadius: "10px" }}>
                  <CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography sx={{ fontWeight: 600, fontSize: "0.875rem" }}>{p.name}</Typography>
                    <Button size="small" variant="outlined" disabled={applyMut.isPending} onClick={() => applyMut.mutate(p.key)} sx={{ textTransform: "none", borderRadius: "8px" }}>Apply</Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ maxWidth: 900 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Box sx={{ width: 44, height: 44, borderRadius: "12px", backgroundColor: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <SettingsIcon sx={{ fontSize: 22, color: "#059669" }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>Settings</Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>Organisation, identity, and platform configuration</Typography>
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2.5, borderBottom: "1px solid #e2e8f0", "& .MuiTab-root": { textTransform: "none", fontWeight: 600 } }}>
        <Tab label="Organization" />
        <Tab label="SSO" />
        <Tab label="Statutory Schemes" />
        <Tab label="Approval Chains" />
        <Tab label="Presets" />
      </Tabs>

      {tab === 0 && <OrganizationTab />}
      {tab === 1 && <SsoTab />}
      {tab === 2 && <StatutorySchemesTab />}
      {tab === 3 && <ApprovalChainsTab />}
      {tab === 4 && <PresetsTab />}
    </Box>
  );
}
