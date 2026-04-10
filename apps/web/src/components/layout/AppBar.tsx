import { Box, Typography, IconButton, Avatar, Chip, InputBase } from "@mui/material";
import {
  Notifications, Search, Menu as MenuIcon,
} from "@mui/icons-material";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

const TITLE_MAP: Record<string, { title: string; subtitle: string }> = {
  "/dashboard":    { title: "Dashboard",            subtitle: "Overview & insights" },
  "/projects":     { title: "Projects",             subtitle: "Manage active projects" },
  "/employees":    { title: "Employees",            subtitle: "Workforce management" },
  "/clients":      { title: "Clients",              subtitle: "Client relationships" },
  "/quotations":   { title: "Quotations",           subtitle: "Proposals & tenders" },
  "/expenses":     { title: "Expenses",             subtitle: "Cost management" },
  "/equipment":    { title: "Equipment & Inventory",subtitle: "Asset tracking" },
  "/billing":      { title: "Billing & Invoices",   subtitle: "Finance & payments" },
  "/compliance":   { title: "Work Pass Compliance", subtitle: "MOM requirements" },
  "/reports":      { title: "Analytics & Reports",  subtitle: "Business intelligence" },
  "/notifications":{ title: "Notifications",        subtitle: "Alerts & updates" },
  "/timesheets":   { title: "Timesheets",           subtitle: "Attendance & hours" },
};

export function AppBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { pathname } = useLocation();
  const { user } = useAuthStore();
  const base = "/" + pathname.split("/")[1];
  const pageInfo = TITLE_MAP[base] ?? { title: "SankoERP", subtitle: "" };

  const initials = user?.employee
    ? `${user.employee.firstName[0]}${user.employee.lastName[0]}`
    : user?.email?.slice(0, 2).toUpperCase() ?? "SA";

  const { data: unreadCount } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => notificationsApi.getUnreadCount().then((r) => r.data.data as number),
    refetchInterval: 30_000,
  });

  const hasUnread = (unreadCount ?? 0) > 0;

  return (
    <Box
      sx={{
        height: 64,
        display: "flex",
        alignItems: "center",
        px: 3,
        gap: 3,
        backgroundColor: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(226,232,240,0.6)",
        boxShadow: "0 1px 8px rgba(0,0,0,0.05)",
        flexShrink: 0,
      }}
    >
      {/* Hamburger — mobile only */}
      <IconButton
        onClick={onMenuClick}
        size="small"
        sx={{
          display: { xs: "flex", lg: "none" },
          mr: 0.5,
          width: 36, height: 36,
          borderRadius: "10px",
          border: "1.5px solid #e2e8f0",
          color: "#334155",
          "&:hover": { backgroundColor: "#f1f5f9" },
        }}
      >
        <MenuIcon sx={{ fontSize: 20 }} />
      </IconButton>

      {/* Page Title */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: "#0f172a", lineHeight: 1.2, fontSize: "1rem" }}>
          {pageInfo.title}
        </Typography>
        {pageInfo.subtitle && (
          <Typography variant="caption" sx={{ color: "#94a3b8", fontWeight: 500 }}>
            {pageInfo.subtitle}
          </Typography>
        )}
      </Box>

      {/* Search Bar */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          alignItems: "center",
          gap: 1,
          borderRadius: "10px",
          border: "1.5px solid #e2e8f0",
          px: 1.5,
          py: 0.75,
          backgroundColor: "#f8fafc",
          minWidth: 220,
          cursor: "text",
          transition: "all 0.15s",
          "&:hover": { borderColor: "#94a3b8" },
          "&:focus-within": { borderColor: "#2563eb", backgroundColor: "#fff", boxShadow: "0 0 0 3px rgba(37,99,235,0.1)" },
        }}
      >
        <Search sx={{ fontSize: 15, color: "#94a3b8" }} />
        <InputBase
          placeholder="Quick search…"
          sx={{ fontSize: "0.8125rem", flex: 1, color: "#0f172a", "& ::placeholder": { color: "#94a3b8" } }}
        />
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, px: 0.5, py: 0.125, borderRadius: "5px", border: "1px solid #e2e8f0", backgroundColor: "#fff" }}>
          <Typography sx={{ fontSize: "0.65rem", color: "#94a3b8", fontWeight: 600, lineHeight: 1.4 }}>⌘K</Typography>
        </Box>
      </Box>

      {/* Notifications */}
      <IconButton
        component={RouterLink}
        to="/notifications"
        size="small"
        sx={{
          width: 36, height: 36,
          backgroundColor: hasUnread ? "#eff6ff" : "#f8fafc",
          border: `1.5px solid ${hasUnread ? "#bfdbfe" : "#e2e8f0"}`,
          borderRadius: "10px",
          color: hasUnread ? "#2563eb" : "#64748b",
          position: "relative",
          "&:hover": { backgroundColor: "#eff6ff", borderColor: "#bfdbfe", color: "#2563eb" },
        }}
      >
        <Notifications sx={{ fontSize: 17 }} />
        {hasUnread && (
          <Box
            sx={{
              position: "absolute", top: 3, right: 3,
              width: 8, height: 8, borderRadius: "50%",
              backgroundColor: "#ef4444",
              border: "1.5px solid white",
            }}
          />
        )}
      </IconButton>

      {/* User Avatar */}
      <Box
        sx={{
          display: "flex", alignItems: "center", gap: 1.25,
          pl: 1.5, borderLeft: "1.5px solid #f1f5f9", cursor: "pointer",
        }}
      >
        <Avatar
          sx={{
            width: 32, height: 32,
            background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
            fontSize: "0.7rem", fontWeight: 700,
          }}
        >
          {initials}
        </Avatar>
        <Box sx={{ display: { xs: "none", lg: "block" } }}>
          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0f172a", lineHeight: 1.2 }}>
            {user?.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user?.email}
          </Typography>
          <Typography sx={{ fontSize: "0.6875rem", color: "#94a3b8", textTransform: "capitalize" }}>
            {(user?.role ?? "").toLowerCase().replace(/_/g, " ")}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
