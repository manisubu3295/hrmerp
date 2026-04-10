import { useState } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Box, Button, TextField, Typography, Alert, CircularProgress,
  InputAdornment, IconButton, Link,
} from "@mui/material";
import { Visibility, VisibilityOff, TrendingUp, People, AssignmentTurnedIn, SecurityOutlined } from "@mui/icons-material";
import { toast } from "sonner";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

const schema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});
type FormData = z.infer<typeof schema>;

const FEATURES = [
  { icon: TrendingUp,           title: "Real-Time Analytics",     desc: "Live project dashboards with profit tracking" },
  { icon: People,               title: "Workforce Management",    desc: "Employee records, payroll & attendance" },
  { icon: AssignmentTurnedIn,   title: "Billing & Quotations",    desc: "Automated invoicing with payment tracking" },
  { icon: SecurityOutlined,     title: "MOM Compliance",          desc: "Work pass renewals, alerts & audit trail" },
];

const STATS = [
  { value: "99.9%", label: "Uptime" },
  { value: "256-bit", label: "Encryption" },
  { value: "Real-time", label: "Data Sync" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setServerError("");
    try {
      const res = await authApi.login(data.email, data.password);
      setAuth(res.data.data.user, res.data.data.token);
      toast.success("Welcome back!");
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Invalid credentials. Please try again.";
      setServerError(msg);
    }
  };

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* ── Left Brand Panel ── */}
      <Box
        sx={{
          display: { xs: "none", lg: "flex" },
          flexDirection: "column",
          width: "48%",
          position: "relative",
          background: "linear-gradient(160deg, #0d1117 0%, #0f1a2e 60%, #0d1117 100%)",
          overflow: "hidden",
          p: 6,
        }}
      >
        {/* Background accents */}
        <Box sx={{ position: "absolute", top: -100, right: -60, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />
        <Box sx={{ position: "absolute", bottom: -80, left: -80, width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
        <Box sx={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "28px 28px", pointerEvents: "none" }} />

        {/* Logo */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 6, position: "relative", zIndex: 1 }}>
          <Box
            sx={{
              width: 44, height: 44, borderRadius: "12px",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 32px rgba(37,99,235,0.5)",
            }}
          >
            <Typography sx={{ color: "white", fontWeight: 900, fontSize: "1rem", letterSpacing: "-0.02em" }}>SE</Typography>
          </Box>
          <Box>
            <Typography sx={{ color: "white", fontWeight: 800, fontSize: "1.125rem", letterSpacing: "-0.02em", lineHeight: 1 }}>
              SankoERP
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Enterprise Platform
            </Typography>
          </Box>
        </Box>

        {/* Hero copy */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 1 }}>
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, px: 1.5, py: 0.75, borderRadius: "99px", backgroundColor: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)", mb: 3, width: "fit-content" }}>
            <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#3b82f6" }} />
            <Typography sx={{ color: "#93c5fd", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.04em" }}>
              Manpower Agency ERP
            </Typography>
          </Box>

          <Typography sx={{ color: "white", fontSize: "2.5rem", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.04em", mb: 2 }}>
            Run your entire{" "}
            <Box component="span" sx={{ background: "linear-gradient(90deg, #3b82f6, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              business
            </Box>
            {" "}from one platform.
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.45)", fontSize: "1rem", lineHeight: 1.65, mb: 5, maxWidth: 380 }}>
            Purpose-built for Singapore manpower agencies. Projects, payroll, compliance — all in one place.
          </Typography>

          {/* Feature list */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 6 }}>
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <Box key={title} sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                <Box sx={{ width: 32, height: 32, borderRadius: "8px", backgroundColor: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon sx={{ fontSize: 15, color: "#60a5fa" }} />
                </Box>
                <Box>
                  <Typography sx={{ color: "rgba(255,255,255,0.85)", fontWeight: 600, fontSize: "0.875rem", lineHeight: 1.3 }}>{title}</Typography>
                  <Typography sx={{ color: "rgba(255,255,255,0.35)", fontSize: "0.8125rem", lineHeight: 1.5 }}>{desc}</Typography>
                </Box>
              </Box>
            ))}
          </Box>

          {/* Stats */}
          <Box sx={{ display: "flex", gap: 3, pt: 3, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            {STATS.map(({ value, label }) => (
              <Box key={label}>
                <Typography sx={{ color: "white", fontWeight: 800, fontSize: "1rem", letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.35)", fontSize: "0.75rem", fontWeight: 500, mt: 0.25 }}>{label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* ── Right Sign-In Panel ── */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f1f5f9",
          p: 3,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, height: "40%", background: "linear-gradient(180deg, #e7edf3 0%, transparent 100%)", pointerEvents: "none" }} />

        <Box sx={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}>
          {/* Mobile logo */}
          <Box sx={{ display: { xs: "flex", lg: "none" }, alignItems: "center", gap: 1.5, mb: 6, justifyContent: "center" }}>
            <Box sx={{ width: 36, height: 36, borderRadius: "9px", background: "linear-gradient(135deg, #2563eb, #1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(37,99,235,0.4)" }}>
              <Typography sx={{ color: "white", fontWeight: 900, fontSize: "0.875rem" }}>SE</Typography>
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: "1.125rem", color: "#0f172a" }}>SankoERP</Typography>
          </Box>

          {/* Card */}
          <Box
            sx={{
              backgroundColor: "white",
              borderRadius: "20px",
              border: "1px solid #e2e8f0",
              p: 4,
              boxShadow: "0 8px 40px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <Box sx={{ mb: 3.5 }}>
              <Typography variant="h3" sx={{ fontWeight: 800, color: "#0f172a", mb: 0.5, fontSize: "1.5rem", letterSpacing: "-0.03em" }}>
                Welcome back
              </Typography>
              <Typography sx={{ color: "#64748b", fontSize: "0.9rem" }}>
                Sign in to your SankoERP dashboard
              </Typography>
            </Box>

            {serverError && (
              <Alert severity="error" sx={{ mb: 2.5, borderRadius: "10px" }}>
                {serverError}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box>
                <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "#374151", mb: 0.75 }}>Email address</Typography>
                <TextField
                  type="email"
                  fullWidth
                  placeholder="admin@sankoerp.com"
                  {...register("email")}
                  error={!!errors.email}
                  helperText={errors.email?.message}
                  autoComplete="email"
                  autoFocus
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "10px",
                      backgroundColor: "#f8fafc",
                      "&.Mui-focused": { backgroundColor: "#fff" },
                    },
                  }}
                />
              </Box>

              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75 }}>
                  <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "#374151" }}>Password</Typography>
                  <Link component={RouterLink} to="/forgot-password" sx={{ fontSize: "0.8125rem", color: "#2563eb", textDecoration: "none", fontWeight: 600, "&:hover": { textDecoration: "underline" } }}>
                    Forgot password?
                  </Link>
                </Box>
                <TextField
                  type={showPassword ? "text" : "password"}
                  fullWidth
                  placeholder="••••••••"
                  {...register("password")}
                  error={!!errors.password}
                  helperText={errors.password?.message}
                  autoComplete="current-password"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowPassword(!showPassword)} edge="end">
                          {showPassword ? <VisibilityOff sx={{ fontSize: 17 }} /> : <Visibility sx={{ fontSize: 17 }} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "10px",
                      backgroundColor: "#f8fafc",
                      "&.Mui-focused": { backgroundColor: "#fff" },
                    },
                  }}
                />
              </Box>

              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={isSubmitting}
                sx={{
                  mt: 0.5,
                  borderRadius: "10px",
                  height: 46,
                  fontSize: "0.9375rem",
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  boxShadow: "0 4px 16px rgba(37,99,235,0.4)",
                  "&:hover": { boxShadow: "0 6px 20px rgba(37,99,235,0.5)", transform: "translateY(-1px)" },
                  "&:active": { transform: "translateY(0)" },
                  "&:disabled": { opacity: 0.7, transform: "none" },
                }}
              >
                {isSubmitting ? (
                  <CircularProgress size={22} sx={{ color: "rgba(255,255,255,0.8)" }} />
                ) : (
                  "Sign in to Dashboard"
                )}
              </Button>
            </Box>
          </Box>

          <Typography sx={{ textAlign: "center", mt: 3, fontSize: "0.75rem", color: "#94a3b8" }}>
            SankoERP &copy; {new Date().getFullYear()} &bull; Secure enterprise platform
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
