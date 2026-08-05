import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Box, Button, TextField, Typography, Alert, CircularProgress, Link,
} from "@mui/material";
import { EmailOutlined, ArrowBack } from "@mui/icons-material";
import { authApi } from "@/lib/api";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState("");

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setServerError("");
    try {
      await authApi.forgotPassword(data.email);
      setSent(true);
    } catch (err: any) {
      setServerError(err?.response?.data?.message ?? "Something went wrong. Please try again.");
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
            <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: "1rem" }}>A</Typography>
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: "1.125rem", color: "#0f172a", letterSpacing: "-0.02em" }}>
            Aadhirai HRM OS
          </Typography>
        </Box>

        {sent ? (
          <Box sx={{ textAlign: "center" }}>
            <Box
              sx={{
                width: 64, height: 64, borderRadius: "50%", background: "#f0fdf4",
                display: "flex", alignItems: "center", justifyContent: "center", mx: "auto", mb: 2,
              }}
            >
              <EmailOutlined sx={{ fontSize: 32, color: "#16a34a" }} />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: "1.25rem", color: "#0f172a", mb: 1 }}>
              Check your email
            </Typography>
            <Typography sx={{ color: "#64748b", fontSize: "0.9rem", mb: 3 }}>
              If an account exists for that email, we've sent a password reset link. It expires in 1 hour.
            </Typography>
            <Button
              component={RouterLink}
              to="/login"
              startIcon={<ArrowBack />}
              variant="outlined"
              fullWidth
              sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 600 }}
            >
              Back to login
            </Button>
          </Box>
        ) : (
          <>
            <Typography sx={{ fontWeight: 700, fontSize: "1.5rem", color: "#0f172a", mb: 0.5 }}>
              Forgot password?
            </Typography>
            <Typography sx={{ color: "#64748b", fontSize: "0.9rem", mb: 3 }}>
              Enter your email and we'll send you a reset link.
            </Typography>

            {serverError && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: "10px" }}>
                {serverError}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                {...register("email")}
                label="Email address"
                type="email"
                fullWidth
                autoFocus
                error={!!errors.email}
                helperText={errors.email?.message}
                InputProps={{
                  startAdornment: <EmailOutlined sx={{ mr: 1, color: "#94a3b8", fontSize: 20 }} />,
                }}
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
                {isSubmitting ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Send reset link"}
              </Button>

              <Link component={RouterLink} to="/login" sx={{ textAlign: "center", fontSize: "0.875rem", fontWeight: 600, color: "#64748b", textDecoration: "none", "&:hover": { color: "#2563eb" } }}>
                ← Back to login
              </Link>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
