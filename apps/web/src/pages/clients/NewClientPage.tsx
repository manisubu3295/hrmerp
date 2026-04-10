import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Card, CardContent, Typography, TextField, Grid, CircularProgress } from "@mui/material";
import { ArrowBack, Business } from "@mui/icons-material";
import { toast } from "sonner";
import { clientsApi } from "@/lib/api";

const schema = z.object({
  name: z.string().min(1, "Company name is required"),
  registrationNumber: z.string().optional(),
  contactPerson: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  industry: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function SectionLabel({ children }: { children: string }) {
  return <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>{children}</Typography>;
}

export default function NewClientPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (data: FormData) => clientsApi.create(data),
    onSuccess: () => { toast.success("Client added"); qc.invalidateQueries({ queryKey: ["clients"] }); navigate("/clients"); },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Failed to add client"),
  });

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBack sx={{ fontSize: 16 }} />} onClick={() => navigate("/clients")} variant="text" size="small" sx={{ color: "#64748b" }}>Back</Button>
        <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Business sx={{ fontSize: 20, color: "#059669" }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>Add Client</Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>Register a new client company</Typography>
        </Box>
      </Box>

      <Box component="form" onSubmit={handleSubmit(d => mutation.mutate(d))}>
        <Grid container spacing={2.5} sx={{ maxWidth: 720 }}>
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <SectionLabel>Company Information</SectionLabel>
                <Grid container spacing={2.5}>
                  <Grid item xs={12}>
                    <TextField label="Company Name" fullWidth {...register("name")} error={!!errors.name} helperText={errors.name?.message} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Registration Number" fullWidth {...register("registrationNumber")} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Industry" fullWidth {...register("industry")} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField label="Address" fullWidth multiline rows={2} {...register("address")} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <SectionLabel>Contact Details</SectionLabel>
                <Grid container spacing={2.5}>
                  <Grid item xs={12} md={6}>
                    <TextField label="Contact Person" fullWidth {...register("contactPerson")} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Email" type="email" fullWidth {...register("email")} error={!!errors.email} helperText={errors.email?.message} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Phone" fullWidth {...register("phone")} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
              <Button variant="text" onClick={() => navigate("/clients")} sx={{ color: "#64748b" }}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={mutation.isPending} sx={{ borderRadius: "10px", px: 3 }}>
                {mutation.isPending ? <CircularProgress size={18} color="inherit" /> : "Add Client"}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
