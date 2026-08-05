import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Typography, TextField, Select, MenuItem,
  FormControl, InputLabel, Grid, CircularProgress, FormHelperText, Alert,
} from "@mui/material";
import { ArrowBack, Edit } from "@mui/icons-material";
import { toast } from "sonner";
import { equipmentApi } from "@/lib/api";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
  unit: z.string().min(1),
  unitCost: z.coerce.number().min(0, "Unit cost must be 0 or more"),
  minStockLevel: z.coerce.number().int().min(0),
  depreciationRate: z.coerce.number().min(0).max(100).optional(),
  usefulLifeDays: z.coerce.number().int().min(0).optional(),
  supplierName: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function SectionLabel({ children }: { children: string }) {
  return <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>{children}</Typography>;
}

export default function EditEquipmentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["equipment-item", id],
    queryFn: () => equipmentApi.get(id!),
    enabled: !!id,
  });
  const item = data?.data?.data ?? data?.data ?? {};

  const { data: catsData } = useQuery({ queryKey: ["eq-categories"], queryFn: () => equipmentApi.listCategories() });
  const categories = Array.isArray(catsData?.data) ? catsData.data : Array.isArray(catsData?.data?.data) ? catsData.data.data : [];

  const { control, register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (item?.id) {
      reset({
        name: item.name ?? "",
        description: item.description ?? "",
        categoryId: item.categoryId ?? "",
        unit: item.unit ?? "unit",
        unitCost: Number(item.unitCost ?? 0),
        minStockLevel: item.minStockLevel ?? 5,
        depreciationRate: item.depreciationRate != null ? Number(item.depreciationRate) * 100 : undefined,
        usefulLifeDays: item.usefulLifeDays ?? undefined,
        supplierName: item.supplierName ?? "",
      });
    }
  }, [item?.id, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => equipmentApi.update(id!, {
      ...data,
      depreciationRate: data.depreciationRate != null ? data.depreciationRate / 100 : undefined,
    }),
    onSuccess: () => {
      toast.success("Equipment item updated");
      qc.invalidateQueries({ queryKey: ["equipment-item", id] });
      qc.invalidateQueries({ queryKey: ["equipment"] });
      navigate(`/equipment/${id}`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Failed to update equipment item"),
  });

  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">Equipment item not found.</Alert>;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBack sx={{ fontSize: 16 }} />} onClick={() => navigate(`/equipment/${id}`)} variant="text" size="small" sx={{ color: "#64748b" }}>Back</Button>
        <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Edit sx={{ fontSize: 20, color: "#ea580c" }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>Edit Equipment Item</Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>{item.itemCode} · {item.name}</Typography>
        </Box>
      </Box>

      <Box component="form" onSubmit={handleSubmit(d => mutation.mutate(d))}>
        <Grid container spacing={2.5} sx={{ maxWidth: 760 }}>
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <SectionLabel>Item Details</SectionLabel>
                <Grid container spacing={2.5}>
                  <Grid item xs={12}>
                    <TextField label="Name" fullWidth {...register("name")} error={!!errors.name} helperText={errors.name?.message} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField label="Description" fullWidth multiline rows={2} {...register("description")} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth error={!!errors.categoryId}>
                      <InputLabel>Category</InputLabel>
                      <Controller name="categoryId" control={control} render={({ field }) => (
                        <Select {...field} label="Category">
                          {categories.map((c: any) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                        </Select>
                      )} />
                      {errors.categoryId && <FormHelperText>{errors.categoryId.message}</FormHelperText>}
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Tracking Mode" fullWidth value={item.trackingMode === "SERIALIZED" ? "Serialized (individually tracked)" : "Bulk (quantity-tracked)"} disabled
                      helperText="Tracking mode can't be changed after creation" />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <SectionLabel>Costing &amp; Stock Levels</SectionLabel>
                <Grid container spacing={2.5}>
                  <Grid item xs={12} md={4}>
                    <TextField label="Unit" fullWidth {...register("unit")} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField label="Default Unit Cost (SGD)" type="number" fullWidth inputProps={{ step: "0.01", min: 0 }} {...register("unitCost")} error={!!errors.unitCost} helperText={errors.unitCost?.message} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField label="Reorder Threshold" type="number" fullWidth {...register("minStockLevel")} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField label="Depreciation Rate (% / year)" type="number" fullWidth inputProps={{ step: "0.1", min: 0, max: 100 }} {...register("depreciationRate")} helperText="Used for serialized assets only" />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField label="Useful Life (days)" type="number" fullWidth {...register("usefulLifeDays")} helperText="Takes priority over the rate above, if set" />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField label="Default Supplier Name" fullWidth {...register("supplierName")} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
              <Button variant="text" onClick={() => navigate(`/equipment/${id}`)} sx={{ color: "#64748b" }}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={mutation.isPending} sx={{ borderRadius: "10px", px: 3 }}>
                {mutation.isPending ? <CircularProgress size={18} color="inherit" /> : "Save Changes"}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
