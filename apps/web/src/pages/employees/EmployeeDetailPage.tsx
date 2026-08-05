import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, CircularProgress, Alert, Typography,
  Grid, Divider, Tabs, Tab, Avatar, Table, TableHead, TableRow, TableCell, TableBody,
  FormControl, InputLabel, Select, MenuItem,
} from "@mui/material";
import { ArrowBack, Edit, People } from "@mui/icons-material";
import { toast } from "sonner";
import { employeesApi, skillsApi, checklistsApi, performanceApi, employeeCasesApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const PROFICIENCIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];

function SkillsTab({ employeeId }: { employeeId: string }) {
  const qc = useQueryClient();
  const { data: skillsData, isLoading } = useQuery({ queryKey: ["employee-skills", employeeId], queryFn: () => skillsApi.getEmployeeSkills(employeeId) });
  const employeeSkills: any[] = skillsData?.data?.data ?? [];

  const { data: catalogData } = useQuery({ queryKey: ["skill-catalog"], queryFn: () => skillsApi.getCatalog() });
  const catalog: any[] = catalogData?.data?.data ?? [];
  const available = catalog.filter(c => !employeeSkills.some(es => es.skillId === c.id));

  const [skillId, setSkillId] = useState("");
  const addMut = useMutation({
    mutationFn: () => skillsApi.setEmployeeSkill(employeeId, skillId, { proficiency: "BEGINNER" }),
    onSuccess: () => { toast.success("Skill added"); qc.invalidateQueries({ queryKey: ["employee-skills", employeeId] }); setSkillId(""); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to add skill"),
  });

  if (isLoading) return <Box sx={{ textAlign: "center", p: 4 }}><CircularProgress size={24} /></Box>;

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Add Skill</InputLabel>
            <Select value={skillId} label="Add Skill" onChange={e => setSkillId(e.target.value)}>
              {available.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" size="small" disabled={!skillId || addMut.isPending} onClick={() => addMut.mutate()}
            sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, boxShadow: "none" }}>Add</Button>
        </Box>
        {employeeSkills.length === 0 ? (
          <Typography variant="body2" sx={{ color: "#94a3b8" }}>No skills recorded yet.</Typography>
        ) : (
          <Table size="small">
            <TableHead><TableRow><TableCell>Skill</TableCell><TableCell>Proficiency</TableCell></TableRow></TableHead>
            <TableBody>
              {employeeSkills.map(es => (
                <TableRow key={es.id}>
                  <TableCell sx={{ fontSize: "0.8rem" }}>{es.skill?.name}</TableCell>
                  <TableCell><Chip label={es.proficiency} size="small" sx={{ fontWeight: 600, fontSize: "0.7rem" }} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ChecklistsTab({ employeeId }: { employeeId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["employee-checklists", employeeId], queryFn: () => checklistsApi.getInstances({ employeeId }) });
  const instances: any[] = data?.data?.data ?? [];
  if (isLoading) return <Box sx={{ textAlign: "center", p: 4 }}><CircularProgress size={24} /></Box>;
  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        {instances.length === 0 ? (
          <Typography variant="body2" sx={{ color: "#94a3b8" }}>No onboarding/offboarding checklists for this employee.</Typography>
        ) : (
          <Table size="small">
            <TableHead><TableRow><TableCell>Purpose</TableCell><TableCell>Template</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
            <TableBody>
              {instances.map(i => (
                <TableRow key={i.id}>
                  <TableCell sx={{ fontSize: "0.8rem" }}>{i.purpose}</TableCell>
                  <TableCell sx={{ fontSize: "0.8rem" }}>{i.template?.name}</TableCell>
                  <TableCell><Chip label={i.status} size="small" color={i.status === "COMPLETED" ? "success" : "warning"} sx={{ fontWeight: 600, fontSize: "0.7rem" }} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function PerformanceTab({ employeeId }: { employeeId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["employee-performance", employeeId], queryFn: () => performanceApi.getReviews({ employeeId }) });
  const reviews: any[] = data?.data?.data ?? [];
  if (isLoading) return <Box sx={{ textAlign: "center", p: 4 }}><CircularProgress size={24} /></Box>;
  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        {reviews.length === 0 ? (
          <Typography variant="body2" sx={{ color: "#94a3b8" }}>No performance reviews yet.</Typography>
        ) : (
          <Table size="small">
            <TableHead><TableRow><TableCell>Cycle</TableCell><TableCell align="right">Self</TableCell><TableCell align="right">Manager</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
            <TableBody>
              {reviews.map(r => (
                <TableRow key={r.id}>
                  <TableCell sx={{ fontSize: "0.8rem" }}>{r.cycle?.name}</TableCell>
                  <TableCell align="right">{r.selfRating ?? "—"}</TableCell>
                  <TableCell align="right">{r.managerRating ?? "—"}</TableCell>
                  <TableCell><Chip label={r.status.replace(/_/g, " ")} size="small" sx={{ fontWeight: 600, fontSize: "0.7rem" }} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function CasesTab({ employeeId }: { employeeId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["employee-cases-for-employee", employeeId], queryFn: () => employeeCasesApi.getAll({ employeeId }) });
  const cases: any[] = data?.data?.data ?? [];
  if (isLoading) return <Box sx={{ textAlign: "center", p: 4 }}><CircularProgress size={24} /></Box>;
  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        {cases.length === 0 ? (
          <Typography variant="body2" sx={{ color: "#94a3b8" }}>No cases on record for this employee.</Typography>
        ) : (
          <Table size="small">
            <TableHead><TableRow><TableCell>Code</TableCell><TableCell>Title</TableCell><TableCell>Type</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
            <TableBody>
              {cases.map(c => (
                <TableRow key={c.id}>
                  <TableCell sx={{ fontWeight: 600, color: "#2563eb", fontSize: "0.8rem" }}>{c.caseCode}</TableCell>
                  <TableCell sx={{ fontSize: "0.8rem" }}>{c.title}</TableCell>
                  <TableCell sx={{ fontSize: "0.8rem" }}>{c.type}</TableCell>
                  <TableCell><Chip label={c.status} size="small" sx={{ fontWeight: 600, fontSize: "0.7rem" }} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function InfoField({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "#0f172a" }}>{value ?? "—"}</Typography>
    </Box>
  );
}

function avatarColor(name: string) {
  const colors = ["#2563eb", "#7c3aed", "#059669", "#dc2626", "#d97706", "#0891b2"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => employeesApi.get(id!),
    enabled: !!id,
  });

  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}><CircularProgress /></Box>;
  if (error || !data) return <Alert severity="error">Employee not found.</Alert>;

  const e = data?.data?.data ?? data?.data ?? {};
  const fullName = e.firstName ? `${e.firstName} ${e.lastName}` : "";
  const initials = (fullName || "?").split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase();
  const currentWorkPass = e.workPass?.[0];

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBack sx={{ fontSize: 16 }} />} onClick={() => navigate("/employees")} variant="text" size="small" sx={{ color: "#64748b" }}>Back</Button>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar sx={{ width: 44, height: 44, fontSize: "1rem", fontWeight: 700, backgroundColor: avatarColor(fullName), borderRadius: "11px" }}>{initials}</Avatar>
            <Box>
              <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>{fullName}</Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: "#64748b" }}>{e.jobTitle ?? ""} {e.department ? `· ${e.department}` : ""}</Typography>
            </Box>
          </Box>
        </Box>
        <Chip label={e.isActive ? "Active" : "Inactive"} color={e.isActive ? "success" : "default"} />
        <Button variant="outlined" startIcon={<Edit sx={{ fontSize: 15 }} />} size="small" onClick={() => navigate(`/employees/${id}/edit`)} sx={{ borderRadius: "8px" }}>Edit</Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2.5, borderBottom: "1px solid #e2e8f0", "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: "0.875rem" } }}>
        <Tab label="Personal Info" />
        <Tab label="Employment" />
        <Tab label="Work Pass" />
        <Tab label="Skills" />
        <Tab label="Onboarding/Offboarding" />
        <Tab label="Performance" />
        <Tab label="Cases" />
      </Tabs>

      {tab === 0 && (
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Identity</Typography>
                <InfoField label="Full Name" value={fullName} />
                <InfoField label="Employee Code" value={e.employeeCode} />
                <InfoField label="Nationality" value={e.nationality} />
                <InfoField label="Date of Birth" value={formatDate(e.dateOfBirth)} />
                <InfoField label={e.identityDocType ?? "Identity Document"} value={e.identityDocNumber} />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Contact</Typography>
                <InfoField label="Email" value={e.email} />
                <InfoField label="Phone" value={e.phone} />
                <InfoField label="Emergency Contact" value={e.emergencyContact} />
                <InfoField label="Address" value={e.address} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tab === 1 && (
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Job Details</Typography>
                <InfoField label="Job Title" value={e.jobTitle} />
                <InfoField label="Department" value={e.department} />
                <InfoField label="Employment Type" value={e.employmentType} />
                <InfoField label="Join Date" value={formatDate(e.joinDate)} />
                <InfoField label="Reporting To" value={e.manager ? `${e.manager.firstName} ${e.manager.lastName}` : undefined} />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Compensation</Typography>
                <InfoField label="Daily Rate" value={e.dailyRate != null ? `SGD ${Number(e.dailyRate).toLocaleString()}` : undefined} />
                <InfoField label="Allowances" value={e.allowances != null ? `SGD ${Number(e.allowances).toLocaleString()}` : undefined} />
                <InfoField label="Bank Name" value={e.bankName} />
                <InfoField label="Bank Account No." value={e.bankAccountNo} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tab === 2 && (
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 2 }}>Work Pass</Typography>
                {currentWorkPass ? (
                  <>
                    <InfoField label="Pass Type" value={currentWorkPass.passType} />
                    <InfoField label="Pass Number" value={currentWorkPass.passNumber} />
                    <InfoField label="Issue Date" value={formatDate(currentWorkPass.issueDate)} />
                    <InfoField label="Expiry Date" value={formatDate(currentWorkPass.expiryDate)} />
                    <InfoField label="Status" value={currentWorkPass.status} />
                  </>
                ) : (
                  <Typography variant="body2" sx={{ color: "#94a3b8" }}>No work pass on record.</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tab === 3 && id && <SkillsTab employeeId={id} />}
      {tab === 4 && id && <ChecklistsTab employeeId={id} />}
      {tab === 5 && id && <PerformanceTab employeeId={id} />}
      {tab === 6 && id && <CasesTab employeeId={id} />}
    </Box>
  );
}
