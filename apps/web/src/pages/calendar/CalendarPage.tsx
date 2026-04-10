import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Card, CardContent, Button, Chip, CircularProgress,
  Grid, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, IconButton, Tooltip,
  Table, TableHead, TableRow, TableCell, TableBody, Tabs, Tab, Alert,
} from "@mui/material";
import {
  ChevronLeft, ChevronRight, Add, Delete, Edit, CalendarMonth,
  Public, Business, Work, Today,
} from "@mui/icons-material";
import { toast } from "sonner";
import { calendarApi, leaveApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EVENT_TYPES = [
  { value: "PUBLIC_HOLIDAY", label: "Public Holiday", icon: <Public fontSize="small" />, color: "#dc2626" },
  { value: "COMPANY_HOLIDAY", label: "Company Holiday", icon: <Business fontSize="small" />, color: "#7c3aed" },
  { value: "HALF_DAY", label: "Half Day", icon: <Work fontSize="small" />, color: "#f59e0b" },
  { value: "WORKING_SATURDAY", label: "Working Saturday", icon: <Work fontSize="small" />, color: "#0891b2" },
];

function eventColor(type: string) {
  return EVENT_TYPES.find(e => e.value === type)?.color ?? "#64748b";
}
function eventLabel(type: string) {
  return EVENT_TYPES.find(e => e.value === type)?.label ?? type;
}

// ─── Event Dialog ─────────────────────────────────────────────────────────────
function EventDialog({ open, onClose, onSave, editing }: {
  open: boolean; onClose: () => void;
  onSave: (d: any) => void; editing?: any;
}) {
  const [form, setForm] = useState({
    name: editing?.name ?? "",
    date: editing?.date ? new Date(editing.date).toISOString().slice(0, 10) : "",
    type: editing?.type ?? "PUBLIC_HOLIDAY",
    description: editing?.description ?? "",
    isRecurring: editing?.isRecurring ?? false,
    country: editing?.country ?? "SG",
  });

  function set(k: string, v: any) { setForm(p => ({ ...p, [k]: v })); }

  function handleSave() {
    if (!form.name.trim() || !form.date) { toast.error("Name and date are required"); return; }
    onSave(form);
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>{editing ? "Edit Event" : "Add Calendar Event"}</DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Event Name" required
              value={form.name} onChange={e => set("name", e.target.value)} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Date" type="date" required
              value={form.date} onChange={e => set("date", e.target.value)}
              InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select value={form.type} label="Type" onChange={e => set("type", e.target.value)}>
                {EVENT_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Description (optional)" multiline rows={2}
              value={form.description} onChange={e => set("description", e.target.value)} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Country Code" value={form.country}
              onChange={e => set("country", e.target.value)} />
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Recurring Annually</InputLabel>
              <Select value={form.isRecurring ? "yes" : "no"} label="Recurring Annually"
                onChange={e => set("isRecurring", e.target.value === "yes")}>
                <MenuItem value="no">One-time</MenuItem>
                <MenuItem value="yes">Recurring</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} variant="text" sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
        <Button onClick={handleSave} variant="contained"
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none",
            background: "linear-gradient(135deg,#2563eb,#1d4ed8)" }}>
          {editing ? "Update" : "Add Event"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Calendar Grid ─────────────────────────────────────────────────────────────
function CalendarGrid({ year, month, holidays, leaveEvents }: { year: number; month: number; holidays: any[]; leaveEvents: any[] }) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  function dateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function getHolidaysForDay(day: number) {
    const ds = dateStr(day);
    return holidays.filter(h => new Date(h.date).toISOString().slice(0, 10) === ds);
  }

  function getLeavesForDay(day: number) {
    const ds = new Date(dateStr(day));
    return leaveEvents.filter(l => {
      const s = new Date(l.startDate);
      const e = new Date(l.endDate);
      return ds >= s && ds <= e;
    });
  }

  return (
    <Box>
      <Grid container columns={7} sx={{ mb: 0.5 }}>
        {DAY_NAMES.map(d => (
          <Grid item xs={1} key={d}>
            <Typography align="center" variant="caption" fontWeight={700}
              sx={{ color: d === "Sun" ? "#dc2626" : "#94a3b8", display: "block", py: 0.5, fontSize: "0.7rem", textTransform: "uppercase" }}>
              {d}
            </Typography>
          </Grid>
        ))}
      </Grid>
      <Grid container columns={7} sx={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>
        {cells.map((day, idx) => {
          const isToday = day ? dateStr(day) === todayStr : false;
          const isSunday = idx % 7 === 0;
          const dayHolidays = day ? getHolidaysForDay(day) : [];
          const dayLeaves = day ? getLeavesForDay(day) : [];
          const hasEvents = dayHolidays.length > 0 || dayLeaves.length > 0;

          return (
            <Grid item xs={1} key={idx}
              sx={{
                minHeight: 80, borderRight: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0",
                background: !day ? "#fafafa" : isToday ? "rgba(37,99,235,0.06)" : dayHolidays.length > 0 ? "rgba(220,38,38,0.03)" : "white",
                "&:nth-of-type(7n)": { borderRight: "none" },
                p: 0.5,
              }}>
              {day && (
                <>
                  <Typography variant="caption" fontWeight={isToday ? 800 : 600}
                    sx={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 22, height: 22, borderRadius: "50%",
                      background: isToday ? "#2563eb" : "transparent",
                      color: isToday ? "white" : isSunday ? "#dc2626" : "#0f172a",
                      fontSize: "0.72rem",
                    }}>
                    {day}
                  </Typography>
                  <Box sx={{ mt: 0.25 }}>
                    {dayHolidays.slice(0, 2).map((h: any, i: number) => (
                      <Tooltip key={i} title={`${eventLabel(h.type)}: ${h.name}`}>
                        <Box sx={{
                          background: eventColor(h.type), color: "white",
                          borderRadius: "3px", px: 0.5, py: 0.1, fontSize: "0.6rem", fontWeight: 700,
                          mb: 0.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          cursor: "default",
                        }}>
                          {h.name}
                        </Box>
                      </Tooltip>
                    ))}
                    {dayLeaves.slice(0, 1).map((l: any, i: number) => (
                      <Tooltip key={i} title={`${l.employee?.firstName} ${l.employee?.lastName} — ${l.leaveType}`}>
                        <Box sx={{
                          background: "#16a34a", color: "white",
                          borderRadius: "3px", px: 0.5, py: 0.1, fontSize: "0.6rem", fontWeight: 700,
                          mb: 0.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          cursor: "default",
                        }}>
                          {l.employee?.firstName} on leave
                        </Box>
                      </Tooltip>
                    ))}
                    {(dayHolidays.length + dayLeaves.length) > 2 && (
                      <Typography variant="caption" sx={{ color: "#94a3b8", fontSize: "0.58rem" }}>
                        +{dayHolidays.length + dayLeaves.length - 2} more
                      </Typography>
                    )}
                  </Box>
                </>
              )}
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.role === "MANAGER";

  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [tab, setTab] = useState(0);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);

  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  }
  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  }

  // Fetch holidays for the current year
  const { data: holidayData, isLoading: holidayLoading } = useQuery({
    queryKey: ["holidays-year", currentYear],
    queryFn: () => calendarApi.getYearEvents(currentYear),
  });
  const holidays: any[] = Array.isArray(holidayData?.data?.data) ? holidayData.data.data : [];

  // Fetch approved leaves for current month (calendar view)
  const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
  const monthEnd = new Date(currentYear, currentMonth + 1, 0).toISOString().slice(0, 10);
  const { data: leaveData } = useQuery({
    queryKey: ["leave-calendar", currentYear, currentMonth],
    queryFn: () => leaveApi.getCalendar(monthStart, monthEnd),
  });
  const leaveEvents: any[] = Array.isArray(leaveData?.data?.data) ? leaveData.data.data : [];

  // Month-specific holidays
  const monthHolidays = holidays.filter(h => {
    const d = new Date(h.date);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });

  const createMut = useMutation({
    mutationFn: (d: any) => calendarApi.createEvent(d),
    onSuccess: () => { toast.success("Event added"); qc.invalidateQueries({ queryKey: ["holidays-year"] }); setEventDialogOpen(false); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => calendarApi.updateEvent(id, data),
    onSuccess: () => { toast.success("Event updated"); qc.invalidateQueries({ queryKey: ["holidays-year"] }); setEditingEvent(null); setEventDialogOpen(false); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => calendarApi.deleteEvent(id),
    onSuccess: () => { toast.success("Event deleted"); qc.invalidateQueries({ queryKey: ["holidays-year"] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed"),
  });

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: "#0f172a", letterSpacing: "-0.02em" }}>
            Calendar
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748b", mt: 0.25 }}>
            Public holidays, company events &amp; employee leaves
          </Typography>
        </Box>
        {isAdmin && (
          <Button variant="contained" startIcon={<Add />} onClick={() => { setEditingEvent(null); setEventDialogOpen(true); }}
            sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 700, boxShadow: "none",
              background: "linear-gradient(135deg,#2563eb,#1d4ed8)" }}>
            Add Event
          </Button>
        )}
      </Box>

      {/* Legend */}
      <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
        {EVENT_TYPES.map(t => (
          <Box key={t.value} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: "3px", background: t.color }} />
            <Typography variant="caption" sx={{ color: "#64748b" }}>{t.label}</Typography>
          </Box>
        ))}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: "3px", background: "#16a34a" }} />
          <Typography variant="caption" sx={{ color: "#64748b" }}>Approved Leave</Typography>
        </Box>
      </Box>

      <Grid container spacing={2.5}>
        {/* Calendar Grid */}
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: "14px", boxShadow: "0 1px 8px rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.04)" }}>
            <CardContent sx={{ p: "20px !important" }}>
              {/* Month nav */}
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <IconButton size="small" onClick={prevMonth}><ChevronLeft /></IconButton>
                  <Typography variant="h6" fontWeight={800} sx={{ color: "#0f172a", minWidth: 180 }}>
                    {MONTH_NAMES[currentMonth]} {currentYear}
                  </Typography>
                  <IconButton size="small" onClick={nextMonth}><ChevronRight /></IconButton>
                </Box>
                <Tooltip title="Go to today">
                  <IconButton size="small" onClick={() => { setCurrentMonth(now.getMonth()); setCurrentYear(now.getFullYear()); }}>
                    <Today />
                  </IconButton>
                </Tooltip>
              </Box>

              {holidayLoading ? (
                <Box sx={{ textAlign: "center", py: 4 }}><CircularProgress size={28} /></Box>
              ) : (
                <CalendarGrid
                  year={currentYear}
                  month={currentMonth}
                  holidays={holidays}
                  leaveEvents={leaveEvents}
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Panel: Events this month + Year list */}
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: "14px", boxShadow: "0 1px 8px rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.04)" }}>
            <Box sx={{ borderBottom: "1px solid #e2e8f0", px: 2 }}>
              <Tabs value={tab} onChange={(_, v) => setTab(v)}
                sx={{ "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: "0.8rem" } }}>
                <Tab label="This Month" />
                <Tab label={`All ${currentYear}`} />
              </Tabs>
            </Box>
            <CardContent sx={{ p: "0 !important", maxHeight: 520, overflowY: "auto" }}>
              {tab === 0 && (
                <>
                  {/* Month Holidays */}
                  {monthHolidays.length === 0 && leaveEvents.length === 0 ? (
                    <Box sx={{ p: 3, textAlign: "center" }}>
                      <CalendarMonth sx={{ fontSize: 36, color: "#cbd5e1", mb: 1 }} />
                      <Typography variant="body2" color="text.secondary">No events this month</Typography>
                    </Box>
                  ) : (
                    <Box sx={{ p: 1 }}>
                      {monthHolidays.map((h: any) => (
                        <Box key={h.id} sx={{ display: "flex", alignItems: "flex-start", gap: 1, p: 1.5,
                          borderRadius: "10px", mb: 0.5, "&:hover": { background: "#f8fafc" } }}>
                          <Box sx={{ width: 3, borderRadius: 99, background: eventColor(h.type), alignSelf: "stretch", flexShrink: 0 }} />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={700} sx={{ color: "#0f172a" }}>{h.name}</Typography>
                            <Typography variant="caption" sx={{ color: "#64748b" }}>
                              {new Date(h.date).toLocaleDateString("en-SG", { day: "numeric", month: "short" })} · {eventLabel(h.type)}
                            </Typography>
                          </Box>
                          {isAdmin && (
                            <Box sx={{ display: "flex", gap: 0.25 }}>
                              <Tooltip title="Edit">
                                <IconButton size="small" onClick={() => { setEditingEvent(h); setEventDialogOpen(true); }}>
                                  <Edit sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton size="small" color="error" onClick={() => deleteMut.mutate(h.id)}>
                                  <Delete sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          )}
                        </Box>
                      ))}
                      {leaveEvents.map((l: any) => (
                        <Box key={l.id} sx={{ display: "flex", alignItems: "flex-start", gap: 1, p: 1.5,
                          borderRadius: "10px", mb: 0.5, "&:hover": { background: "#f8fafc" } }}>
                          <Box sx={{ width: 3, borderRadius: 99, background: "#16a34a", alignSelf: "stretch", flexShrink: 0 }} />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" fontWeight={700} sx={{ color: "#0f172a" }}>
                              {l.employee?.firstName} {l.employee?.lastName}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "#64748b" }}>
                              {new Date(l.startDate).toLocaleDateString("en-SG", { day: "numeric", month: "short" })} –{" "}
                              {new Date(l.endDate).toLocaleDateString("en-SG", { day: "numeric", month: "short" })} · {l.leaveType}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  )}
                </>
              )}

              {tab === 1 && (
                holidays.length === 0 ? (
                  <Box sx={{ p: 3, textAlign: "center" }}>
                    <Typography variant="body2" color="text.secondary">No events for {currentYear}</Typography>
                  </Box>
                ) : (
                  <Box sx={{ p: 1 }}>
                    {holidays.map((h: any) => (
                      <Box key={h.id} sx={{ display: "flex", alignItems: "flex-start", gap: 1, p: 1.25,
                        borderRadius: "10px", mb: 0.4, "&:hover": { background: "#f8fafc" } }}>
                        <Box sx={{ width: 3, borderRadius: 99, background: eventColor(h.type), alignSelf: "stretch", flexShrink: 0, minHeight: 30 }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={700} sx={{ color: "#0f172a" }}>{h.name}</Typography>
                          <Typography variant="caption" sx={{ color: "#64748b" }}>
                            {new Date(h.date).toLocaleDateString("en-SG", { day: "numeric", month: "short" })} · {eventLabel(h.type)}
                            {h.isRecurring && " · 🔄 Recurring"}
                          </Typography>
                        </Box>
                        {isAdmin && (
                          <Box sx={{ display: "flex", gap: 0.25 }}>
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => { setEditingEvent(h); setEventDialogOpen(true); }}>
                                <Edit sx={{ fontSize: 13 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton size="small" color="error" onClick={() => deleteMut.mutate(h.id)}>
                                <Delete sx={{ fontSize: 13 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                      </Box>
                    ))}
                  </Box>
                )
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <EventDialog
        open={eventDialogOpen}
        onClose={() => { setEventDialogOpen(false); setEditingEvent(null); }}
        editing={editingEvent}
        onSave={(d) => {
          if (editingEvent) updateMut.mutate({ id: editingEvent.id, data: d });
          else createMut.mutate(d);
        }}
      />
    </Box>
  );
}
