import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Card, CardContent, Button, Chip, CircularProgress,
  Grid, TextField, Rating, Alert,
} from "@mui/material";
import { toast } from "sonner";
import { performanceApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

function statusColor(s: string): "default" | "warning" | "info" | "success" {
  if (s === "COMPLETED") return "success";
  if (s === "PENDING_MANAGER_REVIEW") return "info";
  return "warning";
}

function ReviewCard({ review, mode }: { review: any; mode: "self" | "manager" }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [rating, setRating] = useState<number | null>(null);

  const submitSelf = useMutation({
    mutationFn: () => performanceApi.submitSelfAssessment(review.id, { selfAssessment: text, selfRating: rating }),
    onSuccess: () => { toast.success("Self-assessment submitted"); qc.invalidateQueries({ queryKey: ["my-performance-reviews"] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to submit"),
  });
  const submitManager = useMutation({
    mutationFn: () => performanceApi.submitManagerReview(review.id, { managerAssessment: text, managerRating: rating }),
    onSuccess: () => { toast.success("Manager review submitted"); qc.invalidateQueries({ queryKey: ["my-performance-reviews"] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to submit"),
  });

  const canSubmit = mode === "self" ? review.status === "PENDING_SELF_ASSESSMENT" : review.status === "PENDING_MANAGER_REVIEW";

  return (
    <Card sx={{ borderRadius: "14px", boxShadow: "0 1px 8px rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.04)", mb: 2 }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
          <Box>
            <Typography sx={{ fontWeight: 700 }}>{review.cycle?.name}</Typography>
            {mode === "manager" && <Typography variant="caption" sx={{ color: "#64748b" }}>{review.employee?.firstName} {review.employee?.lastName}</Typography>}
          </Box>
          <Chip label={review.status.replace(/_/g, " ")} size="small" color={statusColor(review.status)} sx={{ fontWeight: 600, fontSize: "0.7rem" }} />
        </Box>

        {review.selfAssessment && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" sx={{ color: "#94a3b8", fontWeight: 600 }}>SELF ASSESSMENT ({review.selfRating}/5)</Typography>
            <Typography variant="body2">{review.selfAssessment}</Typography>
          </Box>
        )}
        {review.managerAssessment && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" sx={{ color: "#94a3b8", fontWeight: 600 }}>MANAGER REVIEW ({review.managerRating}/5)</Typography>
            <Typography variant="body2">{review.managerAssessment}</Typography>
          </Box>
        )}

        {canSubmit && (
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <Rating value={rating} onChange={(_, v) => setRating(v)} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline rows={3} size="small"
                label={mode === "self" ? "Your self-assessment" : "Manager assessment"}
                value={text} onChange={e => setText(e.target.value)} />
            </Grid>
            <Grid item xs={12}>
              <Button variant="contained" size="small"
                disabled={!text || !rating || submitSelf.isPending || submitManager.isPending}
                onClick={() => mode === "self" ? submitSelf.mutate() : submitManager.mutate()}
                sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>
                Submit
              </Button>
            </Grid>
          </Grid>
        )}
      </CardContent>
    </Card>
  );
}

export default function MyReviewsPage() {
  const employeeId = useAuthStore(s => s.user?.employee?.id);

  const { data: mineData, isLoading: mineLoading } = useQuery({
    queryKey: ["my-performance-reviews", employeeId],
    queryFn: () => performanceApi.getReviews({ employeeId }),
    enabled: !!employeeId,
  });
  const myReviews: any[] = mineData?.data?.data ?? [];

  const { data: allData } = useQuery({ queryKey: ["performance-reviews-for-reviewer"], queryFn: () => performanceApi.getReviews() });
  const allReviews: any[] = allData?.data?.data ?? [];
  const toReview = allReviews.filter(r => r.reviewer?.id === employeeId);

  if (!employeeId) return <Alert severity="info" sx={{ borderRadius: "10px" }}>No employee profile linked to this account.</Alert>;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={800} sx={{ color: "#0f172a", letterSpacing: "-0.02em" }}>My Reviews</Typography>
        <Typography variant="body2" sx={{ color: "#64748b", mt: 0.25 }}>Your performance reviews and self-assessments</Typography>
      </Box>

      {mineLoading ? <Box sx={{ textAlign: "center", p: 4 }}><CircularProgress size={28} /></Box> : (
        <>
          {myReviews.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: "10px", mb: 3 }}>No reviews assigned to you yet.</Alert>
          ) : myReviews.map(r => <ReviewCard key={r.id} review={r} mode="self" />)}

          {toReview.length > 0 && (
            <>
              <Typography sx={{ fontWeight: 700, mt: 3, mb: 1.5 }}>Reviews You're Responsible For</Typography>
              {toReview.map(r => <ReviewCard key={r.id} review={r} mode="manager" />)}
            </>
          )}
        </>
      )}
    </Box>
  );
}
