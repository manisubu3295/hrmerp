import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Typography, TextField, Select, MenuItem,
  FormControl, InputLabel, Grid, CircularProgress, FormHelperText,
} from "@mui/material";
import { ArrowBack, AttachMoney } from "@mui/icons-material";
import { toast } from "sonner";
import { expensesApi, projectsApi } from "@/lib/api";

// Must match the ExpenseCategory enum in packages/database/prisma/schema.prisma
// (and packages/shared/src/enums.ts) — the API rejects any other value.
const CATEGORIES = ["TRANSPORT", "MEALS", "MATERIALS", "SUB_CONTRACTOR", "PERMITS", "ACCOMMODATION", "MISCELLANEOUS"];

const schema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().min(0.01, "Amount must be > 0"),
  category: z.string().min(1, "Category is required"),
  projectId: z.string().min(1, "Project is required"),
  expenseDate: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const CATEGORY_ICONS: Record<string, string> = {
  TRANSPORT: "🚗", ACCOMMODATION: "🏨", MATERIALS: "🔧", MEALS: "🍽️",
  SUB_CONTRACTOR: "🏢", PERMITS: "📋", MISCELLANEOUS: "📌",
};

function SectionLabel({ children }: { children: string }) {
  return <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>{children}</Typography>;
}

export default function NewExpensePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: projectsData } = useQuery({ queryKey: ["projects-list"], queryFn: () => projectsApi.getAll({ limit: 100 }) });
  const projects = Array.isArray(projectsData?.data?.data?.data) ? projectsData.data.data.data : [];

  const { control, register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { expenseDate: new Date().toISOString().split("T")[0] },
  });

  const mutation = useMutation({
    // API's Expense model stores this as `date`; the form field is named
    // `expenseDate` to distinguish it from the JS Date type in this component.
    mutationFn: (data: FormData) => expensesApi.create({ ...data, date: data.expenseDate }),
    onSuccess: () => { toast.success("Expense logged"); qc.invalidateQueries({ queryKey: ["expenses"] }); navigate("/expenses"); },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Failed to log expense"),
  });

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBack sx={{ fontSize: 16 }} />} onClick={() => navigate("/expenses")} variant="text" size="small" sx={{ color: "#64748b" }}>Back</Button>
        <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <AttachMoney sx={{ fontSize: 20, color: "#dc2626" }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>Log Expense</Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>Record a project or company expense</Typography>
        </Box>
      </Box>

      <Box component="form" onSubmit={handleSubmit(d => mutation.mutate(d))}>
        <Grid container spacing={2.5} sx={{ maxWidth: 720 }}>
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <SectionLabel>Expense Details</SectionLabel>
                <Grid container spacing={2.5}>
                  <Grid item xs={12}>
                    <TextField label="Description" fullWidth {...register("description")} error={!!errors.description} helperText={errors.description?.message} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Amount (SGD)" type="number" fullWidth {...register("amount")} error={!!errors.amount} helperText={errors.amount?.message} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }} {...register("expenseDate")} error={!!errors.expenseDate} helperText={errors.expenseDate?.message} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth error={!!errors.category}>
                      <InputLabel>Category</InputLabel>
                      <Controller name="category" control={control} defaultValue="" render={({ field }) => (
                        <Select {...field} label="Category">
                          {CATEGORIES.map(c => (
                            <MenuItem key={c} value={c}>{CATEGORY_ICONS[c] ?? "📌"} {c}</MenuItem>
                          ))}
                        </Select>
                      )} />
                      {errors.category && <FormHelperText>{errors.category.message}</FormHelperText>}
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth error={!!errors.projectId}>
                      <InputLabel>Project</InputLabel>
                      <Controller name="projectId" control={control} defaultValue="" render={({ field }) => (
                        <Select {...field} label="Project">
                          {projects.map((p: any) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                        </Select>
                      )} />
                      {errors.projectId && <FormHelperText>{errors.projectId.message}</FormHelperText>}
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField label="Notes" fullWidth multiline rows={2} {...register("notes")} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
              <Button variant="text" onClick={() => navigate("/expenses")} sx={{ color: "#64748b" }}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={mutation.isPending} sx={{ borderRadius: "10px", px: 3 }}>
                {mutation.isPending ? <CircularProgress size={18} color="inherit" /> : "Log Expense"}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
