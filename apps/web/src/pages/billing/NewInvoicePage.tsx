import { useNavigate } from "react-router-dom";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Typography, TextField, Select, MenuItem,
  FormControl, InputLabel, Grid, CircularProgress, IconButton, Divider,
} from "@mui/material";
import { ArrowBack, Receipt, Add, Delete } from "@mui/icons-material";
import { toast } from "sonner";
import { billingApi, clientsApi, projectsApi } from "@/lib/api";

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().min(1),
  unitPrice: z.coerce.number().min(0),
});

const schema = z.object({
  clientId: z.string().min(1, "Client is required"),
  projectId: z.string().optional(),
  issueDate: z.string().min(1, "Issue date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  items: z.array(itemSchema).min(1),
});
type FormData = z.infer<typeof schema>;

function SectionLabel({ children }: { children: string }) {
  return <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>{children}</Typography>;
}

export default function NewInvoicePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: clientsData } = useQuery({ queryKey: ["clients-list"], queryFn: () => clientsApi.getAll({ limit: 100 }) });
  const clients = Array.isArray(clientsData?.data?.data?.data) ? clientsData.data.data.data : [];

  const { data: projectsData } = useQuery({ queryKey: ["projects-list"], queryFn: () => projectsApi.getAll({ limit: 100 }) });
  const projects = Array.isArray(projectsData?.data?.data?.data) ? projectsData.data.data.data : [];

  const { control, register, handleSubmit, formState: { errors }, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { issueDate: new Date().toISOString().split("T")[0], items: [{ description: "", quantity: 1, unitPrice: 0 }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = watch("items");
  const total = items.reduce((sum, it) => sum + (it.quantity || 0) * (it.unitPrice || 0), 0);

  const mutation = useMutation({
    mutationFn: (data: FormData) => billingApi.createInvoice(data),
    onSuccess: () => { toast.success("Invoice created"); qc.invalidateQueries({ queryKey: ["invoices"] }); navigate("/billing"); },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Failed to create invoice"),
  });

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBack sx={{ fontSize: 16 }} />} onClick={() => navigate("/billing")} variant="text" size="small" sx={{ color: "#64748b" }}>Back</Button>
        <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: "#fef9c3", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Receipt sx={{ fontSize: 20, color: "#ca8a04" }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>New Invoice</Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>Create a new invoice for a client</Typography>
        </Box>
      </Box>

      <Box component="form" onSubmit={handleSubmit(d => mutation.mutate(d))}>
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={8}>
            <Card sx={{ mb: 2.5 }}>
              <CardContent sx={{ p: 3 }}>
                <SectionLabel>Invoice Details</SectionLabel>
                <Grid container spacing={2.5}>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth error={!!errors.clientId}>
                      <InputLabel>Client</InputLabel>
                      <Controller name="clientId" control={control} defaultValue="" render={({ field }) => (
                        <Select {...field} label="Client">
                          {clients.map((c: any) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                        </Select>
                      )} />
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Project (optional)</InputLabel>
                      <Controller name="projectId" control={control} defaultValue="" render={({ field }) => (
                        <Select {...field} label="Project (optional)">
                          <MenuItem value="">None</MenuItem>
                          {projects.map((p: any) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                        </Select>
                      )} />
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Issue Date" type="date" fullWidth InputLabelProps={{ shrink: true }} {...register("issueDate")} error={!!errors.issueDate} helperText={errors.issueDate?.message} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Due Date" type="date" fullWidth InputLabelProps={{ shrink: true }} {...register("dueDate")} error={!!errors.dueDate} helperText={errors.dueDate?.message} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                  <SectionLabel>Line Items</SectionLabel>
                  <Button size="small" startIcon={<Add sx={{ fontSize: 15 }} />} onClick={() => append({ description: "", quantity: 1, unitPrice: 0 })} sx={{ borderRadius: "8px" }}>Add Item</Button>
                </Box>
                <Box sx={{ display: "flex", gap: 1, mb: 1, px: 0.5 }}>
                  <Typography sx={{ flex: 2, fontSize: "0.6875rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Description</Typography>
                  <Typography sx={{ flex: 0.5, fontSize: "0.6875rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Qty</Typography>
                  <Typography sx={{ flex: 1, fontSize: "0.6875rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Unit Price</Typography>
                  <Box sx={{ width: 32 }} />
                </Box>
                {fields.map((field, index) => (
                  <Box key={field.id} sx={{ display: "flex", gap: 1.5, mb: 1.5, alignItems: "center" }}>
                    <TextField sx={{ flex: 2 }} {...register(`items.${index}.description`)} size="small" placeholder="Description" />
                    <TextField type="number" sx={{ flex: 0.5 }} {...register(`items.${index}.quantity`)} size="small" placeholder="1" />
                    <TextField type="number" sx={{ flex: 1 }} {...register(`items.${index}.unitPrice`)} size="small" placeholder="0.00" />
                    <IconButton onClick={() => fields.length > 1 && remove(index)} disabled={fields.length <= 1} size="small" sx={{ color: "#ef4444" }}>
                      <Delete sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                ))}
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 3 }}>
                  <Typography sx={{ color: "#64748b", fontSize: "0.875rem" }}>Total</Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: "#0f172a" }}>SGD {total.toFixed(2)}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ position: "sticky", top: 80 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1.5 }}>Invoice Total</Typography>
                <Typography sx={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em", mb: 3 }}>SGD {total.toFixed(2)}</Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <Button variant="text" onClick={() => navigate("/billing")} fullWidth sx={{ color: "#64748b" }}>Cancel</Button>
                  <Button type="submit" variant="contained" disabled={mutation.isPending} fullWidth sx={{ borderRadius: "10px" }}>
                    {mutation.isPending ? <CircularProgress size={18} color="inherit" /> : "Create Invoice"}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
