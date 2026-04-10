import { useLocation, useNavigate } from "react-router-dom";
import {
  Box, Typography, Avatar, Divider, Tooltip, Drawer,
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  FolderOpen,
  People,
  Description,
  Receipt,
  Build,
  CreditCard,
  Security,
  Notifications,
  BarChart,
  Business,
  Logout,
  KeyboardArrowRight,
  AccessTime,
  EventNote,
  CalendarMonth,
  AccountBalance,
  Settings as SettingsIcon,
  ManageAccounts,
  AccountCircle,
  LocalShipping,
} from "@mui/icons-material";
import { useAuthStore } from "@/store/auth.store";
import { SIDEBAR_WIDTH } from "@/theme";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ sx?: object }>; roles?: string[] };

const MGMT = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'];
const ADMIN_ONLY = ['ADMIN', 'SUPER_ADMIN'];

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Core",
    items: [
      { href: "/dashboard",  label: "Dashboard",  icon: DashboardIcon },
      { href: "/projects",   label: "Projects",   icon: FolderOpen, roles: [...MGMT, 'SUPERVISOR'] },
      { href: "/employees",  label: "Employees",  icon: People,      roles: MGMT },
      { href: "/clients",    label: "Clients",    icon: Business,    roles: MGMT },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/quotations",          label: "Quotations", icon: Description,    roles: MGMT },
      { href: "/expenses",            label: "Expenses",   icon: Receipt },
      { href: "/timesheets",          label: "Timesheets", icon: AccessTime },
      { href: "/leave",               label: "Leave",      icon: EventNote },
      { href: "/calendar",            label: "Calendar",   icon: CalendarMonth },
      { href: "/payroll",             label: "Payroll",    icon: AccountBalance, roles: MGMT },
      { href: "/payroll/my-payslips", label: "My Payslips",icon: AccountBalance, roles: ['EMPLOYEE', 'SUPERVISOR'] },
      { href: "/equipment",           label: "Equipment",  icon: Build,          roles: MGMT },
      { href: "/suppliers",            label: "Suppliers",  icon: LocalShipping,  roles: MGMT },
      { href: "/billing",             label: "Billing",    icon: CreditCard,     roles: MGMT },
    ],
  },
  {
    label: "Compliance & Reports",
    items: [
      { href: "/compliance",    label: "Work Passes", icon: Security,       roles: MGMT },
      { href: "/reports",       label: "Analytics",   icon: BarChart,        roles: MGMT },
      { href: "/notifications", label: "Alerts",      icon: Notifications },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/users",    label: "Users",    icon: ManageAccounts, roles: ADMIN_ONLY },
      { href: "/settings", label: "Settings", icon: SettingsIcon,   roles: ADMIN_ONLY },
      { href: "/profile",  label: "My Profile", icon: AccountCircle },
    ],
  },
];

