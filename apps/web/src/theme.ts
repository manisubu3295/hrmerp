import { createTheme } from "@mui/material/styles";

export const SIDEBAR_WIDTH = 256;

export const theme = createTheme({
  palette: {
    mode: "light",
    primary:   { main: "#2563eb", light: "#3b82f6", dark: "#1d4ed8", contrastText: "#fff" },
    secondary: { main: "#7c3aed", light: "#8b5cf6", dark: "#6d28d9" },
    success:   { main: "#059669", light: "#d1fae5", dark: "#047857" },
    warning:   { main: "#d97706", light: "#fef3c7", dark: "#b45309" },
    error:     { main: "#dc2626", light: "#fee2e2", dark: "#b91c1c" },
    info:      { main: "#0284c7", light: "#e0f2fe", dark: "#0369a1" },
    background:{ default: "#f8fafc", paper: "#ffffff" },
    text:      { primary: "#0f172a", secondary: "#64748b", disabled: "#94a3b8" },
    divider:   "#e2e8f0",
  },
  typography: {
    fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontWeight: 800, fontSize: "2rem",    letterSpacing: "-0.03em" },
    h2: { fontWeight: 700, fontSize: "1.5rem",  letterSpacing: "-0.02em" },
    h3: { fontWeight: 700, fontSize: "1.25rem", letterSpacing: "-0.01em" },
    h4: { fontWeight: 700, fontSize: "1.125rem",letterSpacing: "-0.01em" },
    h5: { fontWeight: 600, fontSize: "1rem" },
    h6: { fontWeight: 600, fontSize: "0.875rem" },
    subtitle1: { fontWeight: 600, fontSize: "0.9375rem" },
    subtitle2: { fontWeight: 600, fontSize: "0.8125rem" },
    body1: { fontSize: "0.9375rem" },
    body2: { fontSize: "0.875rem" },
    caption: { fontSize: "0.75rem", fontWeight: 500 },
    overline: { fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em" },
    button: { fontWeight: 600, textTransform: "none", letterSpacing: "0.01em" },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "*, *::before, *::after": { boxSizing: "border-box" },
        body: { backgroundColor: "#f8fafc", overscrollBehavior: "none" },
        "*::-webkit-scrollbar": { width: "5px", height: "5px" },
        "*::-webkit-scrollbar-thumb": { background: "#cbd5e1", borderRadius: "99px" },
        "*::-webkit-scrollbar-track": { background: "transparent" },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 600, fontSize: "0.875rem", padding: "8px 18px", transition: "all 0.15s ease" },
        sizeSmall: { fontSize: "0.8125rem", padding: "5px 14px" },
        sizeLarge: { fontSize: "0.9375rem", padding: "12px 24px" },
        contained: {
          background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
          boxShadow: "0 1px 3px rgba(37,99,235,0.25), 0 4px 12px rgba(37,99,235,0.18)",
          "&:hover": { background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)", boxShadow: "0 6px 20px rgba(37,99,235,0.42)", transform: "translateY(-1px)" },
          "&:active": { transform: "translateY(0)", boxShadow: "0 1px 3px rgba(37,99,235,0.25)" },
        },
        outlined: { borderWidth: "1.5px", "&:hover": { borderWidth: "1.5px" } },
        text: { "&:hover": { backgroundColor: "rgba(37,99,235,0.06)" } },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: "1px solid rgba(226,232,240,0.7)",
          borderRadius: 16,
          backgroundImage: "none",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.06)",
          overflow: "visible",
          transition: "box-shadow 0.2s ease, transform 0.2s ease",
          "&:hover": {
            boxShadow: "0 4px 16px rgba(0,0,0,0.08), 0 16px 40px rgba(0,0,0,0.1)",
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: { root: { padding: "20px", "&:last-child": { paddingBottom: "20px" } } },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: "none", border: "1px solid rgba(226,232,240,0.7)", borderRadius: 16 },
        elevation24: { boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", border: "none" },
      },
    },
    MuiChip: {
      defaultProps: { size: "small" },
      styleOverrides: {
        root: { fontWeight: 600, fontSize: "0.7188rem", height: 22, borderRadius: 6, letterSpacing: "0.01em" },
        colorSuccess: { backgroundColor: "#dcfce7", color: "#15803d" },
        colorWarning: { backgroundColor: "#fef3c7", color: "#b45309" },
        colorError:   { backgroundColor: "#fee2e2", color: "#b91c1c" },
        colorInfo:    { backgroundColor: "#e0f2fe", color: "#0369a1" },
        colorDefault: { backgroundColor: "#f1f5f9", color: "#475569" },
        colorPrimary: { backgroundColor: "#eff6ff", color: "#1d4ed8" },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-root": {
            backgroundColor: "#f8fafc",
            fontWeight: 700,
            fontSize: "0.6875rem",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "#94a3b8",
            borderBottom: "1.5px solid #e2e8f0",
            padding: "10px 16px",
            whiteSpace: "nowrap",
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: "#f1f5f9", padding: "12px 16px", fontSize: "0.875rem", color: "#1e293b" },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: "background 0.15s, box-shadow 0.15s",
          "&:hover": { backgroundColor: "#eff6ff", "& td:first-of-type": { boxShadow: "inset 3px 0 0 #2563eb" } },
          "&:last-child td": { border: 0 },
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: { root: { borderRadius: 16, border: 0, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.06)", backgroundColor: "#fff" } },
    },
    MuiTextField: { defaultProps: { size: "small", variant: "outlined" } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: "#fff",
          fontSize: "0.875rem",
          "& fieldset": { borderColor: "#e2e8f0", borderWidth: "1.5px" },
          "&:hover fieldset": { borderColor: "#94a3b8 !important" },
          "&.Mui-focused fieldset": { borderColor: "#2563eb !important", borderWidth: "2px" },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { fontSize: "0.875rem", color: "#64748b" } },
    },
    MuiSelect: { defaultProps: { size: "small" } },
    MuiFormControl: { defaultProps: { size: "small" } },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 99, height: 6, backgroundColor: "#e2e8f0" },
        bar: { borderRadius: 99 },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10, fontSize: "0.875rem", border: "1px solid transparent", alignItems: "center" },
        standardSuccess: { backgroundColor: "#f0fdf4", color: "#15803d", borderColor: "#bbf7d0" },
        standardWarning: { backgroundColor: "#fffbeb", color: "#92400e", borderColor: "#fde68a" },
        standardError:   { backgroundColor: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca" },
        standardInfo:    { backgroundColor: "#eff6ff", color: "#1e40af", borderColor: "#bfdbfe" },
      },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: "#f1f5f9" } } },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 40 },
        indicator: { height: 3, borderRadius: "3px 3px 0 0" },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 40, fontWeight: 600, fontSize: "0.875rem",
          textTransform: "none", padding: "8px 16px",
          color: "#64748b", "&.Mui-selected": { color: "#2563eb" },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "#0f172a",
          fontSize: "0.75rem",
          borderRadius: 6,
          padding: "5px 10px",
        },
      },
    },
    MuiPagination: {
      styleOverrides: {
        root: { "& .MuiPaginationItem-root": { borderRadius: 8, fontWeight: 600, fontSize: "0.8125rem" } },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: { fontWeight: 700, fontSize: "0.6rem", minWidth: 16, height: 16, padding: "0 4px" },
      },
    },
    MuiAvatar: {
      styleOverrides: { root: { fontWeight: 700, fontSize: "0.75rem" } },
    },
    MuiListItemButton: {
      styleOverrides: { root: { borderRadius: 8, transition: "all 0.15s ease" } },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: 8, transition: "all 0.15s ease", "&:hover": { backgroundColor: "rgba(0,0,0,0.06)" } },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: "inherit" },
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          color: "#0f172a",
        },
      },
    },
  },
});
