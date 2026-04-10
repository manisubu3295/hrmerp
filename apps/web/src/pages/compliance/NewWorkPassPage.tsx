import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Typography, TextField, Select, MenuItem,
  FormControl, InputLabel, Grid, CircularProgress, FormHelperText,
} from "@mui/material";
import { ArrowBack, Badge } from "@mui/icons-material";
import { toast } from "sonner";
import { complianceApi, employeesApi } from "@/lib/api";

const PASS_TYPES = ["EP", "SP", "WP", "LTVP", "DP", "STP", "PEP", "OTHER"];

const schema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  passType: z.string().min(1, "Pass type is required"),
  passNumber: z.string().min(1, "Pass number is required"),
  issueDate: z.string().min(1, "Issue date is required"),
  expiryDate: z.string().min(1, "Expiry date is required"),
});
type FormData = z.infer<typeof schema>;

function SectionLabel({ children }: { children: string }) {
  return <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>{children}</Typography>;
}

export default function NewWorkPassPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: empData } = useQuery({ queryKey: ["employees-list"], queryFn: () => employeesApi.getAll({ limit: 200 }) });
  const employees = Array.isArray(empData?.data?.data?.data) ? empData.data.data.data : [];

  const { control, register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (data: FormData) => complianceApi.create(data),
    onSuccess: () => { toast.success("Work pass created"); qc.invalidateQueries({ queryKey: ["compliance"] }); navigate("/compliance"); },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Failed to create work pass"),
  });

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBack sx={{ fontSize: 16 }} />} onClick={() => navigate("/compliance")} variant="text" size="small" sx={{ color: "#64748b" }}>Back</Button>
        <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Badge sx={{ fontSize: 20, color: "#059669" }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>New Work Pass</Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>Register a work pass for an employee</Typography>
        </Box>
      </Box>

      <Box component="form" onSubmit={handleSubmit(d => mutation.mutate(d))}>
        <Grid container spacing={2.5} sx={{ maxWidth: 680 }}>
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <SectionLabel>Employee & Pass Details</SectionLabel>
                <Grid container spacing={2.5}>
                  <Grid item xs={12}>
                    <FormControl fullWidth error={!!errors.employeeId}>
                      <InputLabel>Employee</InputLabel>
                      <Controller name="employeeId" control={control} defaultValue="" render={({ field }) => (
                        <Select {...field} label="Employee">
                          {employees.map((e: any) => (
                            <MenuItem key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeId})</MenuItem>
                          ))}
                        </Select>
                      )} />
                      {errors.employeeId && <FormHelperText>{errors.employeeId.message}</FormHelperText>}
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth error={!!errors.passType}>
                      <InputLabel>Pass Type</InputLabel>
                      <Controller name="passType" control={control} defaultValue="" render={({ field }) => (
                        <Select {...field} label="Pass Type">
                          {PASS_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                        </Select>
                      )} />
                      {errors.passType && <FormHelperText>{errors.passType.message}</FormHelperText>}
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Pass Number" fullWidth {...register("passNumber")} error={!!errors.passNumber} helperText={errors.passNumber?.message} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Issue Date" type="date" fullWidth InputLabelProps={{ shrink: true }} {...register("issueDate")} error={!!errors.issueDate} helperText={errors.issueDate?.message} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Expiry Date" type="date" fullWidth InputLabelProps={{ shrink: true }} {...register("expiryDate")} error={!!errors.expiryDate} helperText={errors.expiryDate?.message} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
              <Button variant="text" onClick={() => navigate("/compliance")} sx={{ color: "#64748b" }}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={mutation.isPending} sx={{ borderRadius: "10px", px: 3 }}>
                {mutation.isPending ? <CircularProgress size={18} color="inherit" /> : "Create Work Pass"}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
