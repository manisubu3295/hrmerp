import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Typography, TextField, Grid,
  Divider, Alert, CircularProgress,
} from "@mui/material";
import { ArrowBack, Save } from "@mui/icons-material";
import { suppliersApi } from "@/lib/api";
import { toast } from "sonner";

type FormValues = {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  taxId: string;
  notes: string;
};

export default function SupplierFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const qc = useQueryClient();

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["supplier", id],
    queryFn: () => suppliersApi.get(id!),
    enabled: isEdit,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: { name: "", contactPerson: "", email: "", phone: "", address: "", city: "", country: "", taxId: "", notes: "" },
  });

  useEffect(() => {
    if (existing?.data?.data) {
      const s = existing.data.data;
      reset({
        name: s.name ?? "",
        contactPerson: s.contactPerson ?? "",
        email: s.email ?? "",
        phone: s.phone ?? "",
        address: s.address ?? "",
        city: s.city ?? "",
        country: s.country ?? "",
        taxId: s.taxId ?? "",
        notes: s.notes ?? "",
      });
    }
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      isEdit ? suppliersApi.update(id!, data) : suppliersApi.create(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      if (isEdit) qc.invalidateQueries({ queryKey: ["supplier", id] });
      toast.success(isEdit ? "Supplier updated" : "Supplier created");
      const savedId = res?.data?.data?.id ?? id;
      navigate(`/suppliers/${savedId}`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Failed to save"),
  });

  if (isEdit && loadingExisting) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ maxWidth: 800, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <Button startIcon={<ArrowBack sx={{ fontSize: 16 }} />} onClick={() => navigate(-1)}
          variant="text" size="small" sx={{ color: "#64748b" }}>Back</Button>
        <Divider orientation="vertical" flexItem />
        <Typography variant="h6" fontWeight={700}>
          {isEdit ? "Edit Supplier" : "New Supplier"}
        </Typography>
      </Box>

      {mutation.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(mutation.error as any)?.response?.data?.message ?? "Failed to save supplier"}
        </Alert>
      )}

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
        <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none", mb: 2 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 2, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.75rem" }}>
              Basic Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}>
                <TextField
                  label="Supplier Name *"
                  fullWidth
                  {...register("name", { required: "Name is required" })}
                  error={!!errors.name}
                  helperText={errors.name?.message}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField label="Tax ID / GST / VAT" fullWidth {...register("taxId")} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Contact Person" fullWidth {...register("contactPerson")} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Email" type="email" fullWidth {...register("email")} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Phone" fullWidth {...register("phone")} />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none", mb: 2 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 2, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.75rem" }}>
              Address
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField label="Street Address" fullWidth {...register("address")} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="City" fullWidth {...register("city")} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Country" fullWidth {...register("country")} />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none", mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 2, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.75rem" }}>
              Notes
            </Typography>
            <TextField label="Notes" fullWidth multiline minRows={3} {...register("notes")} />
          </CardContent>
        </Card>

        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
          <Button variant="outlined" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" variant="contained" startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <Save />} disabled={mutation.isPending}>
            {isEdit ? "Save Changes" : "Create Supplier"}
          </Button>
        </Box>
      </form>
    </Box>
  );
}
