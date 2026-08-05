import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Button, Card, CardContent, Typography, Grid, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, Divider, Menu, Tooltip,
  Alert,
} from "@mui/material";
import {
  ArrowBack, AutoAwesome, Add, MoreHoriz, Delete, Edit, BookmarkAdded,
  Lock,
} from "@mui/icons-material";
import { useFieldArray, useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  getAllTemplates, getCustomTemplates, saveCustomTemplate,
  updateCustomTemplate, deleteCustomTemplate, TEMPLATE_CATEGORIES,
  DEFAULT_TERMS, type QuotationTemplate, type TemplateLineItem,
} from "@/lib/quotationTemplates";

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  Manpower:     { bg: "#eff6ff", color: "#2563eb" },
  Security:     { bg: "#f5f3ff", color: "#7c3aed" },
  Cleaning:     { bg: "#f0fdf4", color: "#059669" },
  Construction: { bg: "#fffbeb", color: "#d97706" },
  Facility:     { bg: "#f0f9ff", color: "#0891b2" },
  Other:        { bg: "#f8fafc", color: "#64748b" },
};

const lineItemSchema = z.object({
  description: z.string().min(1, "Required"),
  workerType: z.string().optional(),
  quantity: z.coerce.number().min(0.01),
  unit: z.string().min(1),
  unitRate: z.coerce.number().min(0),
});

const templateFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1),
  description: z.string().optional(),
  notes: z.string().optional(),
  termsAndCond: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1, "At least one item required"),
});
type TemplateFormData = z.infer<typeof templateFormSchema>;

function SectionLabel({ children }: { children: string }) {
  return (
    <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1.5 }}>
      {children}
    </Typography>
  );
}

interface TemplateFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: TemplateFormData) => void;
  existing?: QuotationTemplate | null;
}

