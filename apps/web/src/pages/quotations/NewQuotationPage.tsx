import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Typography, TextField, Select, MenuItem,
  FormControl, InputLabel, Grid, CircularProgress, Divider, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Chip, Tooltip,
  Alert,
} from "@mui/material";
import {
  ArrowBack, RequestQuote, Add, Delete, AutoAwesome, BookmarkAdd,
  BookmarkAdded, CheckCircle,
} from "@mui/icons-material";
import { toast } from "sonner";
import { quotationsApi, clientsApi } from "@/lib/api";
import {
  getAllTemplates, saveCustomTemplate, TEMPLATE_CATEGORIES,
  type QuotationTemplate, type TemplateLineItem,
} from "@/lib/quotationTemplates";

const itemSchema = z.object({
  description: z.string().min(1, "Required"),
  workerType: z.string().optional(),
  quantity: z.coerce.number().min(0.01),
  unit: z.string().min(1),
  unitRate: z.coerce.number().min(0),
});

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  clientId: z.string().min(1, "Client is required"),
  validUntil: z.string().min(1, "Valid until date is required"),
  description: z.string().optional(),
  notes: z.string().optional(),
  termsAndCond: z.string().optional(),
  discountAmount: z.coerce.number().min(0).optional(),
  taxRate: z.coerce.number().min(0).max(1).optional(),
  lineItems: z.array(itemSchema).min(1, "At least one item required"),
});
type FormData = z.infer<typeof schema>;

function SectionLabel({ children }: { children: string }) {
  return <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>{children}</Typography>;
}

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  Manpower:     { bg: "#eff6ff", color: "#2563eb" },
  Security:     { bg: "#f5f3ff", color: "#7c3aed" },
  Cleaning:     { bg: "#f0fdf4", color: "#059669" },
  Construction: { bg: "#fffbeb", color: "#d97706" },
  Facility:     { bg: "#f0f9ff", color: "#0891b2" },
  Other:        { bg: "#f8fafc", color: "#64748b" },
};

