import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Typography, TextField, Select, MenuItem,
  FormControl, InputLabel, Grid, CircularProgress, Alert,
} from "@mui/material";
import { ArrowBack, Edit } from "@mui/icons-material";
import { toast } from "sonner";
import { employeesApi } from "@/lib/api";

const schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  nationality: z.string().optional(),
  dailyRate: z.coerce.number().min(0, "Daily rate must be 0 or more"),
  allowances: z.coerce.number().min(0).optional(),
  cpfApplicable: z.boolean().optional(),
  bankName: z.string().optional(),
  bankAccountNo: z.string().optional(),
  emergencyContact: z.string().optional(),
  address: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function SectionLabel({ children }: { children: string }) {
  return (
    <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>
      {children}
    </Typography>
  );
}

export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => employeesApi.get(id!),
    enabled: !!id,
  });

  const emp = data?.data?.data ?? data?.data ?? {};

  const { control, register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { dailyRate: 0, cpfApplicable: false },
  });

  useEffect(() => {
    if (emp.firstName) {
      reset({
        firstName: emp.firstName ?? "",
        lastName: emp.lastName ?? "",
        email: emp.email ?? "",
        phone: emp.phone ?? "",
        jobTitle: emp.jobTitle ?? "",
        department: emp.department ?? "",
        nationality: emp.nationality ?? "",
        dailyRate: Number(emp.dailyRate ?? 0),
        allowances: Number(emp.allowances ?? 0),
        cpfApplicable: emp.cpfApplicable ?? false,
        bankName: emp.bankName ?? "",
        bankAccountNo: emp.bankAccountNo ?? "",
        emergencyContact: emp.emergencyContact ?? "",
        address: emp.address ?? "",
      });
    }
  }, [emp.firstName]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => employeesApi.update(id!, data),
    onSuccess: () => {
      toast.success("Employee updated");
      qc.invalidateQueries({ queryKey: ["employee", id] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      navigate(`/employees/${id}`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Failed to update employee"),
  });

  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">Employee not found.</Alert>;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button
          startIcon={<ArrowBack sx={{ fontSize: 16 }} />}
          onClick={() => navigate(`/employees/${id}`)}
          variant="text" size="small" sx={{ color: "#64748b" }}
        >
          Back
        </Button>
        <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: "#faf5ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Edit sx={{ fontSize: 20, color: "#7c3aed" }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
            Edit Employee
          </Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>
            {emp.firstName} {emp.lastName} · {emp.employeeCode}
          </Typography>
        </Box>
      </Box>

      <Box component="form" onSubmit={handleSubmit(d => mutation.mutate(d))}>
        <Grid container spacing={2.5} sx={{ maxWidth: 840 }}>
          {/* Personal Information */}
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <SectionLabel>Personal Information</SectionLabel>
                <Grid container spacing={2.5}>
                  <Grid item xs={12} md={6}>
                    <TextField label="First Name" fullWidth {...register("firstName")} error={!!errors.firstName} helperText={errors.firstName?.message} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Last Name" fullWidth {...register("lastName")} error={!!errors.lastName} helperText={errors.lastName?.message} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Email" type="email" fullWidth {...register("email")} error={!!errors.email} helperText={errors.email?.message} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Phone" fullWidth {...register("phone")} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Nationality" fullWidth {...register("nationality")} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Emergency Contact" fullWidth {...register("emergencyContact")} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField label="Address" fullWidth multiline rows={2} {...register("address")} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Employment Details */}
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <SectionLabel>Employment Details</SectionLabel>
                <Grid container spacing={2.5}>
                  <Grid item xs={12} md={6}>
                    <TextField label="Job Title" fullWidth {...register("jobTitle")} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Department" fullWidth {...register("department")} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Daily Rate (SGD)"
                      type="number"
                      inputProps={{ step: "0.01", min: "0" }}
                      fullWidth
                      {...register("dailyRate")}
                      error={!!errors.dailyRate}
                      helperText={errors.dailyRate?.message}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Monthly Allowances (SGD)"
                      type="number"
                      inputProps={{ step: "0.01", min: "0" }}
                      fullWidth
                      {...register("allowances")}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>CPF Applicable</InputLabel>
                      <Controller
                        name="cpfApplicable"
                        control={control}
                        render={({ field }) => (
                          <Select
                            {...field}
                            label="CPF Applicable"
                            value={field.value ? "true" : "false"}
                            onChange={e => field.onChange(e.target.value === "true")}
                          >
                            <MenuItem value="true">Yes (SG Citizen / PR)</MenuItem>
                            <MenuItem value="false">No (Foreigner / EP)</MenuItem>
                          </Select>
                        )}
                      />
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Bank Details */}
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <SectionLabel>Bank Details</SectionLabel>
                <Grid container spacing={2.5}>
                  <Grid item xs={12} md={6}>
                    <TextField label="Bank Name" fullWidth {...register("bankName")} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Bank Account No." fullWidth {...register("bankAccountNo")} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Actions */}
          <Grid item xs={12}>
            <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
              <Button variant="text" onClick={() => navigate(`/employees/${id}`)} sx={{ color: "#64748b" }}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={mutation.isPending}
                sx={{ borderRadius: "10px", px: 3, textTransform: "none", fontWeight: 600 }}
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