function TemplateFormDialog({ open, onClose, onSave, existing }: TemplateFormDialogProps) {
  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: existing
      ? {
          name: existing.name,
          category: existing.category,
          description: existing.description ?? "",
          notes: existing.notes ?? "",
          termsAndCond: existing.termsAndCond ?? "",
          lineItems: existing.lineItems,
        }
      : {
          name: "",
          category: "Other",
          description: "",
          notes: "",
          termsAndCond: DEFAULT_TERMS,
          lineItems: [{ description: "", workerType: "", quantity: 1, unit: "days", unitRate: 0 }],
        },
  });
  const { register, control, handleSubmit, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "lineItems" });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: "1rem" }}>
        {existing ? "Edit Template" : "New Template"}
      </DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
        <Box component="form" id="template-form" onSubmit={handleSubmit(onSave)}>
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} md={7}>
              <TextField label="Template Name" fullWidth size="small"
                {...register("name")} error={!!errors.name} helperText={errors.name?.message} />
            </Grid>
            <Grid item xs={12} md={5}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Controller name="category" control={control} render={({ field }) => (
                  <Select {...field} label="Category">
                    {TEMPLATE_CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </Select>
                )} />
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField label="Description (optional)" fullWidth size="small"
                {...register("description")} placeholder="Brief description of when to use this template" />
            </Grid>
          </Grid>

          <SectionLabel>Line Items</SectionLabel>
          <Box sx={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.6fr 1fr 1fr 32px", gap: 1, mb: 1, px: 0.5 }}>
            {["Description", "Worker Type", "Qty", "Unit", "Rate (SGD)", ""].map(h => (
              <Typography key={h} sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</Typography>
            ))}
          </Box>
          {fields.map((field, i) => (
            <Box key={field.id} sx={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.6fr 1fr 1fr 32px", gap: 1, mb: 1.5, alignItems: "center" }}>
              <TextField {...register(`lineItems.${i}.description`)} size="small" placeholder="Description"
                error={!!errors.lineItems?.[i]?.description} />
              <TextField {...register(`lineItems.${i}.workerType`)} size="small" placeholder="e.g. Skilled" />
              <TextField type="number" inputProps={{ step: "0.5", min: "0" }} {...register(`lineItems.${i}.quantity`)} size="small" />
              <TextField {...register(`lineItems.${i}.unit`)} size="small" placeholder="days" />
              <TextField type="number" inputProps={{ step: "0.01", min: "0" }} {...register(`lineItems.${i}.unitRate`)} size="small" placeholder="0.00" />
              <IconButton onClick={() => fields.length > 1 && remove(i)} disabled={fields.length <= 1} size="small" sx={{ color: "#ef4444" }}>
                <Delete sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<Add sx={{ fontSize: 15 }} />}
            onClick={() => append({ description: "", workerType: "", quantity: 1, unit: "days", unitRate: 0 })}
            sx={{ textTransform: "none", mb: 3 }}>
            Add Row
          </Button>

          <Divider sx={{ mb: 2.5 }} />
          <Grid container spacing={2.5}>
            <Grid item xs={12}>
              <TextField label="Notes (pre-filled in quotation)" fullWidth multiline rows={2}
                size="small" {...register("notes")} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Terms & Conditions (pre-filled in quotation)" fullWidth multiline rows={4}
                size="small" {...register("termsAndCond")} />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} variant="text" sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button type="submit" form="template-form" variant="contained"
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>
          {existing ? "Save Changes" : "Create Template"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Row Menu ────────────────────────────────────────────────────────────────
function TemplateCardMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  return (
    <>
      <IconButton size="small" onClick={e => { e.stopPropagation(); setAnchor(e.currentTarget); }}>
        <MoreHoriz sx={{ fontSize: 18, color: "#94a3b8" }} />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
        PaperProps={{ sx: { borderRadius: "10px", boxShadow: "0 4px 16px rgba(0,0,0,0.10)", minWidth: 140 } }}>
        <MenuItem onClick={() => { onEdit(); setAnchor(null); }} sx={{ fontSize: "0.875rem" }}>
          <Edit sx={{ fontSize: 16, mr: 1.5, color: "#64748b" }} /> Edit
        </MenuItem>
        <MenuItem onClick={() => { onDelete(); setAnchor(null); }} sx={{ fontSize: "0.875rem", color: "#ef4444" }}>
          <Delete sx={{ fontSize: 16, mr: 1.5 }} /> Delete
        </MenuItem>
      </Menu>
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function QuotationTemplatesPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<QuotationTemplate[]>(() => getAllTemplates());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<QuotationTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuotationTemplate | null>(null);

  const builtInCount = templates.filter(t => t.isBuiltIn).length;
  const customCount = templates.filter(t => !t.isBuiltIn).length;

  function refresh() { setTemplates(getAllTemplates()); }

  function handleSave(data: TemplateFormData) {
    if (editing) {
      updateCustomTemplate(editing.id, data);
      toast.success("Template updated");
    } else {
      saveCustomTemplate(data);
      toast.success("Template created");
    }
    refresh();
    setFormOpen(false);
    setEditing(null);
  }

  function handleDelete(tpl: QuotationTemplate) {
    deleteCustomTemplate(tpl.id);
    toast.success(`"${tpl.name}" deleted`);
    refresh();
    setDeleteTarget(null);
  }

  const customTemplates = templates.filter(t => !t.isBuiltIn);
  const builtInTemplates = templates.filter(t => t.isBuiltIn);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBack sx={{ fontSize: 16 }} />} onClick={() => navigate("/quotations")}
          variant="text" size="small" sx={{ color: "#64748b", textTransform: "none" }}>
          Back
        </Button>
        <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <AutoAwesome sx={{ fontSize: 20, color: "#7c3aed" }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
            Quotation Templates
          </Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>
            Manage reusable line-item templates for faster quotation creation
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add sx={{ fontSize: 16 }} />}
          onClick={() => { setEditing(null); setFormOpen(true); }}
          sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>
          New Template
        </Button>
      </Box>

      {/* Stat Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 2, mb: 3 }}>
        {[
          { label: "Total Templates", value: templates.length, color: "#7c3aed", bg: "#f5f3ff" },
          { label: "Built-in", value: builtInCount, color: "#0891b2", bg: "#f0f9ff" },
          { label: "Custom", value: customCount, color: "#059669", bg: "#f0fdf4" },
        ].map(s => (
          <Card key={s.label} sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
            <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: "9px", backgroundColor: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <BookmarkAdded sx={{ fontSize: 18, color: s.color }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{s.value}</Typography>
                  <Typography sx={{ fontSize: "0.75rem", color: "#64748b", mt: 0.25 }}>{s.label}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Custom Templates */}
      <Card sx={{ mb: 3, border: "1px solid #e2e8f0", boxShadow: "none" }}>
        <Box sx={{ px: 3, pt: 2.5, pb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box>
            <Typography sx={{ fontWeight: 700, color: "#0f172a", fontSize: "0.9375rem" }}>Custom Templates</Typography>
            <Typography sx={{ fontSize: "0.8125rem", color: "#94a3b8" }}>Created by your team — fully editable</Typography>
          </Box>
          <Button size="small" startIcon={<Add sx={{ fontSize: 15 }} />}
            onClick={() => { setEditing(null); setFormOpen(true); }}
            variant="outlined"
            sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 600, borderColor: "#e2e8f0", color: "#374151" }}>
            New
          </Button>
        </Box>
        <Divider />
        <Box sx={{ p: 3 }}>
          {customTemplates.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 5, px: 2 }}>
              <AutoAwesome sx={{ fontSize: 36, color: "#e2e8f0", mb: 1.5 }} />
              <Typography sx={{ fontWeight: 600, color: "#374151", mb: 0.5 }}>No custom templates yet</Typography>
              <Typography sx={{ fontSize: "0.875rem", color: "#94a3b8", mb: 2.5 }}>
                Create templates to quickly pre-fill line items when creating quotations.
              </Typography>
              <Button variant="contained" size="small" startIcon={<Add sx={{ fontSize: 15 }} />}
                onClick={() => { setEditing(null); setFormOpen(true); }}
                sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>
                Create First Template
              </Button>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {customTemplates.map(tpl => {
                const cat = CATEGORY_COLORS[tpl.category] ?? CATEGORY_COLORS.Other;
                return (
                  <Grid item xs={12} sm={6} md={4} key={tpl.id}>
                    <Box sx={{
                      p: 2.5, borderRadius: "12px", border: "1px solid #e2e8f0",
                      height: "100%", display: "flex", flexDirection: "column", gap: 1,
                      transition: "border-color 0.15s", "&:hover": { borderColor: "#7c3aed" },
                    }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Chip label={tpl.category} size="small"
                          sx={{ height: 20, fontSize: "0.6875rem", fontWeight: 600, backgroundColor: cat.bg, color: cat.color, border: "none", mb: 1 }} />
                        <TemplateCardMenu
                          onEdit={() => { setEditing(tpl); setFormOpen(true); }}
                          onDelete={() => setDeleteTarget(tpl)}
                        />
                      </Box>
                      <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0f172a", lineHeight: 1.3 }}>{tpl.name}</Typography>
                      {tpl.description && (
                        <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>{tpl.description}</Typography>
                      )}
                      <Divider sx={{ my: 0.5 }} />
                      <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                        {tpl.lineItems.length} line item{tpl.lineItems.length > 1 ? "s" : ""}
                      </Typography>
                      {tpl.lineItems.slice(0, 2).map((li, i) => (
                        <Typography key={i} sx={{ fontSize: "0.8125rem", color: "#374151" }}>
                          · {li.description}
                          <Typography component="span" sx={{ color: "#94a3b8", fontSize: "0.75rem" }}> ({li.quantity} {li.unit} × SGD {li.unitRate})</Typography>
                        </Typography>
                      ))}
                      {tpl.lineItems.length > 2 && (
                        <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>+ {tpl.lineItems.length - 2} more…</Typography>
                      )}
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Box>
      </Card>

      {/* Built-in Templates */}
      <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
        <Box sx={{ px: 3, pt: 2.5, pb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Lock sx={{ fontSize: 16, color: "#94a3b8" }} />
            <Typography sx={{ fontWeight: 700, color: "#0f172a", fontSize: "0.9375rem" }}>Built-in Templates</Typography>
          </Box>
          <Typography sx={{ fontSize: "0.8125rem", color: "#94a3b8" }}>Standard templates included with Aadhirai HRM OS — read-only</Typography>
        </Box>
        <Divider />
        <Box sx={{ p: 3 }}>
          <Grid container spacing={2}>
            {builtInTemplates.map(tpl => {
              const cat = CATEGORY_COLORS[tpl.category] ?? CATEGORY_COLORS.Other;
              return (
                <Grid item xs={12} sm={6} md={4} key={tpl.id}>
                  <Box sx={{
                    p: 2.5, borderRadius: "12px", border: "1px solid #e2e8f0",
                    backgroundColor: "#fafafa", height: "100%", display: "flex", flexDirection: "column", gap: 1,
                  }}>
                    <Chip label={tpl.category} size="small"
                      sx={{ width: "fit-content", height: 20, fontSize: "0.6875rem", fontWeight: 600, backgroundColor: cat.bg, color: cat.color, border: "none", mb: 0.5 }} />
                    <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0f172a", lineHeight: 1.3 }}>{tpl.name}</Typography>
                    {tpl.description && (
                      <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>{tpl.description}</Typography>
                    )}
                    <Divider sx={{ my: 0.5 }} />
                    <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      {tpl.lineItems.length} line item{tpl.lineItems.length > 1 ? "s" : ""}
                    </Typography>
                    {tpl.lineItems.slice(0, 2).map((li, i) => (
                      <Typography key={i} sx={{ fontSize: "0.8125rem", color: "#374151" }}>
                        · {li.description}
                        <Typography component="span" sx={{ color: "#94a3b8", fontSize: "0.75rem" }}> ({li.quantity} {li.unit} × SGD {li.unitRate})</Typography>
                      </Typography>
                    ))}
                    {tpl.lineItems.length > 2 && (
                      <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>+ {tpl.lineItems.length - 2} more…</Typography>
                    )}
                    <Tooltip title="Built-in templates cannot be edited">
                      <Chip label="Built-in" size="small" icon={<Lock sx={{ fontSize: "11px !important" }} />}
                        sx={{ width: "fit-content", mt: "auto", height: 18, fontSize: "0.6875rem", color: "#94a3b8", backgroundColor: "transparent", border: "1px solid #e2e8f0" }} />
                    </Tooltip>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      </Card>

      {/* Form Dialog */}
      <TemplateFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSave={handleSave}
        existing={editing}
      />

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: "16px" } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: "1rem" }}>Delete Template?</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ borderRadius: "10px" }}>
            <strong>"{deleteTarget?.name}"</strong> will be permanently deleted. This cannot be undone.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} variant="text" sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
          <Button onClick={() => deleteTarget && handleDelete(deleteTarget)} variant="contained" color="error" size="small"
            sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
