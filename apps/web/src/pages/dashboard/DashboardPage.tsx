import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Box, Grid, Card, CardContent, Typography, Chip, LinearProgress,
  Alert, CircularProgress, Button, Avatar, Tooltip, IconButton,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { SparkLineChart } from "@mui/x-charts/SparkLineChart";
import {
  FolderOpen, People, AttachMoney, TrendingUp, Warning, Security,
  ArrowForward, ArrowUpward, ArrowDownward, Business, CreditCard,
  Build, VerifiedUser, AccessTime, CheckCircle, OpenInNew,
  MoreHoriz, Bolt, Description,
} from "@mui/icons-material";
import { dashboardApi } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";

type TrafficLight = "GREEN" | "AMBER" | "RED";

const TL_CONFIG: Record<TrafficLight, { color: string; bg: string; border: string; label: string; dot: string }> = {
  GREEN: { color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0", label: "Healthy",   dot: "#22c55e" },
  AMBER: { color: "#b45309", bg: "#fffbeb", border: "#fde68a", label: "Attention", dot: "#f59e0b" },
  RED:   { color: "#b91c1c", bg: "#fef2f2", border: "#fecaca", label: "Critical",  dot: "#ef4444" },
};

// ─── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ title, value, subtitle, icon, color, trend, spark }: {
  title: string; value: string; subtitle?: string;
  icon: React.ReactNode; color: string;
  trend?: { value: number; positive: boolean; label?: string };
  spark?: number[];
}) {
  return (
    <Card
      sx={{
        height: "100%", position: "relative", overflow: "hidden",
        background: `linear-gradient(145deg, #ffffff 0%, ${alpha(color, 0.04)} 100%)`,
        border: `1px solid ${alpha(color, 0.16)}`,
        transition: "transform 0.2s, box-shadow 0.2s",
        "&:hover": { transform: "translateY(-4px)", boxShadow: `0 20px 60px ${alpha(color, 0.22)}` },
      }}
    >
      <Box sx={{ position: "absolute", right: -20, top: -20, width: 120, height: 120, borderRadius: "50%", background: `radial-gradient(circle, ${alpha(color, 0.08)} 0%, transparent 70%)`, pointerEvents: "none" }} />
      <CardContent sx={{ p: "22px !important", position: "relative" }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 2 }}>
          <Box sx={{ width: 50, height: 50, borderRadius: "14px", background: `linear-gradient(135deg, ${alpha(color, 0.18)} 0%, ${alpha(color, 0.08)} 100%)`, border: `1.5px solid ${alpha(color, 0.22)}`, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0, boxShadow: `0 4px 16px ${alpha(color, 0.22)}` }}>
            {icon}
          </Box>
          {trend && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1.25, py: 0.5, borderRadius: "8px", border: `1px solid ${trend.positive ? "#bbf7d0" : "#fecaca"}`, backgroundColor: trend.positive ? "#f0fdf4" : "#fef2f2" }}>
              {trend.positive ? <ArrowUpward sx={{ fontSize: 10, color: "#15803d" }} /> : <ArrowDownward sx={{ fontSize: 10, color: "#b91c1c" }} />}
              <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: trend.positive ? "#15803d" : "#b91c1c" }}>
                {Math.abs(trend.value)}% {trend.label ?? "vs last month"}
              </Typography>
            </Box>
          )}
        </Box>
        <Typography sx={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, background: `linear-gradient(125deg, #0f172a 30%, ${color} 180%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", mb: 0.5 }}>
          {value}
        </Typography>
        <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: "#1e293b", mb: 0.125 }}>{title}</Typography>
        {subtitle && <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>{subtitle}</Typography>}
        {spark && spark.length > 1 && (
          <Box sx={{ mt: 2, height: 40, mx: -0.5 }}>
            <SparkLineChart data={spark} height={40} curve="catmullRom" colors={[color]} area showHighlight={false} showTooltip={false} sx={{ "& .MuiAreaElement-root": { fillOpacity: 0.15 } }} />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section Card ────────────────────────────────────────────────────────────
function SectionCard({ title, subtitle, action, children, accentColor }: {
  title: string; subtitle?: string; action?: React.ReactNode;
  children: React.ReactNode; accentColor?: string;
}) {
  const col = accentColor ?? "#2563eb";
  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ px: 3, pt: 2.5, pb: 2, display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9" }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
          <Box sx={{ width: 3.5, height: subtitle ? 38 : 24, borderRadius: "3px", background: `linear-gradient(180deg, ${col} 0%, ${alpha(col, 0.3)} 100%)`, mt: 0.25, flexShrink: 0 }} />
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0f172a", lineHeight: 1.3 }}>{title}</Typography>
            {subtitle && <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8", mt: 0.25 }}>{subtitle}</Typography>}
          </Box>
        </Box>
        {action}
      </Box>
      <CardContent sx={{ p: "20px 24px !important", flex: 1 }}>{children}</CardContent>
    </Card>
  );
}

// ─── Financial bar row ────────────────────────────────────────────────────────
function MetricRow({ label, value, color, max }: { label: string; value: number; color: string; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75 }}>
        <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "#374151" }}>{label}</Typography>
        <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0f172a" }}>{formatCurrency(value)}</Typography>
      </Box>
      <Box sx={{ height: 6, borderRadius: "99px", backgroundColor: "#f1f5f9", overflow: "hidden" }}>
        <Box sx={{ height: "100%", width: `${pct}%`, borderRadius: "99px", background: `linear-gradient(90deg, ${color} 0%, ${alpha(color, 0.6)} 100%)`, transition: "width 1s ease" }} />
      </Box>
    </Box>
  );
}

// ─── Quick Action Tile ────────────────────────────────────────────────────────
function QuickTile({ label, icon, color, onClick }: { label: string; icon: React.ReactNode; color: string; onClick: () => void }) {
  return (
    <Box onClick={onClick} sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, p: 2, borderRadius: "14px", cursor: "pointer", border: `1.5px solid ${alpha(color, 0.15)}`, background: `linear-gradient(145deg, #fff, ${alpha(color, 0.04)})`, transition: "all 0.18s", "&:hover": { background: `linear-gradient(145deg, ${alpha(color, 0.08)}, ${alpha(color, 0.04)})`, border: `1.5px solid ${alpha(color, 0.35)}`, transform: "translateY(-2px)", boxShadow: `0 8px 24px ${alpha(color, 0.18)}` } }}>
      <Box sx={{ width: 40, height: 40, borderRadius: "11px", backgroundColor: alpha(color, 0.12), display: "flex", alignItems: "center", justifyContent: "center", color }}>{icon}</Box>
      <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#374151", textAlign: "center", lineHeight: 1.3 }}>{label}</Typography>
    </Box>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboardApi.getOverview(),
    refetchInterval: 60_000,
  });

  if (isLoading) return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 2 }}>
      <CircularProgress size={40} thickness={3} sx={{ color: "#2563eb" }} />
      <Typography sx={{ color: "#94a3b8", fontSize: "0.875rem", fontWeight: 500 }}>Loading dashboard…</Typography>
    </Box>
  );
  if (error) return <Alert severity="error">Failed to load dashboard data.</Alert>;

  const kpis = data?.data?.data?.kpis ?? data?.data?.kpis ?? {};
  const traffic: Record<string, string> = data?.data?.data?.trafficLights ?? data?.data?.trafficLights ?? {};
  const topProjects: any[] = Array.isArray(data?.data?.data?.topProjects) ? data.data.data.topProjects
    : Array.isArray(data?.data?.topProjects) ? data.data.topProjects : [];
  const recentAlerts: any[] = Array.isArray(data?.data?.data?.alerts) ? data.data.data.alerts
    : Array.isArray(data?.data?.alerts) ? data.data.alerts
    : Array.isArray(data?.data?.data?.recentAlerts) ? data.data.data.recentAlerts
    : Array.isArray(data?.data?.recentAlerts) ? data.data.recentAlerts : [];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.employee?.firstName ?? user?.email?.split("@")[0] ?? "there";
  const initials = user?.employee
    ? `${user.employee.firstName[0]}${user.employee.lastName[0]}`
    : user?.email?.slice(0, 2).toUpperCase() ?? "SA";

  const monthlyRev = kpis.monthlyRevenue ?? 0;
  const monthlyCost = kpis.monthlyCost ?? 0;
  const monthlyProfit = kpis.monthlyProfit ?? (monthlyRev - monthlyCost);
  const maxBar = Math.max(monthlyRev, monthlyCost, 1);

  return (
    <Box sx={{ minHeight: "100%", pb: 2 }}>

      {/* ── Hero Banner ─────────────────────────────────────────────────────── */}
      <Box sx={{ mb: 3.5, p: 3, borderRadius: "20px", background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1d4ed8 100%)", position: "relative", overflow: "hidden", boxShadow: "0 20px 60px rgba(15,23,42,0.3)" }}>
        <Box sx={{ position: "absolute", right: -60, top: -60, width: 280, height: 280, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
        <Box sx={{ position: "absolute", right: 80, bottom: -80, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.03)", pointerEvents: "none" }} />
        <Box sx={{ position: "absolute", left: "45%", top: -20, width: 160, height: 160, borderRadius: "50%", background: "rgba(99,102,241,0.15)", pointerEvents: "none" }} />

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2, position: "relative" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Avatar sx={{ width: 52, height: 52, fontWeight: 800, fontSize: "1.1rem", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "3px solid rgba(255,255,255,0.2)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>{initials}</Avatar>
            <Box>
              <Typography sx={{ fontSize: "1.625rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1.2 }}>
                {greeting}, {firstName} 👋
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.875rem", mt: 0.25 }}>
                {new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </Typography>
            </Box>
          </Box>

          {/* Inline KPI strip */}
          <Box sx={{ display: { xs: "none", lg: "flex" }, gap: 3 }}>
            {[
              { label: "Revenue",   val: formatCurrency(monthlyRev),    color: "#34d399" },
              { label: "Profit",    val: formatCurrency(monthlyProfit),  color: monthlyProfit >= 0 ? "#a78bfa" : "#f87171" },
              { label: "Employees", val: String(kpis.totalEmployees ?? 0), color: "#60a5fa" },
            ].map((item) => (
              <Box key={item.label} sx={{ textAlign: "right" }}>
                <Typography sx={{ fontSize: "1.5rem", fontWeight: 800, color: item.color, letterSpacing: "-0.04em", lineHeight: 1 }}>{item.val}</Typography>
                <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{item.label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Alert pills */}
        {(kpis.overdueInvoices > 0 || kpis.expiringPasses > 0 || kpis.lowStockItems > 0) && (
          <Box sx={{ display: "flex", gap: 1.5, mt: 2.5, flexWrap: "wrap" }}>
            {kpis.overdueInvoices > 0 && (
              <Box onClick={() => navigate("/billing")} sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.75, borderRadius: "8px", backgroundColor: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer", "&:hover": { backgroundColor: "rgba(239,68,68,0.28)" } }}>
                <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#f87171" }} />
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#fca5a5" }}>{kpis.overdueInvoices} overdue invoice{kpis.overdueInvoices > 1 ? "s" : ""}</Typography>
                <ArrowForward sx={{ fontSize: 11, color: "#fca5a5" }} />
              </Box>
            )}
            {kpis.expiringPasses > 0 && (
              <Box onClick={() => navigate("/compliance")} sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.75, borderRadius: "8px", backgroundColor: "rgba(251,191,36,0.18)", border: "1px solid rgba(251,191,36,0.3)", cursor: "pointer", "&:hover": { backgroundColor: "rgba(251,191,36,0.28)" } }}>
                <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fcd34d" }} />
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#fde68a" }}>{kpis.expiringPasses} work pass{kpis.expiringPasses > 1 ? "es" : ""} expiring</Typography>
                <ArrowForward sx={{ fontSize: 11, color: "#fde68a" }} />
              </Box>
            )}
            {kpis.lowStockItems > 0 && (
              <Box onClick={() => navigate("/equipment")} sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.75, borderRadius: "8px", backgroundColor: "rgba(251,191,36,0.18)", border: "1px solid rgba(251,191,36,0.3)", cursor: "pointer", "&:hover": { backgroundColor: "rgba(251,191,36,0.28)" } }}>
                <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fcd34d" }} />
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#fde68a" }}>{kpis.lowStockItems} low stock alert{kpis.lowStockItems > 1 ? "s" : ""}</Typography>
                <ArrowForward sx={{ fontSize: 11, color: "#fde68a" }} />
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* ── KPI Cards ────────────────────────────────────────────────────────── */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} xl={3}>
          <KpiCard title="Active Projects" value={String(kpis.activeProjects ?? 0)} subtitle="In progress" icon={<FolderOpen sx={{ fontSize: 22 }} />} color="#2563eb" spark={[2,3,2,4,3,4,kpis.activeProjects ?? 0]} />
        </Grid>
        <Grid item xs={12} sm={6} xl={3}>
          <KpiCard title="Total Employees" value={String(kpis.totalEmployees ?? 0)} subtitle="Active workforce" icon={<People sx={{ fontSize: 22 }} />} color="#059669" spark={[8,9,10,10,11,11,kpis.totalEmployees ?? 0]} />
        </Grid>
        <Grid item xs={12} sm={6} xl={3}>
          <KpiCard title="Monthly Revenue" value={formatCurrency(monthlyRev)} subtitle="This month" icon={<AttachMoney sx={{ fontSize: 22 }} />} color="#7c3aed" spark={[4000,6000,5000,8000,7000,9000,monthlyRev || 9500]} />
        </Grid>
        <Grid item xs={12} sm={6} xl={3}>
          <KpiCard title="Profit Margin" value={formatPercent(kpis.profitMargin ?? 0)} subtitle="Gross margin" icon={<TrendingUp sx={{ fontSize: 22 }} />} color={kpis.profitMargin > 0 ? "#ea580c" : "#dc2626"} spark={[12,15,11,18,14,16,kpis.profitMargin ?? 0]} />
        </Grid>
      </Grid>

      {/* ── Row 2: Financial Overview + Project Pipeline + Quick Actions ─────── */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>

        {/* Revenue Breakdown */}
        <Grid item xs={12} md={4}>
          <SectionCard title="Financial Overview" subtitle="Current month snapshot" accentColor="#7c3aed">
            <Box sx={{ mb: 2 }}>
              <MetricRow label="Revenue" value={monthlyRev} color="#7c3aed" max={maxBar} />
              <MetricRow label="Operating Costs" value={monthlyCost} color="#ef4444" max={maxBar} />
              <MetricRow label="Net Profit" value={Math.max(monthlyProfit, 0)} color="#059669" max={maxBar} />
            </Box>
            <Box sx={{ p: 2, borderRadius: "12px", background: monthlyProfit >= 0 ? "linear-gradient(135deg, #f0fdf4, #dcfce7)" : "linear-gradient(135deg, #fef2f2, #fee2e2)", border: `1px solid ${monthlyProfit >= 0 ? "#bbf7d0" : "#fecaca"}` }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                  <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: monthlyProfit >= 0 ? "#15803d" : "#b91c1c", textTransform: "uppercase", letterSpacing: "0.06em" }}>Net {monthlyProfit >= 0 ? "Profit" : "Loss"}</Typography>
                  <Typography sx={{ fontSize: "1.375rem", fontWeight: 800, color: monthlyProfit >= 0 ? "#15803d" : "#b91c1c", letterSpacing: "-0.03em" }}>{formatCurrency(Math.abs(monthlyProfit))}</Typography>
                </Box>
                {monthlyProfit >= 0 ? <CheckCircle sx={{ fontSize: 32, color: "#22c55e", opacity: 0.8 }} /> : <Warning sx={{ fontSize: 32, color: "#ef4444", opacity: 0.8 }} />}
              </Box>
            </Box>
          </SectionCard>
        </Grid>

        {/* Project Pipeline */}
        <Grid item xs={12} md={5}>
          <SectionCard
            title="Project Pipeline"
            subtitle={`${topProjects.length} active project${topProjects.length !== 1 ? "s" : ""}`}
            accentColor="#2563eb"
            action={<Button size="small" endIcon={<ArrowForward sx={{ fontSize: 12 }} />} sx={{ fontSize: "0.75rem", color: "#2563eb", fontWeight: 600, py: 0.25 }} onClick={() => navigate("/projects")}>View all</Button>}
          >
            {topProjects.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <Box sx={{ width: 56, height: 56, borderRadius: "16px", backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", mx: "auto", mb: 1.5 }}>
                  <FolderOpen sx={{ fontSize: 28, color: "#cbd5e1" }} />
                </Box>
                <Typography sx={{ fontWeight: 700, color: "#374151", mb: 0.5 }}>No active projects</Typography>
                <Button size="small" variant="outlined" onClick={() => navigate("/projects/new")} sx={{ mt: 1, borderRadius: "8px", fontSize: "0.8rem" }}>Create first project</Button>
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {topProjects.slice(0, 5).map((p: any) => (
                  <Box key={p.id} sx={{ cursor: "pointer", p: 1.5, borderRadius: "10px", border: "1px solid #f1f5f9", transition: "all 0.15s", "&:hover": { backgroundColor: "#f8fafc", borderColor: "#e2e8f0" } }} onClick={() => navigate(`/projects/${p.id}`)}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                      <Box sx={{ flex: 1, mr: 1 }}>
                        <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>{p.name}</Typography>
                        {p.clientName && <Typography sx={{ fontSize: "0.7rem", color: "#94a3b8", mt: 0.125 }}>{p.clientName}</Typography>}
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0 }}>
                        <Typography sx={{ fontSize: "0.75rem", fontWeight: 800, color: p.progress >= 80 ? "#059669" : p.progress >= 50 ? "#2563eb" : "#f59e0b" }}>{p.progress ?? 0}%</Typography>
                        <Chip label={p.progress >= 80 ? "On Track" : p.progress >= 40 ? "In Progress" : "Early"} size="small"
                          sx={{ fontSize: "0.6rem", fontWeight: 700, height: 18, backgroundColor: p.progress >= 80 ? "#dcfce7" : p.progress >= 40 ? "#eff6ff" : "#fffbeb", color: p.progress >= 80 ? "#15803d" : p.progress >= 40 ? "#1d4ed8" : "#b45309" }}
                        />
                      </Box>
                    </Box>
                    <LinearProgress variant="determinate" value={p.progress ?? 0}
                      sx={{ height: 5, borderRadius: 99, backgroundColor: "#f1f5f9", "& .MuiLinearProgress-bar": { borderRadius: 99, background: p.progress >= 80 ? "linear-gradient(90deg, #059669, #34d399)" : p.progress >= 50 ? "linear-gradient(90deg, #2563eb, #60a5fa)" : "linear-gradient(90deg, #f59e0b, #fbbf24)" } }}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </SectionCard>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={3}>
          <SectionCard title="Quick Actions" subtitle="Jump to common tasks" accentColor="#ea580c">
            <Grid container spacing={1.5}>
              {[
                { label: "New Project",   icon: <FolderOpen sx={{ fontSize: 18 }} />,  color: "#2563eb", path: "/projects/new" },
                { label: "Add Employee",  icon: <People sx={{ fontSize: 18 }} />,       color: "#059669", path: "/employees/new" },
                { label: "New Invoice",   icon: <CreditCard sx={{ fontSize: 18 }} />,   color: "#7c3aed", path: "/billing/new" },
                { label: "New Client",    icon: <Business sx={{ fontSize: 18 }} />,     color: "#0891b2", path: "/clients/new" },
                { label: "New Quotation", icon: <Description sx={{ fontSize: 18 }} />,  color: "#ea580c", path: "/quotations/new" },
                { label: "Log Expense",   icon: <AttachMoney sx={{ fontSize: 18 }} />,  color: "#b45309", path: "/expenses/new" },
              ].map((a) => (
                <Grid item xs={6} key={a.label}>
                  <QuickTile label={a.label} icon={a.icon} color={a.color} onClick={() => navigate(a.path)} />
                </Grid>
              ))}
            </Grid>
          </SectionCard>
        </Grid>
      </Grid>

      {/* ── Row 3: System Health + Recent Alerts ─────────────────────────────── */}
      <Grid container spacing={2.5}>

        {/* System Health */}
        <Grid item xs={12} md={4}>
          <SectionCard title="System Health" subtitle="Operational status indicators" accentColor="#059669">
            {Object.keys(traffic).length === 0 ? (
              <Box sx={{ textAlign: "center", py: 3 }}>
                <VerifiedUser sx={{ fontSize: 36, color: "#e2e8f0", mb: 1 }} />
                <Typography sx={{ color: "#94a3b8", fontSize: "0.875rem" }}>No data available</Typography>
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {Object.entries(traffic).map(([key, value]) => {
                  const tl = (value as TrafficLight) in TL_CONFIG ? TL_CONFIG[value as TrafficLight]
                    : { color: "#64748b", bg: "#f1f5f9", border: "#e2e8f0", label: String(value), dot: "#94a3b8" };
                  return (
                    <Box key={key} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 1.5, borderRadius: "10px", border: `1px solid ${tl.border}`, backgroundColor: tl.bg }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: tl.dot, boxShadow: `0 0 0 3px ${alpha(tl.dot, 0.2)}`, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: "0.875rem", color: "#374151", fontWeight: 600, textTransform: "capitalize" }}>
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: "0.75rem", fontWeight: 800, color: tl.color, letterSpacing: "0.04em" }}>{tl.label}</Typography>
                    </Box>
                  );
                })}
              </Box>
            )}
          </SectionCard>
        </Grid>

        {/* Recent Alerts */}
        <Grid item xs={12} md={8}>
          <SectionCard
            title="Recent Alerts & Activity"
            subtitle="Operations that need your attention"
            accentColor="#dc2626"
            action={<Button size="small" endIcon={<ArrowForward sx={{ fontSize: 12 }} />} sx={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, py: 0.25 }} onClick={() => navigate("/notifications")}>View all</Button>}
          >
            {recentAlerts.length === 0 ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 2.5, p: 2.5, borderRadius: "12px", background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", border: "1px solid #bbf7d0" }}>
                <Box sx={{ width: 44, height: 44, borderRadius: "12px", backgroundColor: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(34,197,94,0.3)" }}>
                  <CheckCircle sx={{ fontSize: 24, color: "#fff" }} />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 700, color: "#15803d", fontSize: "0.9375rem" }}>All systems normal</Typography>
                  <Typography sx={{ color: "#22c55e", fontSize: "0.8125rem" }}>No alerts or issues at this time. Operations running smoothly.</Typography>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.25 }}>
                {recentAlerts.slice(0, 6).map((a: any, i: number) => {
                  const sev = a.severity ?? "MEDIUM";
                  const sevMap: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
                    HIGH:   { color: "#b91c1c", bg: "#fef2f2", border: "#fecaca", icon: <Warning sx={{ fontSize: 14, color: "#dc2626" }} /> },
                    MEDIUM: { color: "#b45309", bg: "#fffbeb", border: "#fde68a", icon: <AccessTime sx={{ fontSize: 14, color: "#f59e0b" }} /> },
                    LOW:    { color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe", icon: <Bolt sx={{ fontSize: 14, color: "#2563eb" }} /> },
                  };
                  const s = sevMap[sev] ?? sevMap["LOW"];
                  return (
                    <Box key={i} sx={{ display: "flex", gap: 1.25, p: 1.5, borderRadius: "10px", border: `1px solid ${s.border}`, backgroundColor: s.bg }}>
                      <Box sx={{ width: 28, height: 28, borderRadius: "8px", backgroundColor: alpha(s.color, 0.12), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.icon}</Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "#1e293b", lineHeight: 1.4 }}>{a.message}</Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.375 }}>
                          <Typography sx={{ fontSize: "0.6875rem", color: "#94a3b8" }}>{a.type}</Typography>
                          <Box sx={{ width: 3, height: 3, borderRadius: "50%", backgroundColor: "#e2e8f0" }} />
                          <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: s.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{sev}</Typography>
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
}
