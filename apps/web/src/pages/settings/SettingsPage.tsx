import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Card, CardContent, TextField, Button, Grid,
  CircularProgress, Divider,
} from "@mui/material";
import { Settings as SettingsIcon, Business, Save } from "@mui/icons-material";
import { toast } from "sonner";
import { settingsApi } from "@/lib/api";

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

export default function SettingsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsApi.get(),
  });

  const org = data?.data?.data ?? {};

  const { register, handleSubmit, reset } = useForm<OrgForm>({
    defaultValues: { name: "", uen: "", gstNo: "", email: "", phone: "", address: "" },
  });

  useEffect(() => {
    if (org.name !== undefined) {
      reset({
        name: org.name ?? "",
        uen: org.uen ?? "",
        gstNo: org.gstNo ?? "",
        email: org.email ?? "",
        phone: org.phone ?? "",
        address: org.address ?? "",
      });
    }
  }, [org.name]);

  const mutation = useMutation({
    mutationFn: (data: OrgForm) => settingsApi.update(data),
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to save settings"),
  });

  return (
    <Box sx={{ maxWidth: 760 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Box sx={{ width: 44, height: 44, borderRadius: "12px", backgroundColor: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <SettingsIcon sx={{ fontSize: 22, color: "#059669" }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
            Settings
          </Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>
            Organisation profile — appears on invoices and quotations
          </Typography>
        </Box>
      </Box>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}><CircularProgress /></Box>
      ) : (
        <Box component="form" onSubmit={handleSubmit(d => mutation.mutate(d))}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <SectionLabel icon={<Business sx={{ color: "#64748b", fontSize: 18 }} />}>
                Organisation Details
              </SectionLabel>
              <Grid container spacing={2.5}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Company Name"
                    fullWidth
                    required
                    {...register("name")}
                    placeholder="e.g. Sanko Construction Pte Ltd"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="UEN (Singapore)"
                    fullWidth
                    {...register("uen")}
                    placeholder="e.g. 202300001A"
                    helperText="Unique Entity Number issued by ACRA"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="GST Registration No."
                    fullWidth
                    {...register("gstNo")}
                    placeholder="Leave blank if not GST-registered"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Company Email"
                    type="email"
                    fullWidth
                    {...register("email")}
                    placeholder="billing@yourcompany.com"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Phone"
                    fullWidth
                    {...register("phone")}
                    placeholder="+65 XXXX XXXX"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Registered Address"
                    fullWidth
                    multiline
                    rows={2}
                    {...register("address")}
                    placeholder="e.g. 1 Business Park Ave, #01-01, Singapore 123456"
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              <Box sx={{ backgroundColor: "#f8fafc", borderRadius: "10px", p: 2, border: "1px solid #e2e8f0" }}>
                <Typography sx={{ fontSize: "0.8125rem", color: "#475569", fontWeight: 500 }}>
                  These details appear in the header of all generated PDFs (invoices, quotations, payslips).
                  Keep them up to date to ensure professional-looking documents.
                </Typography>
              </Box>
            </CardContent>
          </Card>

          <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
            <Button
              type="submit"
              variant="contained"
              disabled={mutation.isPending}
              startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <Save sx={{ fontSize: 16 }} />}
              sx={{ borderRadius: "10px", px: 3, textTransform: "none", fontWeight: 600 }}
            >
              Save Settings
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
