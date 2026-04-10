import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Typography, TextField, Select, MenuItem,
  FormControl, InputLabel, Grid, CircularProgress,
} from "@mui/material";
import { ArrowBack, Build } from "@mui/icons-material";
import { toast } from "sonner";
import { equipmentApi } from "@/lib/api";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  model: z.string().optional(),
  brand: z.string().optional(),
  serialNumber: z.string().optional(),
  categoryId: z.string().optional(),
  totalQuantity: z.coerce.number().min(1),
  purchaseDate: z.string().optional(),
  purchasePrice: z.coerce.number().optional(),
});
type FormData = z.infer<typeof schema>;

function SectionLabel({ children }: { children: string }) {
  return <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>{children}</Typography>;
}

export default function NewEquipmentPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: catsData } = useQuery({ queryKey: ["eq-categories"], queryFn: () => equipmentApi.listCategories() });
  const categories = Array.isArray(catsData?.data) ? catsData.data : Array.isArray(catsData?.data?.data) ? catsData.data.data : [];

  const { control, register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { totalQuantity: 1 },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => equipmentApi.createItem(data),
    onSuccess: () => { toast.success("Equipment added"); qc.invalidateQueries({ queryKey: ["equipment"] }); navigate("/equipment"); },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Failed to add equipment"),
  });

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBack sx={{ fontSize: 16 }} />} onClick={() => navigate("/equipment")} variant="text" size="small" sx={{ color: "#64748b" }}>Back</Button>
        <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Build sx={{ fontSize: 20, color: "#ea580c" }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>Add Equipment</Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>Register new equipment or tools</Typography>
        </Box>
      </Box>

      <Box component="form" onSubmit={handleSubmit(d => mutation.mutate(d))}>
        <Grid container spacing={2.5} sx={{ maxWidth: 760 }}>
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <SectionLabel>Equipment Details</SectionLabel>
                <Grid container spacing={2.5}>
                  <Grid item xs={12}>
                    <TextField label="Name" fullWidth {...register("name")} error={!!errors.name} helperText={errors.name?.message} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Brand" fullWidth {...register("brand")} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Model" fullWidth {...register("model")} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Serial Number" fullWidth {...register("serialNumber")} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Category</InputLabel>
                      <Controller name="categoryId" control={control} defaultValue="" render={({ field }) => (
                        <Select {...field} label="Category">
                          <MenuItem value="">None</MenuItem>
                          {categories.map((c: any) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                        </Select>
                      )} />
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <SectionLabel>Inventory & Purchase</SectionLabel>
                <Grid container spacing={2.5}>
                  <Grid item xs={12} md={4}>
                    <TextField label="Total Quantity" type="number" fullWidth {...register("totalQuantity")} error={!!errors.totalQuantity} helperText={errors.totalQuantity?.message} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField label="Purchase Date" type="date" fullWidth InputLabelProps={{ shrink: true }} {...register("purchaseDate")} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField label="Purchase Price (SGD)" type="number" fullWidth {...register("purchasePrice")} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
              <Button variant="text" onClick={() => navigate("/equipment")} sx={{ color: "#64748b" }}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={mutation.isPending} sx={{ borderRadius: "10px", px: 3 }}>
                {mutation.isPending ? <CircularProgress size={18} color="inherit" /> : "Add Equipment"}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