export default function NewQuotationPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveCategory, setSaveCategory] = useState<string>("Other");
  const [appliedTemplate, setAppliedTemplate] = useState<QuotationTemplate | null>(null);

  const { data: clientsData } = useQuery({ queryKey: ["clients-list"], queryFn: () => clientsApi.getAll({ limit: 100 }) });
  const clients = Array.isArray(clientsData?.data?.data?.data) ? clientsData.data.data.data : [];

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      lineItems: [{ description: "", workerType: "", quantity: 1, unit: "days", unitRate: 0 }],
      discountAmount: 0,
      taxRate: 0.09,
    },
  });
  const { control, register, handleSubmit, formState: { errors }, watch, reset, setValue } = form;

  const { fields, append, remove, replace } = useFieldArray({ control, name: "lineItems" });
  const items = watch("lineItems");
  const discount = watch("discountAmount") ?? 0;
  const taxRate = watch("taxRate") ?? 0.09;
  const subtotal = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitRate) || 0), 0);
  const taxableAmount = subtotal - Number(discount);
  const taxAmount = taxableAmount * Number(taxRate);
  const total = taxableAmount + taxAmount;

  const mutation = useMutation({
    mutationFn: (data: FormData) => quotationsApi.create({ ...data, lineItems: data.lineItems }),
    onSuccess: () => {
      toast.success("Quotation created");
      qc.invalidateQueries({ queryKey: ["quotations"] });
      navigate("/quotations");
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Failed to create quotation"),
  });

  function applyTemplate(tpl: QuotationTemplate) {
    replace(tpl.lineItems.map(li => ({
      description: li.description,
      workerType: li.workerType ?? "",
      quantity: li.quantity,
      unit: li.unit,
      unitRate: li.unitRate,
    })));
    if (tpl.notes) setValue("notes", tpl.notes);
    if (tpl.termsAndCond) setValue("termsAndCond", tpl.termsAndCond);
    if (tpl.description && !watch("title")) setValue("title", tpl.name);
    setAppliedTemplate(tpl);
    setTemplateDialogOpen(false);
    toast.success(`Template "${tpl.name}" applied`);
  }

  function handleSaveAsTemplate() {
    const currentItems: TemplateLineItem[] = items.map(it => ({
      description: it.description,
      workerType: it.workerType || undefined,
      quantity: Number(it.quantity),
      unit: it.unit,
      unitRate: Number(it.unitRate),
    }));
    if (!saveName.trim()) { toast.error("Template name is required"); return; }
    saveCustomTemplate({
      name: saveName.trim(),
      category: saveCategory,
      lineItems: currentItems,
      notes: watch("notes"),
      termsAndCond: watch("termsAndCond"),
    });
    toast.success(`Template "${saveName}" saved`);
    setSaveDialogOpen(false);
    setSaveName("");
  }

  const templates = getAllTemplates();

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBack sx={{ fontSize: 16 }} />} onClick={() => navigate("/quotations")} variant="text" size="small" sx={{ color: "#64748b", textTransform: "none" }}>Back</Button>
        <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <RequestQuote sx={{ fontSize: 20, color: "#2563eb" }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>New Quotation</Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>Create a quotation for a client</Typography>
        </Box>
        <Tooltip title="Load a pre-built or saved template to auto-fill line items">
          <Button
            variant="outlined" size="small"
            startIcon={<AutoAwesome sx={{ fontSize: 16 }} />}
            onClick={() => setTemplateDialogOpen(true)}
            sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 600, borderColor: "#e2e8f0", color: "#374151" }}>
            Use Template
          </Button>
        </Tooltip>
      </Box>

      {appliedTemplate && (
        <Alert
          icon={<BookmarkAdded sx={{ fontSize: 18 }} />}
          severity="info"
          onClose={() => setAppliedTemplate(null)}
          sx={{ mb: 2.5, borderRadius: "10px" }}>
          Template <strong>"{appliedTemplate.name}"</strong> applied — line items and terms have been pre-filled. You can edit them freely.
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit(d => mutation.mutate(d))}>
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={8}>
            {/* Details Card */}
            <Card sx={{ mb: 2.5, border: "1px solid #e2e8f0", boxShadow: "none" }}>
              <CardContent sx={{ p: 3 }}>
                <SectionLabel>Quotation Details</SectionLabel>
                <Grid container spacing={2.5}>
                  <Grid item xs={12}>
                    <TextField label="Title" fullWidth {...register("title")} error={!!errors.title} helperText={errors.title?.message} />
                  </Grid>
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
                    <TextField label="Valid Until" type="date" fullWidth InputLabelProps={{ shrink: true }} {...register("validUntil")} error={!!errors.validUntil} helperText={errors.validUntil?.message} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField label="Description" fullWidth multiline rows={2} {...register("description")} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Line Items Card */}
            <Card sx={{ mb: 2.5, border: "1px solid #e2e8f0", boxShadow: "none" }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                  <SectionLabel>Line Items</SectionLabel>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button size="small" startIcon={<AutoAwesome sx={{ fontSize: 14 }} />}
                      onClick={() => setTemplateDialogOpen(true)}
                      sx={{ borderRadius: "8px", textTransform: "none", color: "#7c3aed", borderColor: "#e2e8f0" }}
                      variant="outlined">
                      Load Template
                    </Button>
                    <Button size="small" startIcon={<Add sx={{ fontSize: 14 }} />}
                      onClick={() => append({ description: "", workerType: "", quantity: 1, unit: "days", unitRate: 0 })}
                      sx={{ borderRadius: "8px", textTransform: "none" }}>
                      Add Row
                    </Button>
                  </Box>
                </Box>

                <Box sx={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.6fr 1fr 1fr 32px", gap: 1, mb: 1, px: 0.5 }}>
                  {["Description", "Worker Type", "Qty", "Unit", "Rate (SGD)", ""].map(h => (
                    <Typography key={h} sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</Typography>
                  ))}
                </Box>

                {fields.map((field, index) => (
                  <Box key={field.id} sx={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.6fr 1fr 1fr 32px", gap: 1, mb: 1.5, alignItems: "center" }}>
                    <TextField {...register(`lineItems.${index}.description`)} size="small" placeholder="Description"
                      error={!!errors.lineItems?.[index]?.description} />
                    <TextField {...register(`lineItems.${index}.workerType`)} size="small" placeholder="e.g. Skilled" />
                    <TextField type="number" inputProps={{ step: "0.5", min: "0" }}
                      {...register(`lineItems.${index}.quantity`)} size="small" />
                    <TextField {...register(`lineItems.${index}.unit`)} size="small" placeholder="days" />
                    <TextField type="number" inputProps={{ step: "0.01", min: "0" }}
                      {...register(`lineItems.${index}.unitRate`)} size="small" placeholder="0.00" />
                    <IconButton onClick={() => fields.length > 1 && remove(index)} disabled={fields.length <= 1}
                      size="small" sx={{ color: "#ef4444" }}>
                      <Delete sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                ))}

                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                  <Box sx={{ minWidth: 240 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75 }}>
                      <Typography sx={{ fontSize: "0.875rem", color: "#64748b" }}>Subtotal</Typography>
                      <Typography sx={{ fontSize: "0.875rem", color: "#374151" }}>SGD {subtotal.toFixed(2)}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75 }}>
                      <Typography sx={{ fontSize: "0.875rem", color: "#64748b" }}>Discount</Typography>
                      <Typography sx={{ fontSize: "0.875rem", color: "#374151" }}>− SGD {Number(discount).toFixed(2)}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75 }}>
                      <Typography sx={{ fontSize: "0.875rem", color: "#64748b" }}>GST ({(Number(taxRate) * 100).toFixed(0)}%)</Typography>
                      <Typography sx={{ fontSize: "0.875rem", color: "#374151" }}>SGD {taxAmount.toFixed(2)}</Typography>
                    </Box>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0f172a" }}>Total</Typography>
                      <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: "#0f172a" }}>SGD {total.toFixed(2)}</Typography>
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Notes & Terms Card */}
            <Card sx={{ mb: 2.5, border: "1px solid #e2e8f0", boxShadow: "none" }}>
              <CardContent sx={{ p: 3 }}>
                <SectionLabel>Notes & Terms</SectionLabel>
                <Grid container spacing={2.5}>
                  <Grid item xs={12}>
                    <TextField label="Notes to Client" fullWidth multiline rows={3} {...register("notes")} placeholder="Any additional notes for the client…" />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField label="Terms & Conditions" fullWidth multiline rows={5} {...register("termsAndCond")} placeholder="Payment terms, validity conditions…" />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            {/* Pricing Config */}
            <Card sx={{ mb: 2.5, border: "1px solid #e2e8f0", boxShadow: "none" }}>
              <CardContent sx={{ p: 3 }}>
                <SectionLabel>Pricing</SectionLabel>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField label="Discount Amount (SGD)" type="number" fullWidth inputProps={{ step: "0.01", min: "0" }}
                      {...register("discountAmount")} size="small" />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField label="Tax Rate (e.g. 0.09 for 9%)" type="number" fullWidth inputProps={{ step: "0.01", min: "0", max: "1" }}
                      {...register("taxRate")} size="small" />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Summary Card */}
            <Card sx={{ position: "sticky", top: 80, border: "1px solid #e2e8f0", boxShadow: "none" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>Quotation Total</Typography>
                <Typography sx={{ fontSize: "1.875rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em", mb: 1.5 }}>
                  SGD {total.toFixed(2)}
                </Typography>
                <Typography sx={{ fontSize: "0.8125rem", color: "#64748b", mb: 3 }}>
                  Incl. {(Number(taxRate) * 100).toFixed(0)}% GST · {fields.length} line item{fields.length > 1 ? "s" : ""}
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <Button
                    variant="outlined" size="small" startIcon={<BookmarkAdd sx={{ fontSize: 15 }} />}
                    onClick={() => setSaveDialogOpen(true)}
                    sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 600, color: "#374151", borderColor: "#e2e8f0" }}>
                    Save as Template
                  </Button>
                  <Button variant="text" onClick={() => navigate("/quotations")} fullWidth sx={{ color: "#64748b", textTransform: "none" }}>Cancel</Button>
                  <Button type="submit" variant="contained" disabled={mutation.isPending} fullWidth
                    sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>
                    {mutation.isPending ? <CircularProgress size={18} color="inherit" /> : "Create Quotation"}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* ─── Template Picker Dialog ──────────────────────────────────────── */}
      <Dialog open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: "16px" } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: "1rem", pb: 0.5 }}>
          Choose a Template
        </DialogTitle>
        <Typography sx={{ px: 3, pb: 1.5, fontSize: "0.8125rem", color: "#64748b" }}>
          Select a template to pre-fill line items, notes, and terms. You can edit everything after applying.
        </Typography>
        <DialogContent dividers sx={{ px: 2 }}>
          {templates.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography sx={{ color: "#94a3b8" }}>No templates yet. Save one from any quotation.</Typography>
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {templates.map(tpl => {
                const cat = CATEGORY_COLORS[tpl.category] ?? CATEGORY_COLORS.Other;
                return (
                  <Box key={tpl.id}
                    onClick={() => applyTemplate(tpl)}
                    sx={{
                      p: 2, borderRadius: "12px", border: "1px solid #e2e8f0",
                      cursor: "pointer", transition: "all 0.15s",
                      "&:hover": { borderColor: "#2563eb", backgroundColor: "#f8fafc" },
                    }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a" }}>{tpl.name}</Typography>
                          <Chip label={tpl.category} size="small"
                            sx={{ height: 18, fontSize: "0.6875rem", fontWeight: 600, backgroundColor: cat.bg, color: cat.color, border: "none" }} />
                          {!tpl.isBuiltIn && (
                            <Chip label="Custom" size="small"
                              sx={{ height: 18, fontSize: "0.6875rem", fontWeight: 600, backgroundColor: "#f8fafc", color: "#64748b" }} />
                          )}
                        </Box>
                        <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>
                          {tpl.lineItems.length} item{tpl.lineItems.length > 1 ? "s" : ""}
                          {tpl.description ? ` · ${tpl.description}` : ""}
                        </Typography>
                      </Box>
                      <CheckCircle sx={{ fontSize: 18, color: "#cbd5e1" }} />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => navigate("/quotations/templates")} size="small"
            sx={{ textTransform: "none", color: "#64748b" }}>
            Manage Templates
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setTemplateDialogOpen(false)} variant="outlined" size="small"
            sx={{ borderRadius: "8px", textTransform: "none" }}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Save as Template Dialog ─────────────────────────────────────── */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: "16px" } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: "1rem" }}>Save as Template</DialogTitle>
        <DialogContent sx={{ pt: "12px !important", display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="Template Name" fullWidth value={saveName}
            onChange={e => setSaveName(e.target.value)}
            placeholder="e.g. Standard Security Package"
            size="small"
          />
          <FormControl fullWidth size="small">
            <InputLabel>Category</InputLabel>
            <Select value={saveCategory} label="Category" onChange={e => setSaveCategory(e.target.value)}>
              {TEMPLATE_CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>
            Current {items.length} line item{items.length > 1 ? "s" : ""} will be saved along with notes and terms.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setSaveDialogOpen(false)} variant="text" sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
          <Button onClick={handleSaveAsTemplate} variant="contained" size="small"
            sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>
            Save Template
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
