import { useState } from "react";
import { useNavigate, useParams, Link as RouterLink } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Box, Button, TextField, Typography, Alert, CircularProgress,
  Link, InputAdornment, IconButton,
} from "@mui/material";
import { Visibility, VisibilityOff, LockOutlined } from "@mui/icons-material";
import { toast } from "sonner";
import { authApi } from "@/lib/api";

const schema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirm: z.string(),
}).refine((d) => d.newPassword === d.confirm, {
  message: "Passwords do not match",
  path: ["confirm"],
});
type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [serverError, setServerError] = useState("");

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    if (!token) return;
    setServerError("");
    try {
      await authApi.resetPassword(token, data.newPassword);
      toast.success("Password reset successfully. Please log in.");
      navigate("/login", { replace: true });
    } catch (err: any) {
      setServerError(err?.response?.data?.message ?? "Invalid or expired reset link.");
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, #0d1117 0%, #0f1a2e 60%, #0d1117 100%)",
        p: 2,
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: "20px",
          p: { xs: 3, sm: 5 },
          boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
        }}
      >
        {/* Logo */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 4 }}>
          <Box
            sx={{
              width: 40, height: 40, borderRadius: "10px",
              background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: "1rem" }}>S</Typography>
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: "1.125rem", color: "#0f172a", letterSpacing: "-0.02em" }}>
            SankoERP
          </Typography>
        </Box>

        <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Box
            sx={{
              width: 56, height: 56, borderRadius: "50%", background: "#eff6ff",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <LockOutlined sx={{ fontSize: 28, color: "#2563eb" }} />
          </Box>
        </Box>

        <Typography sx={{ fontWeight: 700, fontSize: "1.5rem", color: "#0f172a", mb: 0.5, textAlign: "center" }}>
          Set new password
        </Typography>
        <Typography sx={{ color: "#64748b", fontSize: "0.9rem", mb: 3, textAlign: "center" }}>
          Choose a strong password with at least 8 characters.
        </Typography>

        {serverError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: "10px" }}>
            {serverError}{" "}
            <Link component={RouterLink} to="/forgot-password" sx={{ fontWeight: 600 }}>
              Request a new link
            </Link>
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            {...register("newPassword")}
            label="New password"
            type={showPw ? "text" : "password"}
            fullWidth
            autoFocus
            error={!!errors.newPassword}
            helperText={errors.newPassword?.message}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPw(p => !p)} edge="end" size="small">
                    {showPw ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
          />

          <TextField
            {...register("confirm")}
            label="Confirm password"
            type={showPw ? "text" : "password"}
            fullWidth
            error={!!errors.confirm}
            helperText={errors.confirm?.message}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={isSubmitting}
            sx={{
              borderRadius: "10px", textTransform: "none", fontWeight: 700,
              background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
              height: 48,
            }}
          >
            {isSubmitting ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Reset password"}
          </Button>

          <Link component={RouterLink} to="/login" sx={{ textAlign: "center", fontSize: "0.875rem", fontWeight: 600, color: "#64748b", textDecoration: "none", "&:hover": { color: "#2563eb" } }}>
            ← Back to login
          </Link>
        </Box>
      </Box>
    </Box>
  );
}
