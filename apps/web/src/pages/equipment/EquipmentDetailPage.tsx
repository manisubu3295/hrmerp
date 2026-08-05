import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, CircularProgress, Alert, Typography, Grid,
  Tabs, Tab, Table, TableHead, TableRow, TableCell, TableBody, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel,
  Select, MenuItem, Autocomplete,
} from "@mui/material";
import { ArrowBack, Edit, Construction, ShoppingCart, Output, Build, KeyboardReturn } from "@mui/icons-material";
import { toast } from "sonner";
import { equipmentApi, projectsApi, employeesApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";

function InfoField({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "#0f172a" }}>{value ?? "—"}</Typography>
    </Box>
  );
}

// ─── Record Purchase Dialog ────────────────────────────────────────────────
function RecordPurchaseDialog({ open, onClose, item, warehouses, onConfirm, isPending }: {
  open: boolean; onClose: () => void; item: any; warehouses: any[];
  onConfirm: (data: any) => void; isPending: boolean;
}) {
  const [warehouseId, setWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState(String(item.unitCost ?? 0));
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplierName, setSupplierName] = useState(item.supplierName ?? "");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [serialText, setSerialText] = useState("");

  const isSerialized = item.trackingMode === "SERIALIZED";
  const serials = serialText.split("\n").map(s => s.trim()).filter(Boolean);
  const qtyNum = Number(quantity) || 0;
  const serialsValid = !isSerialized || serials.length === qtyNum;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "14px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Record Purchase</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
        <FormControl fullWidth size="small">
          <InputLabel>Warehouse</InputLabel>
          <Select value={warehouseId} label="Warehouse" onChange={e => setWarehouseId(e.target.value)}>
            {warehouses.map((w: any) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField label="Quantity" type="number" size="small" fullWidth value={quantity} onChange={e => setQuantity(e.target.value)} inputProps={{ min: 1 }} />
        <TextField label="Unit Cost (SGD)" type="number" size="small" fullWidth value={unitCost} onChange={e => setUnitCost(e.target.value)} inputProps={{ step: "0.01", min: 0 }} />
        <TextField label="Purchase Date" type="date" size="small" fullWidth value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField label="Supplier Name (optional)" size="small" fullWidth value={supplierName} onChange={e => setSupplierName(e.target.value)} />
        <TextField label="Invoice Ref (optional)" size="small" fullWidth value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} />
        {isSerialized && (
          <TextField
            label={`Serial Numbers (one per line, ${serials.length}/${qtyNum})`}
            size="small" fullWidth multiline rows={4} value={serialText} onChange={e => setSerialText(e.target.value)}
            error={serialText.length > 0 && !serialsValid}
            helperText={!serialsValid ? `Enter exactly ${qtyNum} serial number(s), one per line` : "Each line creates one tracked asset unit"}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} variant="text" sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button
          variant="contained" disabled={isPending || !warehouseId || qtyNum <= 0 || !serialsValid}
          onClick={() => onConfirm({
            itemId: item.id, warehouseId, quantity: qtyNum, unitCost: Number(unitCost),
            purchaseDate, supplierName: supplierName || undefined, invoiceRef: invoiceRef || undefined,
            ...(isSerialized && { serialNumbers: serials }),
          })}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}
        >
          {isPending ? <CircularProgress size={18} color="inherit" /> : "Record Purchase"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Issue Dialog ───────────────────────────────────────────────────────────
function IssueDialog({ open, onClose, item, warehouses, onConfirm, isPending }: {
  open: boolean; onClose: () => void; item: any; warehouses: any[];
  onConfirm: (data: any) => void; isPending: boolean;
}) {
  const [warehouseId, setWarehouseId] = useState("");
  const [assetUnitId, setAssetUnitId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [project, setProject] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null);
  const [notes, setNotes] = useState("");

  const { data: projData } = useQuery({ queryKey: ["eq-projects-list"], queryFn: () => projectsApi.getAll({ limit: 200 }), enabled: open });
  const projects = Array.isArray(projData?.data?.data?.data) ? projData.data.data.data : [];
  const { data: empData } = useQuery({ queryKey: ["eq-employees-list"], queryFn: () => employeesApi.getAll({ limit: 200 }), enabled: open });
  const employees = Array.isArray(empData?.data?.data?.data) ? empData.data.data.data : [];

  const isSerialized = item.trackingMode === "SERIALIZED";
  const availableUnits = (item.assetUnits ?? []).filter((u: any) => u.status === "IN_STOCK" && u.warehouseId === warehouseId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "14px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Issue Equipment</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
        <FormControl fullWidth size="small">
          <InputLabel>Warehouse</InputLabel>
          <Select value={warehouseId} label="Warehouse" onChange={e => { setWarehouseId(e.target.value); setAssetUnitId(""); }}>
            {warehouses.map((w: any) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
          </Select>
        </FormControl>
        {isSerialized ? (
          <FormControl fullWidth size="small" disabled={!warehouseId}>
            <InputLabel>Asset Unit</InputLabel>
            <Select value={assetUnitId} label="Asset Unit" onChange={e => setAssetUnitId(e.target.value)}>
              {availableUnits.map((u: any) => <MenuItem key={u.id} value={u.id}>{u.assetTag}{u.serialNumber ? ` (${u.serialNumber})` : ""}</MenuItem>)}
            </Select>
            {warehouseId && availableUnits.length === 0 && <Typography sx={{ fontSize: "0.75rem", color: "#dc2626", mt: 0.5 }}>No units in stock at this warehouse.</Typography>}
          </FormControl>
        ) : (
          <TextField label="Quantity" type="number" size="small" fullWidth value={quantity} onChange={e => setQuantity(e.target.value)} inputProps={{ min: 1 }} />
        )}
        <Autocomplete
          options={projects} getOptionLabel={(p: any) => `${p.projectCode} — ${p.name}`}
          value={project} onChange={(_, v) => setProject(v)}
          renderInput={(params) => <TextField {...params} label="Project" size="small" />}
        />
        <Autocomplete
          options={employees} getOptionLabel={(e: any) => `${e.firstName} ${e.lastName}${e.employeeCode ? ` (${e.employeeCode})` : ""}`}
          value={employee} onChange={(_, v) => setEmployee(v)}
          renderInput={(params) => <TextField {...params} label="Employee" size="small" />}
        />
        <TextField label="Notes (optional)" size="small" fullWidth value={notes} onChange={e => setNotes(e.target.value)} />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} variant="text" sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button
          variant="contained"
          disabled={isPending || !warehouseId || !project || !employee || (isSerialized ? !assetUnitId : Number(quantity) <= 0)}
          onClick={() => onConfirm({
            itemId: item.id, warehouseId, projectId: project.id, employeeId: employee.id,
            notes: notes || undefined,
            ...(isSerialized ? { assetUnitId } : { quantity: Number(quantity) }),
          })}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}
        >
          {isPending ? <CircularProgress size={18} color="inherit" /> : "Issue"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Return Dialog ──────────────────────────────────────────────────────────
function ReturnDialog({ open, onClose, issue, onConfirm, isPending }: {
  open: boolean; onClose: () => void; issue: any; onConfirm: (data: any) => void; isPending: boolean;
}) {
  const [returnedQty, setReturnedQty] = useState(String(issue?.quantity ?? 1));
  const [lostDamagedQty, setLostDamagedQty] = useState("0");
  const [condition, setCondition] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "14px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Return Equipment</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
        <TextField label="Returned Qty" type="number" size="small" fullWidth value={returnedQty} onChange={e => setReturnedQty(e.target.value)} inputProps={{ min: 0, max: issue?.quantity }} />
        <TextField label="Lost / Damaged Qty" type="number" size="small" fullWidth value={lostDamagedQty} onChange={e => setLostDamagedQty(e.target.value)} inputProps={{ min: 0, max: issue?.quantity }} />
        <TextField label="Condition (optional)" size="small" fullWidth value={condition} onChange={e => setCondition(e.target.value)} placeholder="e.g. LOST, DAMAGED, GOOD" />
        <TextField label="Notes (optional)" size="small" fullWidth value={notes} onChange={e => setNotes(e.target.value)} />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} variant="text" sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => onConfirm({ returnedQty: Number(returnedQty), lostDamagedQty: Number(lostDamagedQty), condition: condition || undefined, notes: notes || undefined })}
          disabled={isPending}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}
        >
          {isPending ? <CircularProgress size={18} color="inherit" /> : "Confirm Return"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Maintenance Dialog ─────────────────────────────────────────────────────
function MaintenanceDialog({ open, onClose, item, onConfirm, isPending }: {
  open: boolean; onClose: () => void; item: any; onConfirm: (data: any) => void; isPending: boolean;
}) {
  const isSerialized = item.trackingMode === "SERIALIZED";
  const [assetUnitId, setAssetUnitId] = useState("");
  const [performedAt, setPerformedAt] = useState(new Date().toISOString().slice(0, 10));
  const [performedBy, setPerformedBy] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("0");
  const [nextDueDate, setNextDueDate] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "14px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Log Maintenance</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
        {isSerialized && (
          <FormControl fullWidth size="small">
            <InputLabel>Asset Unit</InputLabel>
            <Select value={assetUnitId} label="Asset Unit" onChange={e => setAssetUnitId(e.target.value)}>
              {(item.assetUnits ?? []).map((u: any) => <MenuItem key={u.id} value={u.id}>{u.assetTag}</MenuItem>)}
            </Select>
          </FormControl>
        )}
        <TextField label="Performed On" type="date" size="small" fullWidth value={performedAt} onChange={e => setPerformedAt(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField label="Performed By (optional)" size="small" fullWidth value={performedBy} onChange={e => setPerformedBy(e.target.value)} />
        <TextField label="Description" size="small" fullWidth multiline rows={2} value={description} onChange={e => setDescription(e.target.value)} />
        <TextField label="Cost (SGD)" type="number" size="small" fullWidth value={cost} onChange={e => setCost(e.target.value)} inputProps={{ step: "0.01", min: 0 }} />
        <TextField label="Next Due Date (optional)" type="date" size="small" fullWidth value={nextDueDate} onChange={e => setNextDueDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField label="Notes (optional)" size="small" fullWidth value={notes} onChange={e => setNotes(e.target.value)} />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} variant="text" sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button
          variant="contained"
          disabled={isPending || !description || (isSerialized && !assetUnitId)}
          onClick={() => onConfirm({
            ...(isSerialized ? { assetUnitId } : { itemId: item.id }),
            performedAt, performedBy: performedBy || undefined, description,
            cost: Number(cost), nextDueDate: nextDueDate || undefined, notes: notes || undefined,
          })}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}
        >
          {isPending ? <CircularProgress size={18} color="inherit" /> : "Save Record"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState<any>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["equipment-item", id],
    queryFn: () => equipmentApi.get(id!),
    enabled: !!id,
  });

  const { data: whData } = useQuery({ queryKey: ["eq-warehouses"], queryFn: () => equipmentApi.listWarehouses() });
  const warehouses = Array.isArray(whData?.data) ? whData.data : Array.isArray(whData?.data?.data) ? whData.data.data : [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["equipment-item", id] });
    qc.invalidateQueries({ queryKey: ["equipment"] });
    qc.invalidateQueries({ queryKey: ["equipment-summary"] });
  };

  const statusMut = useMutation({
    mutationFn: (status: string) => equipmentApi.updateStatus(id!, status),
    onSuccess: () => { toast.success("Status updated"); invalidate(); },
    onError: () => toast.error("Failed to update status"),
  });

  const purchaseMut = useMutation({
    mutationFn: (data: any) => equipmentApi.recordPurchase(data),
    onSuccess: () => { toast.success("Purchase recorded"); invalidate(); setPurchaseOpen(false); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to record purchase"),
  });

  const issueMut = useMutation({
    mutationFn: (data: any) => equipmentApi.issueEquipment(data),
    onSuccess: () => { toast.success("Equipment issued"); invalidate(); setIssueOpen(false); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to issue equipment"),
  });

  const returnMut = useMutation({
    mutationFn: ({ issueId, data }: { issueId: string; data: any }) => equipmentApi.returnEquipment(issueId, data),
    onSuccess: () => { toast.success("Equipment returned"); invalidate(); setReturnTarget(null); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to process return"),
  });

  const maintenanceMut = useMutation({
    mutationFn: (data: any) => equipmentApi.createMaintenanceRecord(data),
    onSuccess: () => { toast.success("Maintenance record saved"); invalidate(); setMaintenanceOpen(false); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to save maintenance record"),
  });

  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}><CircularProgress /></Box>;
  if (error || !data) return <Alert severity="error">Equipment not found.</Alert>;

  const item = data?.data?.data ?? data?.data ?? {};
  const isSerialized = item.trackingMode === "SERIALIZED";
  const onHand = isSerialized
    ? (item.assetUnits ?? []).filter((u: any) => u.status === "IN_STOCK").length
    : (item.warehouseStocks ?? []).reduce((s: number, w: any) => s + w.quantityOnHand, 0);

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBack sx={{ fontSize: 16 }} />} onClick={() => navigate("/equipment")} variant="text" size="small" sx={{ color: "#64748b" }}>Back</Button>
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: item.isActive ? "#eff6ff" : "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Construction sx={{ fontSize: 20, color: item.isActive ? "#2563eb" : "#94a3b8" }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>{item.name}</Typography>
            <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>{item.itemCode} {item.category?.name ? `· ${item.category.name}` : ""}</Typography>
          </Box>
        </Box>
        <Chip label={item.isActive ? "Active" : "Retired"} color={item.isActive ? "success" : "default"} />
        <Button size="small" variant="outlined" onClick={() => statusMut.mutate(item.isActive ? "RETIRED" : "AVAILABLE")} disabled={statusMut.isPending}
          sx={{ borderRadius: "8px", textTransform: "none" }}>
          {item.isActive ? "Retire" : "Reactivate"}
        </Button>
        <Button variant="outlined" startIcon={<Edit sx={{ fontSize: 15 }} />} size="small" onClick={() => navigate(`/equipment/${id}/edit`)} sx={{ borderRadius: "8px" }}>Edit</Button>
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
        <Button variant="contained" size="small" startIcon={<ShoppingCart sx={{ fontSize: 16 }} />} onClick={() => setPurchaseOpen(true)}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>Record Purchase</Button>
        <Button variant="contained" size="small" startIcon={<Output sx={{ fontSize: 16 }} />} onClick={() => setIssueOpen(true)}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>Issue</Button>
        <Button variant="outlined" size="small" startIcon={<Build sx={{ fontSize: 16 }} />} onClick={() => setMaintenanceOpen(true)}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700 }}>Log Maintenance</Button>
      </Box>

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Item Details</Typography>
              <InfoField label="Name" value={item.name} />
              <InfoField label="Item Code" value={item.itemCode} />
              <InfoField label="Category" value={item.category?.name} />
              <InfoField label="Description" value={item.description} />
              <InfoField label="Tracking Mode" value={isSerialized ? "Serialized" : "Bulk"} />
              <InfoField label="Unit Cost" value={item.unitCost != null ? `SGD ${Number(item.unitCost).toFixed(2)}` : undefined} />
              <InfoField label="Supplier" value={item.supplierName} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Stock & Maintenance</Typography>
              <InfoField label="On Hand" value={onHand} />
              <InfoField label="Reorder Threshold" value={item.minStockLevel} />
              <InfoField label="Next Maintenance (SKU-level)" value={item.nextMaintenanceAt ? formatDate(item.nextMaintenanceAt) : undefined} />
              <InfoField label="Depreciation Rate" value={item.depreciationRate ? `${(Number(item.depreciationRate) * 100).toFixed(1)}% / yr` : undefined} />
              <InfoField label="Useful Life" value={item.usefulLifeDays ? `${item.usefulLifeDays} days` : undefined} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: "1px solid #e2e8f0" }}>
        <Tab label="Open Issues" />
        <Tab label="Purchases" />
        {isSerialized && <Tab label={`Asset Units (${(item.assetUnits ?? []).length})`} />}
        <Tab label="Maintenance History" />
      </Tabs>

      {tab === 0 && (
        <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
          <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.75rem", color: "#64748b", background: "#f8fafc" } }}>
                <TableCell>Project</TableCell><TableCell>Employee</TableCell><TableCell align="right">Qty</TableCell>
                <TableCell align="right">Cost</TableCell><TableCell>Issued</TableCell><TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(item.issues ?? []).map((iss: any) => (
                <TableRow key={iss.id}>
                  <TableCell sx={{ fontSize: "0.8125rem" }}>{iss.project?.projectCode} — {iss.project?.name}</TableCell>
                  <TableCell sx={{ fontSize: "0.8125rem" }}>{iss.employee?.firstName} {iss.employee?.lastName}</TableCell>
                  <TableCell align="right">{iss.quantity}</TableCell>
                  <TableCell align="right">SGD {Number(iss.totalCost).toFixed(2)}</TableCell>
                  <TableCell sx={{ fontSize: "0.8125rem" }}>{formatDate(iss.issuedAt)}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Return">
                      <IconButton size="small" onClick={() => setReturnTarget(iss)}><KeyboardReturn sx={{ fontSize: 16 }} /></IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {(item.issues ?? []).length === 0 && (
                <TableRow><TableCell colSpan={6}><Typography sx={{ textAlign: "center", py: 3, color: "#94a3b8" }}>No open issues.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </Box>
        </Card>
      )}

      {tab === 1 && (
        <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
          <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.75rem", color: "#64748b", background: "#f8fafc" } }}>
                <TableCell>Receipt</TableCell><TableCell>Date</TableCell><TableCell align="right">Qty</TableCell>
                <TableCell align="right">Unit Cost</TableCell><TableCell align="right">Total</TableCell><TableCell>Supplier</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(item.purchases ?? []).map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>{p.receiptCode ?? "—"}</TableCell>
                  <TableCell sx={{ fontSize: "0.8125rem" }}>{formatDate(p.purchaseDate)}</TableCell>
                  <TableCell align="right">{p.quantity}</TableCell>
                  <TableCell align="right">SGD {Number(p.unitCost).toFixed(2)}</TableCell>
                  <TableCell align="right">SGD {Number(p.totalCost).toFixed(2)}</TableCell>
                  <TableCell sx={{ fontSize: "0.8125rem" }}>{p.supplierName ?? "—"}</TableCell>
                </TableRow>
              ))}
              {(item.purchases ?? []).length === 0 && (
                <TableRow><TableCell colSpan={6}><Typography sx={{ textAlign: "center", py: 3, color: "#94a3b8" }}>No purchases recorded yet.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </Box>
        </Card>
      )}

      {isSerialized && tab === 2 && (
        <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
          <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.75rem", color: "#64748b", background: "#f8fafc" } }}>
                <TableCell>Asset Tag</TableCell><TableCell>Serial No.</TableCell><TableCell>Warehouse</TableCell>
                <TableCell>Status</TableCell><TableCell>Assigned To</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(item.assetUnits ?? []).map((u: any) => (
                <TableRow key={u.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate(`/equipment/asset-units/${u.id}`)}>
                  <TableCell sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>{u.assetTag}</TableCell>
                  <TableCell sx={{ fontSize: "0.8125rem" }}>{u.serialNumber ?? "—"}</TableCell>
                  <TableCell sx={{ fontSize: "0.8125rem" }}>{u.warehouse?.name}</TableCell>
                  <TableCell><Chip label={u.status} size="small" /></TableCell>
                  <TableCell sx={{ fontSize: "0.8125rem" }}>{u.currentEmployeeId ? "Issued" : "—"}</TableCell>
                </TableRow>
              ))}
              {(item.assetUnits ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5}><Typography sx={{ textAlign: "center", py: 3, color: "#94a3b8" }}>No asset units yet — record a purchase with serial numbers.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </Box>
        </Card>
      )}

      {tab === (isSerialized ? 3 : 2) && (
        <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
          <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.75rem", color: "#64748b", background: "#f8fafc" } }}>
                <TableCell>Date</TableCell><TableCell>Description</TableCell><TableCell align="right">Cost</TableCell><TableCell>Next Due</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(item.maintenanceRecords ?? []).map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell sx={{ fontSize: "0.8125rem" }}>{formatDate(m.performedAt)}</TableCell>
                  <TableCell sx={{ fontSize: "0.8125rem" }}>{m.description}</TableCell>
                  <TableCell align="right">SGD {Number(m.cost ?? 0).toFixed(2)}</TableCell>
                  <TableCell sx={{ fontSize: "0.8125rem" }}>{m.nextDueDate ? formatDate(m.nextDueDate) : "—"}</TableCell>
                </TableRow>
              ))}
              {(item.maintenanceRecords ?? []).length === 0 && (
                <TableRow><TableCell colSpan={4}><Typography sx={{ textAlign: "center", py: 3, color: "#94a3b8" }}>No maintenance logged yet.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </Box>
        </Card>
      )}

      <RecordPurchaseDialog open={purchaseOpen} onClose={() => setPurchaseOpen(false)} item={item} warehouses={warehouses}
        onConfirm={(data) => purchaseMut.mutate(data)} isPending={purchaseMut.isPending} />
      <IssueDialog open={issueOpen} onClose={() => setIssueOpen(false)} item={item} warehouses={warehouses}
        onConfirm={(data) => issueMut.mutate(data)} isPending={issueMut.isPending} />
      <ReturnDialog open={!!returnTarget} onClose={() => setReturnTarget(null)} issue={returnTarget}
        onConfirm={(data) => returnTarget && returnMut.mutate({ issueId: returnTarget.id, data })} isPending={returnMut.isPending} />
      <MaintenanceDialog open={maintenanceOpen} onClose={() => setMaintenanceOpen(false)} item={item}
        onConfirm={(data) => maintenanceMut.mutate(data)} isPending={maintenanceMut.isPending} />
    </Box>
  );
}