export function Sidebar({ mobileOpen, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();

  const userRole = user?.role ?? '';

  const initials = user?.employee
    ? `${user.employee.firstName[0]}${user.employee.lastName[0]}`
    : user?.email?.slice(0, 2).toUpperCase() ?? "SA";

  const displayName = user?.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`
    : user?.email ?? "Admin";

  function handleLogout() {
    clearAuth();
    navigate("/login", { replace: true });
  }

  function handleNav(href: string) {
    navigate(href);
    onClose?.();
  }

  const content = (
    <Box
      sx={{
        width: SIDEBAR_WIDTH,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(180deg, #0d1117 0%, #0f1623 100%)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        overflowY: "auto",
        overflowX: "hidden",
        "&::-webkit-scrollbar": { width: "3px" },
        "&::-webkit-scrollbar-thumb": { background: "rgba(255,255,255,0.15)", borderRadius: "99px" },
        "&::-webkit-scrollbar-thumb:hover": { background: "rgba(255,255,255,0.25)" },
        "&::-webkit-scrollbar-track": { background: "transparent" },
      }}
    >
      {/* Logo */}
      <Box sx={{ px: 3, pt: 3, pb: 2.5, flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 36, height: 36, borderRadius: "10px",
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 16px rgba(37,99,235,0.4)",
              flexShrink: 0,
            }}
          >
            <Typography sx={{ color: "white", fontWeight: 900, fontSize: "0.9375rem", letterSpacing: "-0.02em" }}>
              SE
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ color: "white", fontWeight: 800, fontSize: "0.9375rem", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              SankoERP
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.35)", fontSize: "0.65rem", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Enterprise Platform
            </Typography>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.06)", mx: 2.5, flexShrink: 0 }} />

      {/* Navigation */}
      <Box sx={{ flex: 1, px: 2, pt: 2, pb: 1 }}>
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) => !item.roles || item.roles.includes(userRole));
          if (visibleItems.length === 0) return null;
          return (
          <Box key={section.label} sx={{ mb: 3 }}>
            <Typography
              sx={{
                color: "rgba(255,255,255,0.28)", fontSize: "0.625rem", fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase", px: 1.5, mb: 0.75,
              }}
            >
              {section.label}
            </Typography>
            {visibleItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
              return (
                <Tooltip key={href} title="" placement="right">
                  <Box
                    onClick={() => handleNav(href)}
                    sx={{
                      display: "flex", alignItems: "center", gap: 2,
                      px: 1.5, py: 1, borderRadius: "9px", mb: 0.25,
                      cursor: "pointer",
                      position: "relative",
                      backgroundColor: isActive ? "rgba(37,99,235,0.2)" : "transparent",
                      color: isActive ? "#93c5fd" : "rgba(255,255,255,0.5)",
                      transition: "all 0.15s ease",
                      "&:hover": {
                        backgroundColor: isActive ? "rgba(37,99,235,0.22)" : "rgba(255,255,255,0.06)",
                        color: isActive ? "#93c5fd" : "rgba(255,255,255,0.85)",
                      },
                      ...(isActive && {
                        "&::before": {
                          content: '""', position: "absolute", left: 0, top: "25%", bottom: "25%",
                          width: "3px", borderRadius: "0 3px 3px 0",
                          backgroundColor: "#3b82f6",
                          marginLeft: "-8px",
                        },
                      }),
                    }}
                  >
                    <Icon sx={{ fontSize: 17, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: "0.8438rem", fontWeight: isActive ? 600 : 400, lineHeight: 1, flex: 1 }}>
                      {label}
                    </Typography>
                    {isActive && (
                      <KeyboardArrowRight sx={{ fontSize: 14, opacity: 0.5 }} />
                    )}
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
          );
        })}
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.06)", mx: 2.5, flexShrink: 0 }} />

      {/* User Profile */}
      <Box
        sx={{
          px: 2, py: 2,
          display: "flex", alignItems: "center", gap: 1.5,
          borderRadius: "10px", mx: 1.5, my: 1.5,
          backgroundColor: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
          cursor: "default",
          flexShrink: 0,
        }}
      >
        <Avatar
          sx={{
            width: 32, height: 32,
            background: "linear-gradient(135deg, #2563eb, #7c3aed)",
            fontSize: "0.7rem", fontWeight: 700, flexShrink: 0,
          }}
        >
          {initials}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: "rgba(255,255,255,0.9)", fontWeight: 600, fontSize: "0.8125rem", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {displayName}
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.32)", fontSize: "0.6875rem", textTransform: "capitalize" }}>
            {(user?.role ?? "").toLowerCase().replace(/_/g, " ")}
          </Typography>
        </Box>
        <Tooltip title="Sign out">
          <Box
            onClick={handleLogout}
            sx={{
              display: "flex", p: 0.75, borderRadius: 1.5, cursor: "pointer",
              color: "rgba(255,255,255,0.3)",
              transition: "all 0.15s",
              "&:hover": { color: "#ef4444", backgroundColor: "rgba(239,68,68,0.12)" },
            }}
          >
            <Logout sx={{ fontSize: 15 }} />
          </Box>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Mobile: temporary Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen ?? false}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", lg: "none" },
          "& .MuiDrawer-paper": {
            width: SIDEBAR_WIDTH,
            boxSizing: "border-box",
            border: "none",
            background: "transparent",
          },
        }}
      >
        {content}
      </Drawer>

      {/* Desktop: permanent fixed sidebar */}
      <Box
        sx={{
          display: { xs: "none", lg: "block" },
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          position: "fixed",
          left: 0,
          top: 0,
          height: "100vh",
          zIndex: 1200,
        }}
      >
        {content}
      </Box>
    </>
  );
}
