import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Typography, TextField, Select, MenuItem,
  FormControl, InputLabel, Grid, CircularProgress, FormHelperText,
  InputAdornment, Divider, Alert, Chip, Skeleton,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  ArrowBack, FolderSpecial, Business, CalendarToday, AttachMoney,
  LocationOn, Notes, TrendingUp, Inventory2, SaveOutlined, Edit,
} from "@mui/icons-material";
import { toast } from "sonner";
import { projectsApi, clientsApi } from "@/lib/api";
import { getStatusChipColor } from "@/lib/utils";

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
  status: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const PROJECT_STATUSES = [
  { value: "DRAFT",     label: "Draft",     color: "#64748b" },
  { value: "ACTIVE",    label: "Active",    color: "#059669" },
  { value: "ON_HOLD",   label: "On Hold",   color: "#d97706" },
  { value: "COMPLETED", label: "Completed", color: "#0891b2" },
  { value: "CANCELLED", label: "Cancelled", color: "#dc2626" },
];

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

function toDateInput(val?: string | null): string {
  if (!val) return "";
  return new Date(val).toISOString().split("T")[0] ?? "";
}

export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => projectsApi.get(id!),
    enabled: !!id,
  });
  const { data: clientsData } = useQuery({
    queryKey: ["clients-list"],
    queryFn: () => clientsApi.getAll({ limit: 200 }),
  });

  const p = projectData?.data?.data ?? projectData?.data ?? {};
  const clients: any[] = Array.isArray(clientsData?.data?.data?.data)
    ? clientsData.data.data.data
    : Array.isArray(clientsData?.data?.data)
    ? clientsData.data.data
    : [];

  const { control, register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (p?.id) {
      reset({
        name: p.name ?? "",
        description: p.description ?? "",
        clientId: p.clientId ?? "",
        startDate: toDateInput(p.startDate),
        endDate: toDateInput(p.endDate),
        quotedBudget: Number(p.quotedBudget ?? 0),
        targetMargin: Number(p.targetMargin ?? 0.15) * 100,
        overheadPercent: Number(p.overheadPercent ?? 0) * 100,
        location: p.location ?? "",
        notes: p.notes ?? "",
        status: p.status ?? "DRAFT",
      });
    }
  }, [p?.id, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Status changes go through the dedicated endpoint (it stamps
      // actualEndDate on COMPLETED and emits a 'project.completed' event) —
      // the generic update below no longer accepts status at all.
      const { status, ...rest } = data;
      if (status && status !== p.status) {
        await projectsApi.updateStatus(id!, status);
      }
      const payload = {
        ...rest,
        targetMargin: (data.targetMargin ?? 15) / 100,
        overheadPercent: (data.overheadPercent ?? 0) / 100,
      };
      return projectsApi.update(id!, payload);
    },
    onSuccess: () => {
      toast.success("Project updated successfully");
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      navigate(`/projects/${id}`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Failed to update project"),
  });

  if (projectLoading) {
    return (
      <Box sx={{ maxWidth: 860, mx: "auto" }}>
        <Skeleton variant="rectangular" height={60} sx={{ borderRadius: "12px", mb: 3 }} />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rectangular" height={180} sx={{ borderRadius: "12px", mb: 3 }} />
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 860, mx: "auto" }}>
      {/* ── Page header ── */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
        <Button
          startIcon={<ArrowBack sx={{ fontSize: 15 }} />}
          onClick={() => navigate(`/projects/${id}`)}
          variant="text"
          size="small"
          sx={{ color: "#64748b", fontWeight: 600, "&:hover": { backgroundColor: "#f1f5f9" } }}
        >
          Project
        </Button>
        <Box sx={{ width: 1, height: 18, backgroundColor: "#e2e8f0" }} />
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: "12px", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(124,58,237,0.35)" }}>
            <Edit sx={{ fontSize: 20, color: "#fff" }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Typography sx={{ fontSize: "1.375rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em", lineHeight: 1.2 }}>
                Edit Project
              </Typography>
              {p.status && (
                <Chip
                  label={p.status.replace("_", " ")}
                  color={getStatusChipColor(p.status)}
                  size="small"
                  sx={{ fontWeight: 700, fontSize: "0.6875rem" }}
                />
              )}
            </Box>
            <Typography sx={{ fontSize: "0.8125rem", color: "#64748b", mt: 0.25 }}>
              {p.projectCode} — last updated {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
            </Typography>
          </Box>
        </Box>
        <Button
          variant="outlined"
          startIcon={<FolderSpecial sx={{ fontSize: 15 }} />}
          size="small"
          onClick={() => navigate(`/projects/${id}`)}
          sx={{ borderRadius: "8px", color: "#64748b", borderColor: "#e2e8f0", fontWeight: 600 }}
        >
          View Project
        </Button>
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
                    InputLabelProps={{ shrink: true }}
                    {...register("name")}
                    error={!!errors.name}
                    helperText={errors.name?.message}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth error={!!errors.clientId}>
                    <InputLabel shrink>Client *</InputLabel>
                    <Controller
                      name="clientId"
                      control={control}
                      render={({ field }) => (
                        <Select {...field} label="Client *" notched>
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
                    InputLabelProps={{ shrink: true }}
                    InputProps={{ startAdornment: <InputAdornment position="start" sx={{ alignSelf: "flex-start", mt: 1.5 }}><Notes sx={{ fontSize: 16, color: "#94a3b8" }} /></InputAdornment> }}
                    {...register("description")}
                  />
                </Grid>
              </Grid>
            </FormSection>
          </Grid>

          {/* ── Section 2: Status ── */}
          <Grid item xs={12}>
            <FormSection icon={<Edit sx={{ fontSize: 18 }} />} title="Project Status" subtitle="Current state of this project" accent="#ea580c">
              <Grid container spacing={2.5}>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel shrink>Status</InputLabel>
                    <Controller
                      name="status"
                      control={control}
                      render={({ field }) => (
                        <Select {...field} label="Status" notched>
                          {PROJECT_STATUSES.map((s) => (
                            <MenuItem key={s.value} value={s.value}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: s.color }} />
                                <Typography sx={{ fontSize: "0.875rem", fontWeight: 500 }}>{s.label}</Typography>
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      )}
                    />
                  </FormControl>
                </Grid>
              </Grid>
            </FormSection>
          </Grid>

          {/* ── Section 3: Timeline ── */}
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
                    helperText={errors.startDate?.message}
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
                    helperText={errors.endDate?.message ?? "Leave blank if not yet confirmed."}
                  />
                </Grid>
              </Grid>
            </FormSection>
          </Grid>

          {/* ── Section 4: Financials ── */}
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
                    helperText={errors.quotedBudget?.message}
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
                  />
                </Grid>
              </Grid>
            </FormSection>
          </Grid>

          {/* ── Section 5: Notes ── */}
          <Grid item xs={12}>
            <FormSection icon={<Notes sx={{ fontSize: 18 }} />} title="Internal Notes" subtitle="Visible to team members only" accent="#64748b">
              <TextField
                label="Notes"
                fullWidth
                multiline
                rows={3}
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
              {isDirty && (
                <Typography sx={{ fontSize: "0.75rem", color: "#f59e0b", fontWeight: 600, mr: 1 }}>
                  Unsaved changes
                </Typography>
              )}
              <Button
                variant="outlined"
                onClick={() => navigate(`/projects/${id}`)}
                sx={{ borderRadius: "10px", px: 3, color: "#64748b", borderColor: "#e2e8f0", "&:hover": { borderColor: "#cbd5e1", backgroundColor: "#f8fafc" } }}
              >
                Discard
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={mutation.isPending}
                startIcon={mutation.isPending ? undefined : <SaveOutlined sx={{ fontSize: 17 }} />}
                sx={{ borderRadius: "10px", px: 4, py: 1.25, fontWeight: 700, fontSize: "0.9375rem", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", boxShadow: "0 4px 14px rgba(124,58,237,0.35)", "&:hover": { background: "linear-gradient(135deg, #6d28d9, #5b21b6)" }, "&:disabled": { background: "#e2e8f0" } }}
              >
                {mutation.isPending ? <CircularProgress size={18} color="inherit" /> : "Save Changes"}
              </Button>
            </Box>
          </Grid>

        </Grid>
      </Box>
    </Box>
  );
}
