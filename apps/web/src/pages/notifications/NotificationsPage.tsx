import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Card, CardContent, Typography, Alert, Chip, Button, Divider, CircularProgress,
} from "@mui/material";
import {
  Notifications as NotificationsIcon, CheckCircle, Info, Warning, Error as ErrorIcon, DoneAll,
} from "@mui/icons-material";
import { notificationsApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";

function StatCard({ label, value, icon, iconBg, iconColor }: {
  label: string; value: string | number; icon: React.ReactNode; iconBg: string; iconColor: string;
}) {
  return (
    <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: iconColor }}>
            {icon}
          </Box>
          <Box>
            <Typography sx={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 500 }}>{label}</Typography>
            <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  INFO:    { icon: Info,        color: "#2563eb", bg: "#eff6ff" },
  SUCCESS: { icon: CheckCircle, color: "#059669", bg: "#f0fdf4" },
  WARNING: { icon: Warning,     color: "#d97706", bg: "#fffbeb" },
  ERROR:   { icon: ErrorIcon,   color: "#b91c1c", bg: "#fef2f2" },
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.getAll({ page: 1, limit: 50 }),
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllMut = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const notifications = Array.isArray(data?.data?.data?.data) ? data.data.data.data : [];
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;
  const totalCount = isLoading ? "—" : notifications.length;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 2 }}>
        <StatCard label="Total" value={totalCount} icon={<NotificationsIcon sx={{ fontSize: 22 }} />} iconBg="#eff6ff" iconColor="#2563eb" />
        <StatCard label="Unread" value={isLoading ? "—" : unreadCount} icon={<NotificationsIcon sx={{ fontSize: 22 }} />} iconBg="#fef2f2" iconColor="#b91c1c" />
      </Box>

      <Card sx={{ border: "1px solid #e2e8f0", boxShadow: "none" }}>
        <Box sx={{ px: 3, pt: 2.5, pb: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <NotificationsIcon sx={{ fontSize: 20, color: "#64748b" }} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0f172a" }}>
                Notifications
                {unreadCount > 0 && (
                  <Chip label={unreadCount} size="small" color="primary" sx={{ ml: 1.5, height: 20, fontSize: "0.6875rem", fontWeight: 700, verticalAlign: "middle" }} />
                )}
              </Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: "#94a3b8" }}>
                {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "All caught up"}
              </Typography>
            </Box>
          </Box>
          {unreadCount > 0 && (
            <Button variant="outlined" size="small" startIcon={<DoneAll sx={{ fontSize: 14 }} />}
              onClick={() => markAllMut.mutate()} disabled={markAllMut.isPending}
              sx={{ borderRadius: "8px", height: 36, fontWeight: 600, textTransform: "none" }}>
              Mark All Read
            </Button>
          )}
        </Box>
        <Divider />

        {error && <Alert severity="error" sx={{ mx: 3, my: 2 }}>Failed to load notifications.</Alert>}

        {isLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress size={28} /></Box>
        )}

        {!isLoading && notifications.length === 0 && (
          <Box sx={{ textAlign: "center", py: 10 }}>
            <Box sx={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", mx: "auto", mb: 2 }}>
              <NotificationsIcon sx={{ fontSize: 26, color: "#cbd5e1" }} />
            </Box>
            <Typography sx={{ fontWeight: 700, color: "#374151" }}>No notifications</Typography>
            <Typography sx={{ color: "#94a3b8", fontSize: "0.875rem" }}>You're all caught up!</Typography>
          </Box>
        )}

        {notifications.map((n: any, idx: number) => {
          const cfg = typeConfig[n.type] ?? typeConfig.INFO;
          const Icon = cfg.icon;
          return (
            <Box key={n.id}>
              {idx > 0 && <Divider />}
              <Box
                sx={{
                  display: "flex", gap: 2, px: 3, py: 2.5, alignItems: "flex-start",
                  backgroundColor: n.isRead ? "transparent" : "rgba(37,99,235,0.02)",
                  cursor: n.isRead ? "default" : "pointer",
                  "&:hover": { backgroundColor: "#f8fafc" },
                }}
                onClick={() => { if (!n.isRead) markReadMut.mutate(n.id); }}
              >
                <Box sx={{ width: 36, height: 36, borderRadius: "9px", backgroundColor: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, mt: 0.25 }}>
                  <Icon sx={{ fontSize: 17, color: cfg.color }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
                    <Typography sx={{ fontWeight: n.isRead ? 500 : 700, fontSize: "0.875rem", color: "#0f172a" }}>{n.title}</Typography>
                    <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8", flexShrink: 0 }}>{formatDate(n.createdAt)}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: "0.8125rem", color: "#64748b", mt: 0.25, lineHeight: 1.45 }}>{n.message}</Typography>
                </Box>
                {!n.isRead && (
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#2563eb", flexShrink: 0, mt: 1 }} />
                )}
              </Box>
            </Box>
          );
        })}
      </Card>
    </Box>
  );
}
