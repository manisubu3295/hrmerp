import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Typography, TextField, Select, MenuItem,
  FormControl, InputLabel, Grid, CircularProgress, FormHelperText, InputAdornment, Divider, Alert,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  ArrowBack, FolderSpecial, Business, CalendarToday, AttachMoney,
  LocationOn, Notes, TrendingUp, Inventory2, CheckCircleOutline,
} from "@mui/icons-material";
import { toast } from "sonner";
import { projectsApi, clientsApi } from "@/lib/api";

const schema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  clientId: z.string().min(1, "Client is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  quotedBudget: z.coerce.number().min(0, "Budget must be 0 or greater"),
  targetMargin: z.coerce.number().min(0).max(100).optional(),
  overheadPercent: z.coerce.number().min(0).max(100).optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function FormSection({
  icon, title, subtitle, accent = "#2563eb", children,
}: {
  icon: React.ReactNode; title: string; subtitle?: string; accent?: string; children: React.ReactNode;
}) {
  return (
    <Card sx={{ overflow: "visible", border: "1px solid #e2e8f0", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
      <Box sx={{ px: 3, pt: 2.5, pb: 2, display: "flex", alignItems: "center", gap: 2, borderBottom: "1px solid #f1f5f9" }}>
        <Box sx={{ width: 38, height: 38, borderRadius: "10px", backgroundColor: alpha(accent, 0.1), border: `1.5px solid ${alpha(accent, 0.2)}`, display: "flex", alignItems: "center", justifyContent: "center", color: accent, flexShrink: 0 }}>
          {icon}
        </Box>
        <Box>
          <Typography sx={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>{title}</Typography>
          {subtitle && <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8", mt: 0.125 }}>{subtitle}</Typography>}
        </Box>
      </Box>
      <CardContent sx={{ p: 3 }}>{children}</CardContent>
    </Card>
  );
}

export default function NewProjectPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: clientsData } = useQuery({
    queryKey: ["clients-list"],
    queryFn: () => clientsApi.getAll({ limit: 200 }),
  });
  const clients: any[] = Array.isArray(clientsData?.data?.data?.data)
    ? clientsData.data.data.data
    : Array.isArray(clientsData?.data?.data)
    ? clientsData.data.data
    : [];

  const { control, register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { quotedBudget: 0, targetMargin: 15, overheadPercent: 0 },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        ...data,
        targetMargin: (data.targetMargin ?? 15) / 100,
        overheadPercent: (data.overheadPercent ?? 0) / 100,
      };
      return projectsApi.create(payload);
    },
    onSuccess: (res) => {
      toast.success("Project created successfully");
      qc.invalidateQueries({ queryKey: ["projects"] });
      const id = res?.data?.data?.id;
      navigate(id ? `/projects/${id}` : "/projects");
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Failed to create project"),
  });

  return (
    <Box sx={{ maxWidth: 860, mx: "auto" }}>
      {/* ── Page header ── */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
        <Button
          startIcon={<ArrowBack sx={{ fontSize: 15 }} />}
          onClick={() => navigate("/projects")}
          variant="text"
          size="small"
          sx={{ color: "#64748b", fontWeight: 600, "&:hover": { backgroundColor: "#f1f5f9" } }}
        >
          Projects
        </Button>
        <Box sx={{ width: 1, height: 18, backgroundColor: "#e2e8f0" }} />
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: "12px", background: "linear-gradient(135deg, #2563eb, #1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(37,99,235,0.35)" }}>
            <FolderSpecial sx={{ fontSize: 22, color: "#fff" }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "1.375rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em", lineHeight: 1.2 }}>
              New Project
            </Typography>
            <Typography sx={{ fontSize: "0.8125rem", color: "#64748b", mt: 0.25 }}>
              Set up a new project, assign a client and configure the budget.
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box component="form" onSubmit={handleSubmit(d => mutation.mutate(d))}>
        <Grid container spacing={3}>

          {/* ── Section 1: Identity ── */}
          <Grid item xs={12}>
            <FormSection icon={<FolderSpecial sx={{ fontSize: 18 }} />} title="Project Identity" subtitle="Name, client and work location">
              <Grid container spacing={2.5}>
                <Grid item xs={12}>
                  <TextField
                    label="Project Name"
                    fullWidth
                    placeholder="e.g. Marina Bay Electrical Works Phase 2"
                    {...register("name")}
                    error={!!errors.name}
                    helperText={errors.name?.message ?? "Choose a clear, descriptive name for this engagement."}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth error={!!errors.clientId}>
                    <InputLabel shrink>Client *</InputLabel>
                    <Controller
                      name="clientId"
                      control={control}
                      defaultValue=""
                      render={({ field }) => (
                        <Select {...field} label="Client *" notched displayEmpty>
                          <MenuItem value="" disabled>
                            <Typography sx={{ color: "#94a3b8", fontSize: "0.875rem" }}>Select a client…</Typography>
                          </MenuItem>
                          {clients.map((c: any) => (
                            <MenuItem key={c.id} value={c.id}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                                <Box sx={{ width: 28, height: 28, borderRadius: "7px", backgroundColor: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <Business sx={{ fontSize: 14, color: "#2563eb" }} />
                                </Box>
                                <Typography sx={{ fontSize: "0.875rem", fontWeight: 500 }}>{c.name}</Typography>
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      )}
                    />
                    {errors.clientId && <FormHelperText>{errors.clientId.message}</FormHelperText>}
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Site / Location"
                    fullWidth
                    placeholder="e.g. 1 Marina Boulevard, Singapore"
                    InputLabelProps={{ shrink: true }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><LocationOn sx={{ fontSize: 16, color: "#94a3b8" }} /></InputAdornment> }}
                    {...register("location")}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Project Description"
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="Describe the scope of work, key deliverables, or any relevant context…"
                    InputLabelProps={{ shrink: true }}
                    InputProps={{ startAdornment: <InputAdornment position="start" sx={{ alignSelf: "flex-start", mt: 1.5 }}><Notes sx={{ fontSize: 16, color: "#94a3b8" }} /></InputAdornment> }}
                    {...register("description")}
                  />
                </Grid>
              </Grid>
            </FormSection>
          </Grid>

          {/* ── Section 2: Timeline ── */}
          <Grid item xs={12}>
            <FormSection icon={<CalendarToday sx={{ fontSize: 18 }} />} title="Timeline" subtitle="Project schedule and key dates" accent="#7c3aed">
              <Grid container spacing={2.5}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Start Date *"
                    type="date"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    {...register("startDate")}
                    error={!!errors.startDate}
                    helperText={errors.startDate?.message ?? "Date work is scheduled to begin."}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Expected End Date"
                    type="date"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    {...register("endDate")}
                    error={!!errors.endDate}
                    helperText={errors.endDate?.message ?? "Leave blank if the end date is not yet confirmed."}
                  />
                </Grid>
              </Grid>
            </FormSection>
          </Grid>

          {/* ── Section 3: Financials ── */}
          <Grid item xs={12}>
            <FormSection icon={<AttachMoney sx={{ fontSize: 18 }} />} title="Financials" subtitle="Contract value, margin targets and overhead" accent="#059669">
              <Grid container spacing={2.5}>
                <Grid item xs={12} md={5}>
                  <TextField
                    label="Quoted Budget (SGD) *"
                    type="number"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: "0.875rem", color: "#64748b", fontWeight: 600 }}>S$</Typography></InputAdornment> }}
                    inputProps={{ min: 0, step: 100 }}
                    {...register("quotedBudget")}
                    error={!!errors.quotedBudget}
                    helperText={errors.quotedBudget?.message ?? "Total contract value quoted to the client."}
                  />
                </Grid>
                <Grid item xs={12} md={3.5}>
                  <TextField
                    label="Target Margin (%)"
                    type="number"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    InputProps={{ endAdornment: <InputAdornment position="end"><TrendingUp sx={{ fontSize: 16, color: "#059669" }} /></InputAdornment> }}
                    inputProps={{ min: 0, max: 100, step: 0.5 }}
                    {...register("targetMargin")}
                    error={!!errors.targetMargin}
                    helperText="Default: 15%"
                  />
                </Grid>
                <Grid item xs={12} md={3.5}>
                  <TextField
                    label="Overhead (%)"
                    type="number"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    InputProps={{ endAdornment: <InputAdornment position="end"><Inventory2 sx={{ fontSize: 16, color: "#94a3b8" }} /></InputAdornment> }}
                    inputProps={{ min: 0, max: 100, step: 0.5 }}
                    {...register("overheadPercent")}
                    error={!!errors.overheadPercent}
                    helperText="Default: 0%"
                  />
                </Grid>
              </Grid>
            </FormSection>
          </Grid>

          {/* ── Section 4: Notes ── */}
          <Grid item xs={12}>
            <FormSection icon={<Notes sx={{ fontSize: 18 }} />} title="Internal Notes" subtitle="Visible to team members only" accent="#64748b">
              <TextField
                label="Notes"
                fullWidth
                multiline
                rows={3}
                placeholder="Any internal notes, assumptions, risks, or conditions relevant to this project…"
                InputLabelProps={{ shrink: true }}
                {...register("notes")}
              />
            </FormSection>
          </Grid>

          {/* ── Action bar ── */}
          <Grid item xs={12}>
            <Divider sx={{ mb: 3 }} />
            {mutation.isError && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: "10px" }}>
                {(mutation.error as any)?.response?.data?.message ?? "Something went wrong. Please try again."}
              </Alert>
            )}
            <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end", alignItems: "center" }}>
              <Button
                variant="outlined"
                onClick={() => navigate("/projects")}
                sx={{ borderRadius: "10px", px: 3, color: "#64748b", borderColor: "#e2e8f0", "&:hover": { borderColor: "#cbd5e1", backgroundColor: "#f8fafc" } }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={mutation.isPending}
                startIcon={mutation.isPending ? undefined : <CheckCircleOutline sx={{ fontSize: 17 }} />}
                sx={{ borderRadius: "10px", px: 4, py: 1.25, fontWeight: 700, fontSize: "0.9375rem", background: "linear-gradient(135deg, #2563eb, #1d4ed8)", boxShadow: "0 4px 14px rgba(37,99,235,0.35)", "&:hover": { background: "linear-gradient(135deg, #1d4ed8, #1e40af)" }, "&:disabled": { background: "#e2e8f0" } }}
              >
                {mutation.isPending ? <CircularProgress size={18} color="inherit" /> : "Create Project"}
              </Button>
            </Box>
          </Grid>

        </Grid>
      </Box>
    </Box>
  );
}
