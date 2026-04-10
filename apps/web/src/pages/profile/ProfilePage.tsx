import { useEffect } from "react";
import {
  Box, Typography, Paper, Grid, TextField, Button, Divider,
  Chip, Stack, Alert, CircularProgress, Avatar,
} from "@mui/material";
import { Lock, Person } from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

// ── Profile Edit Form ─────────────────────────────────────────────────────────
function ProfileForm({ profile }: { profile: { id: string; email: string; role: string; employee?: { firstName?: string; lastName?: string; jobTitle?: string } | null } }) {
  const qc = useQueryClient();
  const { user, setAuth, token } = useAuthStore();
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm({
    defaultValues: { email: profile.email },
  });

  useEffect(() => { reset({ email: profile.email }); }, [profile.email, reset]);

  const mutation = useMutation({
    mutationFn: (data: { email: string }) => authApi.updateProfile(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      // Update the auth store email
      if (user) setAuth({ ...user, email: res.data.data.email }, token!);
    },
  });

  const initials = profile.employee
    ? `${profile.employee.firstName?.[0] ?? ""}${profile.employee.lastName?.[0] ?? ""}`
    : profile.email.slice(0, 2).toUpperCase();

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Person sx={{ color: "primary.main" }} />
        <Typography variant="h6" fontWeight={600}>Profile Information</Typography>
      </Stack>
      <Divider sx={{ mb: 3 }} />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ mb: 3, alignItems: "center" }}>
        <Avatar
          sx={{
            width: 72, height: 72, fontSize: "1.5rem", fontWeight: 700,
            background: "linear-gradient(135deg, #2563eb, #7c3aed)",
          }}
        >
          {initials}
        </Avatar>
        <Box>
          {profile.employee ? (
            <Typography variant="h6" fontWeight={700}>
              {profile.employee.firstName} {profile.employee.lastName}
            </Typography>
          ) : (
            <Typography variant="h6" fontWeight={700}>{profile.email}</Typography>
          )}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <Chip
              label={profile.role.replace(/_/g, " ")}
              size="small"
              color="primary"
              variant="outlined"
            />
            {profile.employee?.jobTitle && (
              <Typography variant="body2" color="text.secondary">{profile.employee.jobTitle}</Typography>
            )}
          </Stack>
        </Box>
      </Stack>

      {mutation.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(mutation.error as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Update failed"}
        </Alert>
      )}
      {mutation.isSuccess && <Alert severity="success" sx={{ mb: 2 }}>Email updated successfully</Alert>}

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Email Address"
              fullWidth
              {...register("email", {
                required: "Email is required",
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Invalid email" },
              })}
              error={!!errors.email}
              helperText={errors.email?.message}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Role"
              fullWidth
              value={profile.role.replace(/_/g, " ")}
              InputProps={{ readOnly: true }}
              sx={{ "& .MuiInputBase-input": { color: "text.secondary" } }}
            />
          </Grid>
        </Grid>
        <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
          <Button
            type="submit"
            variant="contained"
            disabled={!isDirty || mutation.isPending}
          >
            {mutation.isPending ? <CircularProgress size={18} /> : "Save Changes"}
          </Button>
        </Box>
      </form>
    </Paper>
  );
}

// ── Change Password Form ──────────────────────────────────────────────────────
function ChangePasswordForm() {
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(data.currentPassword, data.newPassword),
    onSuccess: () => reset(),
  });

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Lock sx={{ color: "warning.main" }} />
        <Typography variant="h6" fontWeight={600}>Change Password</Typography>
      </Stack>
      <Divider sx={{ mb: 3 }} />

      {mutation.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(mutation.error as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Failed to change password"}
        </Alert>
      )}
      {mutation.isSuccess && <Alert severity="success" sx={{ mb: 2 }}>Password changed successfully</Alert>}

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
        <Stack spacing={2}>
          <TextField
            label="Current Password"
            type="password"
            fullWidth
            {...register("currentPassword", { required: "Required" })}
            error={!!errors.currentPassword}
            helperText={errors.currentPassword?.message}
          />
          <TextField
            label="New Password"
            type="password"
            fullWidth
            {...register("newPassword", {
              required: "Required",
              minLength: { value: 8, message: "Minimum 8 characters" },
            })}
            error={!!errors.newPassword}
            helperText={errors.newPassword?.message}
          />
          <TextField
            label="Confirm New Password"
            type="password"
            fullWidth
            {...register("confirmPassword", {
              required: "Required",
              validate: (v) => v === watch("newPassword") || "Passwords do not match",
            })}
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword?.message}
          />
        </Stack>
        <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
          <Button type="submit" variant="contained" color="warning" disabled={mutation.isPending}>
            {mutation.isPending ? <CircularProgress size={18} /> : "Change Password"}
          </Button>
        </Box>
      </form>
    </Paper>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => authApi.getProfile(),
  });

  const profile = data?.data?.data;

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!profile) return null;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>My Profile</Typography>
        <Typography variant="body2" color="text.secondary">
          Manage your account details and password
        </Typography>
      </Box>

      <Stack spacing={3} sx={{ maxWidth: 760 }}>
        <ProfileForm profile={profile} />
        <ChangePasswordForm />
      </Stack>
    </Box>
  );
}
