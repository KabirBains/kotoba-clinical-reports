import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TEMPLATE_SECTIONS } from "@/lib/constants";
import { type AssessmentInstance, ASSESSMENT_LIBRARY } from "@/lib/assessment-library";
import { getInstanceScoreSummary } from "@/lib/assessment-scoring";
import { type RecommendationInstance } from "@/lib/recommendations-library";
import { type DiagnosisInstance } from "@/lib/diagnosis-library";
import { type GoalInstance } from "@/components/editor/ParticipantGoals";
import { type QueueItem, processQueue, setHashCacheReportId } from "@/ai/generationQueue";
import { getTemplateGuidance, getRubricForSection, FUNCTIONAL_DOMAIN_GUIDANCE, ASSESSMENT_INTERPRETATION_GUIDANCE, RECOMMENDATION_GUIDANCE } from "@/ai/promptGuidance";
import { SYNOPSIS_LIBRARY } from "@/ai/reportEngine";
import { buildMethodologyText } from "@/components/editor/MethodologyAggregator";

import { KotobaLogo } from "@/components/KotobaLogo";
import { NotesMode } from "@/components/editor/NotesMode";
import { ReportMode } from "@/components/editor/ReportMode";
import { LiaiseMode, LIAISE_TEMPLATES, LIAISE_TEMPLATES_V2, getQuestionText, flattenStoredResponse, type CollateralInterview } from "@/components/editor/LiaiseMode";
import { EditorSidebar } from "@/components/editor/EditorSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, PenLine, Clock, Handshake, Link2, Users, Eye } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { format, formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ManageAccessDialog } from "@/components/editor/ManageAccessDialog";
import { logActivity } from "@/lib/reportActivity";

// ─── Narrative threading response types ───────────────────────────────────
// Mirror of the shape returned by the thread-narrative edge function (v2
// iterative loop). The edge function validates + stamps the shape so the
// client treats these as read-only display data.
type ThreadType = "causation" | "amplification" | "recommendation" | "consistency" | "contradiction";
type ThreadConfidence = "high" | "medium" | "low";
type ThreadDirection = "forward" | "backward" | "bidirectional";

interface ThreadMapEntry {
  id: string;
  source_section: string;
  source_observation: string;
  target_sections?: string[];
  target_insertions?: Record<string, string>;
  type?: ThreadType;
  direction?: ThreadDirection;
  confidence?: ThreadConfidence;
  clinical_reasoning?: string;
  pass?: number;
  source_has_attribution?: boolean;
  use_reference_framing?: boolean;
}

interface ThreadIterationStat {
  pass: number;
  identified: number;
  woven: number;
  low_confidence_suggestions: number;
  rejected_backward_contradictions: number;
  converged: boolean;
}

export default function ClientEditor() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Scope the generation hash cache to this client so unchanged sections
  // are skipped even after page refresh (persisted in localStorage).
  if (clientId) setHashCacheReportId(clientId);
  const [mode, setMode] = useState<"notes" | "report" | "liaise">("notes");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [assessments, setAssessments] = useState<AssessmentInstance[]>([]);
  const [diagnoses, setDiagnoses] = useState<DiagnosisInstance[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationInstance[]>([]);
  const [collateralInterviews, setCollateralInterviews] = useState<CollateralInterview[]>([]);
  const [goals, setGoals] = useState<GoalInstance[]>([{ id: crypto.randomUUID(), text: "" }]);
  const [nilGoals, setNilGoals] = useState(false);
  const [reportContent, setReportContent] = useState<Record<string, string>>({});
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generateProgress, setGenerateProgress] = useState({ current: 0, total: 0, label: "" });
  const [qualityCheckStatus, setQualityCheckStatus] = useState<"idle" | "checking" | "complete" | "correcting">("idle");
  const [scorecard, setScorecard] = useState<any>(null);
  const [issueStatuses, setIssueStatuses] = useState<Record<string, "unresolved" | "accepted" | "dismissed" | "acknowledged">>({});
  const [dismissedIssueKeys, setDismissedIssueKeys] = useState<Set<string>>(new Set());
  const [scorecardVisible, setScorecardVisible] = useState(false);
  const [narrativeThreadingEnabled, setNarrativeThreadingEnabled] = useState(true);
  // Narrative threading state — v2 loop returns per-iteration breakdowns,
  // low-confidence suggestions, and contradiction flags alongside the main
  // threadMap. Shape is validated and stamped on the edge function side; the
  // UI treats it as read-only display data.
  const [threadMap, setThreadMap] = useState<ThreadMapEntry[]>([]);
  const [threadsIdentified, setThreadsIdentified] = useState(0);
  const [threadsWoven, setThreadsWoven] = useState(0);
  const [threadPassesCompleted, setThreadPassesCompleted] = useState(0);
  const [threadIterationStats, setThreadIterationStats] = useState<ThreadIterationStat[]>([]);
  const [threadSuggestions, setThreadSuggestions] = useState<ThreadMapEntry[]>([]);
  const [threadContradictions, setThreadContradictions] = useState<ThreadMapEntry[]>([]);
  const [threadWarnings, setThreadWarnings] = useState<string[]>([]);
  const [isThreading, setIsThreading] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setInterval>>();
  const mainRef = useRef<HTMLElement>(null);
  const isMobile = useIsMobile();
  const [sidebarWidth, setSidebarWidth] = useState<number>(256);
  const [manageAccessOpen, setManageAccessOpen] = useState(false);

  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: report } = useQuery({
    queryKey: ["report", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("client_id", clientId!)
        .eq("is_current", true)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("clinician_name, qualifications, ahpra_number, practice_name")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Caller's role on this report (owner | editor | viewer | null)
  const { data: myRole } = useQuery({
    queryKey: ["report-role", report?.id, user?.id],
    enabled: !!report?.id && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("report_role" as any, {
        _report: report!.id,
        _user: user!.id,
      });
      if (error) throw error;
      return (data as "owner" | "editor" | "viewer" | null) ?? null;
    },
  });
  const isViewer = myRole === "viewer";
  const isOwner = myRole === "owner";

  // Last non-self editor of this report, for the "Edited by …" indicator
  const { data: lastEditor } = useQuery({
    queryKey: ["last-editor", report?.id, user?.id],
    enabled: !!report?.id && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("last_editor_for_report" as any, {
        _report: report!.id,
      });
      if (error) throw error;
      const rows = (data as Array<{ user_id: string; email: string | null; clinician_name: string | null; edited_at: string }> | null) ?? [];
      return rows[0] ?? null;
    },
  });

  // Load notes, report, and quality scorecard from DB
  useEffect(() => {
    if (report) {
      const savedNotes = report.notes as Record<string, string> | null;
      if (savedNotes && typeof savedNotes === "object") setNotes(savedNotes);
      const savedReport = report.report_content as Record<string, string> | null;
      if (savedReport && typeof savedReport === "object") setReportContent(savedReport);
      // Load assessments from notes JSON
      const savedAssessments = (savedNotes as any)?.["__assessments__"];
      if (Array.isArray(savedAssessments)) setAssessments(savedAssessments);
      // Load recommendations from notes JSON
      const savedRecs = (savedNotes as any)?.["__recommendations__"];
      if (Array.isArray(savedRecs)) setRecommendations(savedRecs);
      // Load diagnoses from notes JSON
      const savedDiagnoses = (savedNotes as any)?.["__diagnoses__"];
      if (Array.isArray(savedDiagnoses)) setDiagnoses(savedDiagnoses);
      // Load goals from notes JSON
      const savedGoals = (savedNotes as any)?.["__goals__"];
      if (Array.isArray(savedGoals)) setGoals(savedGoals);
      const savedNilGoals = (savedNotes as any)?.["__nilGoals__"];
      if (typeof savedNilGoals === "boolean") setNilGoals(savedNilGoals);
      // Load persisted quality scorecard
      const savedScorecard = (report as any).quality_scorecard;
      if (savedScorecard && typeof savedScorecard === "object" && (savedScorecard.summary || savedScorecard.issues)) {
        setScorecard(savedScorecard);
        setQualityCheckStatus("complete");
      }
      const savedIssueStatuses = (report as any).issue_statuses;
      if (savedIssueStatuses && typeof savedIssueStatuses === "object") {
        setIssueStatuses(savedIssueStatuses);
      }
      const savedDismissedKeys = (report as any).dismissed_issue_keys;
      if (Array.isArray(savedDismissedKeys)) {
        setDismissedIssueKeys(new Set(savedDismissedKeys));
      }
    }
  }, [report]);

  // Load collateral interviews from Supabase
  useEffect(() => {
    if (!report?.id) return;
    const loadInterviews = async () => {
      const { data } = await supabase
        .from("collateral_interviews")
        .select("*")
        .eq("report_id", report.id)
        .order("created_at");
      if (data) {
        setCollateralInterviews(data.map((row: any) => ({
          id: row.id,
          templateId: row.template_id,
          intervieweeName: row.interviewee_name || "",
          intervieweeRole: row.interviewee_role || "",
          date: row.interview_date || "",
          method: row.interview_method || "",
          responses: row.responses || {},
          customQuestions: row.custom_questions || {},
          generalNotes: row.general_notes || "",
        })));
      }
    };
    loadInterviews();
  }, [report?.id]);

  // Also load from localStorage as backup
  useEffect(() => {
    if (clientId) {
      const cached = localStorage.getItem(`kotoba-notes-${clientId}`);
      if (cached && Object.keys(notes).length === 0) {
        try { setNotes(JSON.parse(cached)); } catch {}
      }
    }
  }, [clientId]);

  const saveToCloud = useCallback(async () => {
    if (!report?.id) return;
    const notesWithAssessments = { ...notes, __assessments__: assessments as any, __recommendations__: recommendations as any, __diagnoses__: diagnoses as any, __goals__: goals as any, __nilGoals__: nilGoals as any };
    const updatePayload: Record<string, any> = {
      notes: notesWithAssessments,
      report_content: reportContent || null,
    };
    // Persist quality scorecard alongside report
    if (scorecard) {
      updatePayload.quality_scorecard = scorecard;
      updatePayload.issue_statuses = issueStatuses;
      updatePayload.dismissed_issue_keys = [...dismissedIssueKeys];
    }
    const { error } = await supabase
      .from("reports")
      .update(updatePayload as any)
      .eq("id", report.id);
    if (!error) {
      setLastSaved(new Date());
      if (clientId) localStorage.setItem(`kotoba-notes-${clientId}`, JSON.stringify(notes));
      // Log a single edit-activity row at most every 5 minutes per session,
      // so the activity log records meaningful presence without spam.
      if (user?.id) {
        const stamp = Number(localStorage.getItem(`kotoba-last-edit-log-${report.id}`) || 0);
        if (Date.now() - stamp > 5 * 60 * 1000) {
          localStorage.setItem(`kotoba-last-edit-log-${report.id}`, String(Date.now()));
          void logActivity(report.id, user.id, "edited_section");
        }
      }
    }
  }, [report?.id, notes, assessments, recommendations, diagnoses, goals, nilGoals, reportContent, clientId, scorecard, issueStatuses, dismissedIssueKeys, user?.id]);

  // Autosave every 30 seconds
  useEffect(() => {
    saveTimerRef.current = setInterval(saveToCloud, 30000);
    return () => clearInterval(saveTimerRef.current);
  }, [saveToCloud]);

  // Save on blur
  useEffect(() => {
    const handleBlur = () => saveToCloud();
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [saveToCloud]);

  const updateNote = (sectionId: string, value: string) => {
    setNotes((prev) => ({ ...prev, [sectionId]: value }));
  };

  const SECTION_LABELS: Record<string, string> = {
    "decision-maker": "Section 1a - Participant Decision Maker",
    "reason-referral": "Section 1 - Reason for Referral",
    "background": "Section 2 - Background Information",
    "participant-goals": "Section 3 - Participant Goals",
    "diagnoses": "Section 4 - Diagnoses",
    "ot-case-history": "Section 5 - Allied Health Case History",
    "methodology": "Section 6 - Methodology",
    "informal-supports": "Section 7 - Informal Supports",
    "home-environment": "Section 8 - Home Environment",
    "social-environment": "Section 9 - Social Environment",
    "typical-week": "Section 10 - Typical Week",
    "risk-safety": "Section 11 - Risk and Safety Profile",
    "section12_1": "Section 14.1 - Mobility",
    "section12_2": "Section 14.2 - Transfers",
    "section12_3": "Section 14.3 - Personal ADLs",
    "section12_4": "Section 14.4 - Domestic IADLs",
    "section12_5": "Section 14.5 - Executive IADLs",
    "section12_6": "Section 14.6 - Cognition",
    "section12_7": "Section 14.7 - Communication",
    "section12_8": "Section 14.8 - Social Functioning",
    "assessments": "Section 15 - Standardised Assessments",
    "limitations-barriers": "Section 16 - Limitations and Barriers",
    "functional-impact": "Section 17 - Risks if No Funding",
    "recommendations": "Section 18 - Recommendations",
    "review-monitoring": "Section 19 - Barriers to Accessing/Utilising Supports",
  };

  const runQualityCheck = useCallback(async () => {
    setQualityCheckStatus("checking");
    try {
      const reportText = Object.entries(reportContent)
        .filter(([, text]) => text && text.trim())
        .map(([key, text]) => `=== ${SECTION_LABELS[key] || key} ===\n${text}`)
        .join("\n\n");
      const { data, error } = await supabase.functions.invoke("review-report", {
        body: { reportText, participantName: client?.client_name || "" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Quality check failed");
      const filteredIssues = (data.scorecard.issues || []).filter((issue: any) => {
        const key = issue.criterion + "::" + issue.section + "::" + (issue.flaggedText || "").substring(0, 50);
        return !dismissedIssueKeys.has(key);
      });
      setScorecard({ ...data.scorecard, issues: filteredIssues });
      setIssueStatuses({});
      setScorecardVisible(true);
      setQualityCheckStatus("complete");
    } catch (err: any) {
      console.error("Quality check error:", err);
      toast.error("Quality check failed: " + (err?.message || "Unknown error"));
      setQualityCheckStatus("complete");
    }
  }, [reportContent, client?.client_name, dismissedIssueKeys]);

  const filledSections = Object.entries(notes).filter(
    ([key, v]) => (typeof v === 'string' && v.trim()) && !key.endsWith("__rating") && !key.startsWith("__")
  ).length;
  const totalNonSubSections = TEMPLATE_SECTIONS.filter(
    s => s.id !== "functional-capacity" && s.id !== "assessments"
  ).length;
  const totalSubFields = TEMPLATE_SECTIONS.find(s => s.id === "functional-capacity")
    ?.subsections?.length ?? 0;
  const totalSections = totalNonSubSections + totalSubFields;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Toolbar */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <KotobaLogo size="sm" />
            {client && (
              <span className="text-sm text-muted-foreground border-l border-border pl-3 ml-1">
                {client.client_name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isViewer && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Eye className="h-3 w-3" /> View only
              </Badge>
            )}
            {lastEditor && lastEditor.user_id !== user?.id && (
              <span className="text-xs text-muted-foreground hidden md:inline" title={format(new Date(lastEditor.edited_at), "d MMM yyyy HH:mm")}>
                Edited by {lastEditor.clinician_name || lastEditor.email || "another user"} · {formatDistanceToNow(new Date(lastEditor.edited_at), { addSuffix: true })}
              </span>
            )}
            {lastSaved && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Saved {format(lastSaved, "HH:mm")}
              </span>
            )}
            {isOwner && report?.id && (
              <Button variant="ghost" size="sm" onClick={() => setManageAccessOpen(true)}>
                <Users className="h-3.5 w-3.5 mr-1.5" />
                Manage access
              </Button>
            )}

            <div className="flex border border-border rounded-md overflow-hidden">
              <Button
                variant={mode === "notes" ? "default" : "ghost"}
                size="sm"
                className="rounded-none"
                onClick={() => setMode("notes")}
              >
                <PenLine className="h-3.5 w-3.5 mr-1.5" />
                Notes
              </Button>
              <Button
                variant={mode === "liaise" ? "default" : "ghost"}
                size="sm"
                className="rounded-none relative"
                onClick={() => setMode("liaise")}
              >
                <Handshake className="h-3.5 w-3.5 mr-1.5" />
                Liaise
                {collateralInterviews.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1">
                    {collateralInterviews.length}
                  </span>
                )}
              </Button>
              <Button
                variant={mode === "report" ? "default" : "ghost"}
                size="sm"
                className="rounded-none"
                onClick={() => setMode("report")}
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Report
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5" title="Links observations across domains for a cohesive clinical story">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground hidden sm:inline">Thread</span>
                <Switch
                  checked={narrativeThreadingEnabled}
                  onCheckedChange={setNarrativeThreadingEnabled}
                  className="scale-75"
                />
              </div>

            <Button
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={generatingReport || isViewer}
              title={isViewer ? "View-only access" : undefined}
              onClick={async () => {
                setGeneratingReport(true);

                try {
                  const clientName = client?.client_name || "the participant";
                  const diagnosis = client?.primary_diagnosis || "";

                  // Extract participant names from structured details
                  const participantFullName = notes["__participant__fullName"] || clientName;
                  const participantFirstName = participantFullName.split(/\s+/)[0] || participantFullName;
                  const nameFields = { participant_name: participantFullName, participant_first_name: participantFirstName };
                  const allNameWarnings: string[] = [];

                  // ── Collect top-level section notes ──
                  const topLevelEntries = Object.entries(notes).filter(
                    ([key, val]) =>
                      typeof val === "string" &&
                      val.trim() &&
                      !key.startsWith("__") &&
                      !key.endsWith("__rating") &&
                      !key.endsWith("__notes") &&
                      !key.includes("__")
                  );

                  // ── Collect Section 14 domain observations ──
                  const DOMAIN_SUBSECTIONS = [
                    { id: "mobility", name: "Mobility & Upper Limb Function", reportKey: "section12_1" },
                    { id: "transfers", name: "Transfers", reportKey: "section12_2" },
                    { id: "personal-adls", name: "Personal ADLs — Self-Care", reportKey: "section12_3" },
                    { id: "domestic-iadls", name: "Domestic IADLs", reportKey: "section12_4" },
                    { id: "executive-iadls", name: "Executive IADLs", reportKey: "section12_5" },
                    { id: "cognition", name: "Cognition", reportKey: "section12_6" },
                    { id: "communication", name: "Communication", reportKey: "section12_7" },
                    { id: "social-functioning", name: "Social Functioning", reportKey: "section12_8" },
                  ];

                  const domainEntries: { id: string; name: string; reportKey: string; rowData: { fieldId: string; label: string; rating: string; observation: string }[] }[] = [];
                  for (const domain of DOMAIN_SUBSECTIONS) {
                    const rowData: { fieldId: string; label: string; rating: string; observation: string }[] = [];
                    for (const [key, val] of Object.entries(notes)) {
                      if (key.startsWith(`${domain.id}__`) && key.endsWith("__notes")) {
                        const fieldId = key.replace(`${domain.id}__`, "").replace("__notes", "");
                        const ratingKey = `${domain.id}__${fieldId}__rating`;
                        const rating = notes[ratingKey] || "";
                        const observation = typeof val === "string" ? val.trim() : "";
                        if (rating || observation) {
                          const label = fieldId.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                          rowData.push({ fieldId, label, rating, observation });
                        }
                      }
                    }
                    if (rowData.length > 0) domainEntries.push({ ...domain, rowData });
                  }

                  const scoredAssessments = assessments.filter(a => a.scores && Object.keys(a.scores).length > 0);

                  if (topLevelEntries.length === 0 && domainEntries.length === 0 && scoredAssessments.length === 0 && recommendations.length === 0) {
                    toast.warning("Add notes, assessments, or recommendations before generating.");
                    setGeneratingReport(false);
                    return;
                  }

                  // ── Build collateral payload for edge function ──
                  // Liaise V2 stores multi-select checklist responses as
                  // JSON-encoded arrays (e.g. '["Walking stick","Walker"]').
                  // The edge function's collateral formatter doesn't yet
                  // know how to decode those (that's PR B), so we flatten
                  // them to comma-separated strings here before shipping.
                  // Open questions and single-select checklists pass
                  // through unchanged via flattenStoredResponse.
                  const flattenResponseMap = (r: Record<string, string>): Record<string, string> => {
                    const out: Record<string, string> = {};
                    for (const [k, v] of Object.entries(r || {})) {
                      out[k] = flattenStoredResponse(v);
                    }
                    return out;
                  };
                  const collateralPayload = collateralInterviews.map(i => ({
                    templateId: i.templateId,
                    intervieweeName: i.intervieweeName,
                    intervieweeRole: i.intervieweeRole,
                    method: i.method,
                    date: i.date,
                    responses: flattenResponseMap(i.responses || {}),
                    customQuestions: i.customQuestions || {},
                    generalNotes: i.generalNotes || '',
                  }));

                  // ── Build collateral context summary (legacy user-prompt inlining) ──
                  // NOTE (Liaise Phase 1 fix): This block used to produce opaque
                  // raw-key summaries like "daily_functioning_0: response text"
                  // which were meaningless to the AI without question text.
                  // The edge function (generate-report) already has a
                  // sophisticated formatCollateralForPrompt routine that
                  // correctly uses question text and routes by section. As of
                  // Phase 1, we pass section_name on every call so the edge
                  // function's routing fires, and we no longer inline collateral
                  // in the user prompt at all (see COLLATERAL_SECTIONS handling
                  // below — the inclusion flag is now disabled by default).
                  //
                  // This summary is retained ONLY as a fallback for diagnostic
                  // logs and for any future prompt that might want a compact
                  // overview. It now uses proper question text via LIAISE_TEMPLATES.
                  let collateralContext = "";
                  if (collateralInterviews.length > 0) {
                    const summaries = collateralInterviews.map(iv => {
                      // Look up in V2 first, fall back to V1 legacy templates.
                      // Both template types have .domains[].questions[] but V1
                      // questions are plain strings while V2 questions are
                      // {type, text, ...} objects — getQuestionText() normalises.
                      const template = LIAISE_TEMPLATES_V2[iv.templateId] ?? LIAISE_TEMPLATES[iv.templateId];
                      // Group responses by domain name (not ID) for readability
                      const qaByDomain: Record<string, string[]> = {};
                      for (const [key, val] of Object.entries(iv.responses || {})) {
                        if (!val || !String(val).trim()) continue;
                        const lastUnderscore = key.lastIndexOf("_");
                        if (lastUnderscore === -1) continue;
                        const domainId = key.substring(0, lastUnderscore);
                        const qIdx = parseInt(key.substring(lastUnderscore + 1));
                        const domain = template?.domains.find(d => d.id === domainId);
                        const questionText = getQuestionText(domain?.questions[qIdx]) || `Q${qIdx + 1}`;
                        const domainName = domain?.name ?? domainId;
                        // Flatten JSON-array multi-select values into readable prose.
                        const displayVal = flattenStoredResponse(String(val));
                        (qaByDomain[domainName] = qaByDomain[domainName] || []).push(
                          `  Q: ${questionText}\n  A: ${displayVal}`
                        );
                      }
                      // Include custom questions per domain (previously dropped)
                      for (const [domainId, customs] of Object.entries(iv.customQuestions || {})) {
                        if (!Array.isArray(customs)) continue;
                        for (const cq of customs) {
                          if (!cq?.question || !cq?.response || !String(cq.response).trim()) continue;
                          const domain = template?.domains.find(d => d.id === domainId);
                          const domainName = domain?.name ?? domainId;
                          (qaByDomain[domainName] = qaByDomain[domainName] || []).push(
                            `  Q (custom): ${cq.question}\n  A: ${cq.response}`
                          );
                        }
                      }
                      const qaText = Object.entries(qaByDomain)
                        .map(([domain, qas]) => `[${domain}]\n${qas.join("\n")}`)
                        .join("\n\n");
                      const templateName = template?.name || iv.templateId;
                      return `=== ${templateName}: ${iv.intervieweeName || "Unnamed"} (${iv.intervieweeRole || templateName}) ===\n${qaText}${iv.generalNotes ? `\n\n[General Notes]\n  ${iv.generalNotes}` : ""}`;
                    }).join("\n\n");
                    collateralContext = `\n\nCOLLATERAL INTERVIEW DATA:\nThe following collateral information was gathered from stakeholder interviews. Reference and corroborate relevant observations where they support clinical findings. Attribute every reference by informant name and role (e.g. "Jane Smith, daily support worker, reported that ...").\n\n${summaries}`;
                  }

                  // ── Clinical Spine (pre-generation reasoning backbone) ──
                  // Calls the clinical-spine edge function to derive a structured
                  // map of anchor impairments, recurring consequences, and cross-
                  // domain links BEFORE any section is generated. The spine JSON
                  // is then passed to every generate-report call so Claude can
                  // reference it when writing each section, producing a cohesive
                  // clinical narrative rather than isolated domain paragraphs.
                  let clinicalSpine: Record<string, unknown> | null = null;
                  try {
                    setGenerateProgress({ current: 0, total: 1, label: "Deriving clinical spine..." });
                    const diagnosesText = diagnoses.map(d => `${d.name} (ICD-10: ${d.icd10})`).join("; ") || diagnosis;
                    const clinicianNotesText = topLevelEntries.map(([k, v]) => `${k}: ${v}`).join("\n") +
                      "\n" + domainEntries.map(d => d.rowData.map(r => `${d.name} - ${r.label}: ${r.rating} — ${r.observation}`).join("\n")).join("\n");
                    const assessmentSummaryText = scoredAssessments.map(a => {
                      const summary = getInstanceScoreSummary(a);
                      return `${a.name}: Total ${summary.total || "N/A"}, Classification: ${summary.classification || "N/A"}`;
                    }).join("\n");

                    const { data: spineData, error: spineError } = await supabase.functions.invoke("clinical-spine", {
                      method: "POST",
                      body: {
                        participant_first_name: participantFirstName,
                        participant_pronouns: notes["__participant__pronouns"] || "",
                        diagnoses: diagnosesText,
                        clinician_notes: clinicianNotesText,
                        assessment_summary: assessmentSummaryText,
                        collateral_summary: collateralContext || "",
                      },
                    });

                    if (spineError) {
                      console.warn("Clinical spine generation failed (non-fatal):", spineError);
                    } else if (spineData?.success && spineData?.spine) {
                      clinicalSpine = spineData.spine;
                      console.log(`[SPINE] Generated: ${spineData.spine.anchor_impairments?.length || 0} anchors, ${spineData.spine.cross_domain_links?.length || 0} links`);
                    }
                  } catch (err) {
                    console.warn("Clinical spine error (non-fatal):", err);
                  }

                  // ── Build queue items ──
                  // PHASE 1: Sections 1–5 + Section 6 (methodology/collateral)
                  const phase1Items: QueueItem[] = [];
                  const newContent: Record<string, string> = { ...reportContent };

                  // Base extraBody fields shared across ALL generate-report calls.
                  // Includes participant naming + clinical spine (when available).
                  const baseExtra: Record<string, unknown> = {
                    ...nameFields,
                    ...(clinicalSpine ? { clinical_spine: clinicalSpine } : {}),
                  };

                  // Sections that benefit from collateral context in prompt
                  // ─── SECTION NAME MAP (Liaise Phase 1 fix) ───────────────
                  // Maps the client's string section IDs to the edge function's
                  // expected section_name values. The edge function's
                  // generate-report routes collateral (and other context) based
                  // on section_name — section2 gets safety+full collateral,
                  // section8/9 get carer-specific collateral, section12 gets
                  // safety+risk collateral, etc.
                  //
                  // Before this fix, phase 1 calls passed no section_name, so
                  // the edge function's sophisticated section-aware routing was
                  // entirely bypassed and collateral was dumped generically.
                  //
                  // NOTE: these section numbers use the v5.1 template scheme
                  // (section6 = Collateral Information, section7 = Methodology).
                  // Section 6 is handled separately below.
                  const SECTION_NAME_MAP: Record<string, string> = {
                    "reason-referral": "section1",
                    "background": "section2",
                    "participant-goals": "section3",
                    "diagnoses": "section4",
                    "ot-case-history": "section5",
                    // "methodology" is handled separately below (section6/section7)
                    "informal-supports": "section8",
                    "home-environment": "section9",
                    "social-environment": "section10",
                    "typical-week": "section11",
                    "risk-safety": "section12",
                    // Repurposed / new sections — handled by edge function with
                    // dedicated section_name routing and bespoke prompt rules.
                    "decision-maker": "section-decision-maker",
                    "functional-impact": "section-risks-if-not-funded",
                    "review-monitoring": "section-barriers-to-supports",
                  };

                  // Per-section overrides (max_tokens). Sections owned by the
                  // edge function's bespoke prose rules use simplified prompts
                  // and tighter token budgets.
                  const SECTION_MAX_TOKENS: Record<string, number> = {
                    "decision-maker": 800,
                    "functional-impact": 1500,
                    "review-monitoring": 1000,
                  };
                  const EDGE_OWNED_SECTIONS = new Set(["decision-maker", "functional-impact", "review-monitoring"]);

                  // 1. Top-level text sections (excluding methodology — handled separately as section 6)
                  for (const [sectionId, observations] of topLevelEntries) {
                    if (sectionId === "methodology") continue; // handled in phase as section6

                    const isEdgeOwned = EDGE_OWNED_SECTIONS.has(sectionId);
                    let prompt: string;
                    if (isEdgeOwned) {
                      // Edge function owns ALL prose rules for these sections
                      // (rubric, structure, headlines, length). Pass only the
                      // clinician's raw input — no client-side template guidance,
                      // no rubric, no structural directives. This avoids the
                      // model receiving conflicting instructions.
                      prompt = `Participant: ${clientName}\n\nCLINICIAN INPUT:\n${observations}`;
                    } else {
                      const templateGuidance = getTemplateGuidance(sectionId);
                      const rubric = getRubricForSection("text");
                      // Liaise Phase 1: We NO LONGER inline collateralContext into
                      // the user prompt. The edge function's formatCollateralForPrompt
                      // produces a correctly-formatted, section-appropriate version
                      // in the system prompt, which is better quality and avoids
                      // double-injection. The only thing we pass in the user prompt
                      // is the clinician's own observations.
                      prompt = `Write a section of an NDIS Functional Capacity Assessment for ${clientName}.\n\nSECTION: ${sectionId}\n\n${templateGuidance ? templateGuidance + "\n\n" : ""}CLINICIAN OBSERVATIONS (transform these into formal clinical prose):\n${observations}\n\nDIAGNOSIS CONTEXT: ${diagnosis || "[Not provided]"}\n\n${rubric}\n\nWrite 2-3 paragraphs of formal NDIS report prose. Use observation → impact → support need structure. Person-first language, third-person active voice. No bullet points, no markdown. Output only the section text.`;
                    }

                    const extraBody: Record<string, any> = { ...baseExtra };
                    // Liaise Phase 1: pass section_name so the edge function's
                    // section-aware collateral routing fires correctly.
                    const mappedSectionName = SECTION_NAME_MAP[sectionId];
                    if (mappedSectionName) {
                      extraBody.section_name = mappedSectionName;
                    }
                    if (collateralPayload.length > 0) {
                      extraBody.collateral_interviews = collateralPayload;
                    }
                    const maxTokens = SECTION_MAX_TOKENS[sectionId] ?? 2000;
                    phase1Items.push({ key: sectionId, prompt, maxTokens, inputForHash: observations, label: `Section: ${sectionId}`, extraBody: Object.keys(extraBody).length > 0 ? extraBody : undefined });
                  }

                  // ─── SECTION 6 — Collateral Information (Liaise Phase 2 fix) ───────────
                  // v5.1 template: Section 6 is "Collateral Information" and Section 7
                  // is "Methodology". Previously a single "methodology" queue item
                  // produced a blended blob that was stored under reportData.section6.
                  // That blended blob was labelled "Methodology" in the .docx and
                  // contained both methodology notes AND collateral interview content,
                  // which conflicts with the v5.1 split.
                  //
                  // New behaviour:
                  //   • Section 6.2 is generated PER-INFORMANT. For each collateral
                  //     interview, a dedicated AI call produces a formal attributed
                  //     summary paragraph of THAT informant's contribution. The
                  //     outputs are then concatenated into a single section6_collateral
                  //     blob which ReportMode surfaces as data.section6.
                  //   • Section 7 is a SEPARATE methodology queue item that generates
                  //     a short description of the assessment process (tools used,
                  //     settings, duration, limitations). It is surfaced as
                  //     data.section7 in the downloaded report.
                  //   • The old "methodology" key is no longer generated. ReportMode
                  //     retains a fallback read of s("methodology") so existing saved
                  //     reports are not broken by this change.

                  // Per-informant section 6 items. Each interview produces ONE
                  // summary paragraph. We key them by a stable id so unchanged
                  // interviews can be skipped by the content-hash check.
                  const section6InformantKeys: string[] = [];
                  for (const iv of collateralInterviews) {
                    const key = `section6_informant_${iv.id}`;
                    section6InformantKeys.push(key);

                    // Build the single-informant collateral payload. Only this
                    // interview is passed so the edge function focuses the
                    // summary on THIS informant. Sending the full list would
                    // tempt the model to reference other informants.
                    const singlePayload = [{
                      templateId: iv.templateId,
                      intervieweeName: iv.intervieweeName,
                      intervieweeRole: iv.intervieweeRole,
                      method: iv.method,
                      date: iv.date,
                      // Flatten V2 multi-select JSON arrays into readable
                      // comma-separated strings before sending to the edge
                      // function (see flattenResponseMap above).
                      responses: flattenResponseMap(iv.responses || {}),
                      customQuestions: iv.customQuestions || {},
                      generalNotes: iv.generalNotes || '',
                    }];

                    const informantLabel = iv.intervieweeName || "[Unnamed informant]";
                    const informantRole = iv.intervieweeRole || LIAISE_TEMPLATES_V2[iv.templateId]?.name || LIAISE_TEMPLATES[iv.templateId]?.name || "stakeholder";
                    const rubric = getRubricForSection("text");
                    const prompt = `Write a formal attributed collateral summary paragraph for Section 6.2 (Collateral Interview Summaries) of an NDIS Functional Capacity Assessment for ${clientName}.\n\nINFORMANT: ${informantLabel}\nROLE / RELATIONSHIP: ${informantRole}\nINTERVIEW METHOD: ${iv.method || "[Not specified]"}\nINTERVIEW DATE: ${iv.date || "[Not specified]"}\n\nDIAGNOSIS CONTEXT: ${diagnosis || "[Not provided]"}\n\n${rubric}\n\nTASK:\n- Write 1-2 paragraphs (no more) that summarise THIS informant's contribution only.\n- Open with a formal introduction of the informant by name and role (e.g. "${informantLabel}, ${informantRole}, reported that ...").\n- Every clinical statement must be explicitly attributed to the informant using phrases like "reported", "described", "observed", "stated", "noted".\n- Do NOT write in the participant's voice or the clinician's voice. This is a second-hand account.\n- Do NOT reference other informants — this summary concerns ${informantLabel} only.\n- Cover the main functional themes this informant raised (daily functioning, ADLs, cognition, behaviour, social, risk/safety, carer capacity) but only where the informant actually commented.\n- Person-first language. Third-person active voice. No bullet points, no markdown, no headings.\n- Output only the summary paragraph(s). No preamble, no trailing notes.`;

                    const inputForHash = `${iv.id}|${iv.intervieweeName}|${iv.intervieweeRole}|${iv.method}|${iv.date}|${JSON.stringify(iv.responses || {})}|${JSON.stringify(iv.customQuestions || {})}|${iv.generalNotes || ''}`;

                    phase1Items.push({
                      key,
                      prompt,
                      maxTokens: 1500,
                      inputForHash,
                      label: `Collateral: ${informantLabel}`,
                      extraBody: {
                        ...baseExtra,
                        section_name: "section6_informant",
                        collateral_interviews: singlePayload,
                      },
                    });
                  }

                  // Section 7 — Methodology (assessment approach, tools, method, limitations)
                  const methodologyNotes = notes["methodology"] || "";
                  const methodologyInput = methodologyNotes || buildMethodologyText(assessments, collateralInterviews, diagnoses, notes);
                  if (methodologyInput.trim() || scoredAssessments.length > 0 || collateralPayload.length > 0) {
                    const templateGuidance = getTemplateGuidance("methodology");
                    const rubric = getRubricForSection("text");
                    const prompt = `Write the 'Methodology' section (Section 7) of an NDIS Functional Capacity Assessment for ${clientName}.\n\n${templateGuidance ? templateGuidance + "\n\n" : ""}CLINICIAN INPUT (describes how the assessment was conducted):\n${methodologyInput}\n\nDIAGNOSIS CONTEXT: ${diagnosis || "[Not provided]"}\n\n${rubric}\n\nTASK:\n- Write 2 concise paragraphs (no more) describing the assessment approach for this participant.\n- Paragraph 1: State the assessment purpose, the setting(s), the date(s), the duration, and who was present. Describe the methods used (clinical interview, observation, standardised assessments, collateral interviews).\n- Paragraph 2: Name the standardised tools administered and briefly state why each was selected. Note any limitations (e.g. fatigue, time pressure, reliance on informant report).\n- Do NOT list the content of collateral interviews here — that is handled in Section 6.\n- Do NOT restate diagnoses — that is Section 4.\n- Person-first language. Third-person active voice. No bullet points, no markdown, no headings.\n- Output only the methodology text. No preamble.`;
                    phase1Items.push({
                      key: "section7_methodology",
                      prompt,
                      maxTokens: 1500,
                      inputForHash: methodologyInput + JSON.stringify(scoredAssessments.map(a => a.name)),
                      label: "Section: Methodology",
                      extraBody: {
                        ...baseExtra,
                        section_name: "section7",
                      },
                    });
                  }

                  // ── PHASE 2: Domains, Assessments, Recommendations ──
                  // (built after phase 1 completes so we can include section6 result)

                  // Domain hint mapping
                  const DOMAIN_HINT_MAP: Record<string, string> = {
                    section12_1: "Mobility",
                    section12_2: "Transfers",
                    section12_3: "Personal ADLs",
                    section12_4: "Domestic IADLs",
                    section12_5: "Executive IADLs",
                    section12_6: "Cognition",
                    section12_7: "Communication",
                    section12_8: "Social Functioning",
                  };

                  // Pre-compute assessment data for queue items.
                  // Score summaries come from the unified dispatcher in
                  // src/lib/assessment-scoring.ts, which calls each scoring
                  // component's getXxxScoreSummary() function. This used to be
                  // ~240 lines of duplicated logic inlined here. See the
                  // assessment-scoring refactor for details.
                  const assessmentMeta: { assessment: AssessmentInstance; scoreSummary: ReturnType<typeof getInstanceScoreSummary>; synopsis: string; aName: string }[] = [];
                  for (const assessment of scoredAssessments) {
                    const scoreSummary = getInstanceScoreSummary(assessment);
                    const def = ASSESSMENT_LIBRARY.find(d => d.id === assessment.definitionId);
                    const synopsis = def?.synopsis || "";
                    const aName = typeof assessment.name === "string" ? assessment.name : "Assessment";
                    assessmentMeta.push({ assessment, scoreSummary, synopsis, aName });
                  }

                  // Count total items across both phases
                  const phase2DomainCount = domainEntries.length;
                  const phase2AssessmentCount = assessmentMeta.length;
                  const phase2RecCount = recommendations.length;
                  const totalItems = phase1Items.length + phase2DomainCount + phase2AssessmentCount + phase2RecCount;

                  // ── Process Phase 1 ──
                  setGenerateProgress({ current: 0, total: totalItems, label: "Starting report generation..." });
                  let globalStep = 0;

                  const phase1Results = await processQueue(phase1Items, (step, _total, label, status) => {
                    globalStep = step;
                    if (status === "generating") {
                      const humanLabel = label.startsWith("Section:")
                        ? `Generating ${label.replace("Section: ", "")}...`
                        : `Generating ${label}...`;
                      setGenerateProgress({ current: step, total: totalItems, label: humanLabel });
                    } else if (status === "refining") {
                      const humanLabel = label.startsWith("Section:")
                        ? `Refining ${label.replace("Section: ", "")}...`
                        : `Refining ${label}...`;
                      setGenerateProgress(prev => ({ ...prev, label: humanLabel }));
                    } else {
                      setGenerateProgress(prev => ({ ...prev, current: step }));
                    }
                  });

                  // Map phase 1 results
                  let successCount = 0;
                  let storedSection6Text = "";
                  let storedSection7Text = "";

                  // Track per-informant summaries by their key so we can
                  // concatenate them into section6_collateral in interview
                  // order (matching Section 6.1 Sources Summary).
                  const informantSummariesByKey: Record<string, string> = {};

                  for (const result of phase1Results) {
                    if (result.skipped && result.skipReason === "unchanged") {
                      // For skipped (unchanged) informant items we still need
                      // the previously-generated text. Read it from the
                      // existing reportContent cache.
                      if (result.key?.startsWith("section6_informant_")) {
                        const prev = reportContent[result.key];
                        if (prev) informantSummariesByKey[result.key] = prev;
                      }
                      successCount++;
                      continue;
                    }
                    if (!result.success) continue;

                    const topMatch = topLevelEntries.find(([id]) => id === result.key);
                    if (topMatch) {
                      newContent[result.key] = result.text || "";
                      successCount++;
                      continue;
                    }

                    if (result.key?.startsWith("section6_informant_")) {
                      // Store the per-informant summary so it can be
                      // concatenated after the loop.
                      newContent[result.key] = result.text || "";
                      informantSummariesByKey[result.key] = result.text || "";
                      successCount++;
                      continue;
                    }

                    if (result.key === "section7_methodology") {
                      newContent[result.key] = result.text || "";
                      storedSection7Text = result.text || "";
                      successCount++;
                      continue;
                    }
                  }

                  // ─── Concatenate per-informant summaries into section6_collateral ───
                  // Walk the informant keys in the SAME order they were
                  // queued (matches the order the clinician completed the
                  // interviews, which matches Section 6.1 Sources Summary).
                  // Each summary is prefixed with an attribution heading so
                  // the final .docx can distinguish informants visually.
                  const section6Parts: string[] = [];
                  for (let idx = 0; idx < section6InformantKeys.length; idx++) {
                    const key = section6InformantKeys[idx];
                    const summary = informantSummariesByKey[key] || newContent[key] || "";
                    if (!summary.trim()) continue;
                    const iv = collateralInterviews[idx];
                    const informantLabel = iv?.intervieweeName || "[Unnamed informant]";
                    const informantRole = iv?.intervieweeRole || LIAISE_TEMPLATES[iv?.templateId || ""]?.name || "stakeholder";
                    section6Parts.push(`${informantLabel} (${informantRole})\n\n${summary.trim()}`);
                  }
                  if (section6Parts.length > 0) {
                    newContent["section6_collateral"] = section6Parts.join("\n\n");
                    storedSection6Text = newContent["section6_collateral"];
                  }

                  // Fallback: if section 6 was not regenerated (skipped or no
                  // interviews) but a prior run stored content under the legacy
                  // "methodology" key, surface that so the cross-section
                  // lookback in Phase 2 still has SOMETHING for section 6.
                  if (!storedSection6Text && newContent["methodology"]) {
                    storedSection6Text = newContent["methodology"];
                  }
                  if (!storedSection7Text && reportContent["section7_methodology"]) {
                    storedSection7Text = reportContent["section7_methodology"];
                  }

                  // ── Build Phase 2 queue items ──
                  const phase2Items: QueueItem[] = [];

                  // 2. Section 14 functional domains — with domain_hint and section6_collateral
                  for (const domain of domainEntries) {
                    const rowLines = domain.rowData.map((r, index) =>
                      [
                        `ROW ${index + 1}`,
                        `KEY: ${r.fieldId}`,
                        `LABEL: ${r.label}`,
                        `SUPPORT LEVEL: ${r.rating || "Not specified"}`,
                        `OBSERVATIONS: ${r.observation || "Nil documented"}`,
                      ].join("\n")
                    ).join("\n\n---\n\n");
                    const fieldKeys = domain.rowData.map(r => r.fieldId);
                    const inputText = domain.rowData.map(r => `${r.fieldId}:${r.rating}:${r.observation}`).join("|");

                    const domainRubric = getRubricForSection("domain");
                    const prompt = `You are writing the '${domain.name}' subsection of Section 12 (Functional Capacity) of an NDIS Functional Capacity Assessment for ${clientName}.\n\n${FUNCTIONAL_DOMAIN_GUIDANCE}\n\nDOMAIN: ${domain.name}\n\nIMPORTANT: This domain contains multiple distinct rows/subdomains. Treat EACH row below as a separate item. Do not merge rows, do not repeat content across rows, and do not mention details from one row inside another row's output.\n\nROW-BY-ROW INPUT:\n${rowLines}\n\nDIAGNOSIS CONTEXT: ${diagnosis || "[Not specified]"}\n\n${domainRubric}\n\nTASK:\n- For EACH row, write 1-2 sentences of formal NDIS clinical prose for that row only.\n- Each JSON value must discuss only that row's label, support level, and observations.\n- Never mention another row's task inside a given row's output.\n- Do not combine multiple rows into one paragraph.\n- Do not copy or slightly reword the same paragraph across multiple keys.\n- Person-first language, third-person active voice, no bullet points, no markdown.\n- DO NOT echo the SUPPORT LEVEL value in your prose (e.g. never write "Support level: Fully Dependent"). The support level is rendered separately by the UI.\n\nReturn valid JSON only — no markdown, no code fences.\nUse exactly these keys and no others: ${JSON.stringify(fieldKeys)}\nEach value must be a plain string of clinical prose for that key only.\n\nExample: {"bed": "Mr X requires full physical assistance to complete bed transfers safely due to impaired balance and lower limb weakness."}`;

                    const extraBody: Record<string, any> = {
                      ...baseExtra,
                      section_name: domain.reportKey.replace("section12_", "section13_"),
                      domain_hint: DOMAIN_HINT_MAP[domain.reportKey] || domain.name,
                    };
                    if (collateralPayload.length > 0) {
                      extraBody.collateral_interviews = collateralPayload;
                    }
                    if (storedSection6Text) {
                      extraBody.generated_sections = { section6_collateral: storedSection6Text };
                    }

                    phase2Items.push({ key: domain.reportKey, prompt, maxTokens: 2000, inputForHash: inputText, label: `Domain: ${domain.name}`, extraBody });
                  }

                  // 3. Assessments
                  for (const meta of assessmentMeta) {
                    const { assessment, scoreSummary, synopsis, aName } = meta;
                    const sc = assessment.scores;
                    const scoresText = scoreSummary.rows.length > 0
                      ? scoreSummary.rows.map(r => `- ${r.label}: ${r.value}`).join("\n")
                      : JSON.stringify(sc, null, 2);

                    const assessRubric = getRubricForSection("assessment");
                    const prompt = `Write the interpretation for ${aName} in Section 15 (Standardised Assessments) of an NDIS Functional Capacity Assessment for ${clientName}.\n\n${ASSESSMENT_INTERPRETATION_GUIDANCE}\n\nASSESSMENT TOOL: ${aName}\nDATE ADMINISTERED: ${typeof assessment.dateAdministered === "string" ? assessment.dateAdministered : "Not recorded"}\n\nTOTAL SCORE: ${scoreSummary.total || "Not calculated"}\nCLASSIFICATION: ${scoreSummary.classification || "Not classified"}\n\nDOMAIN/SUBSCALE SCORES:\n${scoresText}\n\nCLINICIAN NOTES:\n${typeof assessment.interpretation === "string" && assessment.interpretation ? assessment.interpretation : "No clinician notes provided"}\n\n${assessRubric}\n\nWrite 2 paragraphs following the interpretation rules above. Do NOT include a synopsis — it is displayed separately. Person-first language, no markdown. Output only the interpretation text.`;

                    const inputHash = `${scoreSummary.total}|${scoreSummary.classification}|${assessment.interpretation || ""}`;
                    phase2Items.push({ key: `assessment_${assessment.id}`, prompt, maxTokens: 1500, inputForHash: inputHash, label: `Assessment: ${aName}`, extraBody: { ...baseExtra } });
                  }

                  // 4. Recommendations — include full generated_sections for later sections
                  const OUTCOME_LABELS: Record<string, string> = {
                    maintain_safety: "Maintain safety and wellbeing",
                    build_capacity: "Build capacity toward independence",
                    social_participation: "Increase social and community participation",
                    reduce_informal: "Reduce reliance on informal supports",
                    achieve_goals: "Support achievement of NDIS goals",
                    prevent_deterioration: "Prevent functional deterioration",
                    prevent_hospitalisation: "Reduce risk of hospitalisation or crisis",
                  };

                  // Concatenate all domain texts for generated_sections
                  const concatenatedDomainTexts = domainEntries.map(d => {
                    const existing = newContent[d.reportKey];
                    return existing ? `${d.name}: ${existing}` : "";
                  }).filter(Boolean).join("\n\n");

                  const concatenatedAssessmentTexts = newContent["assessments"] || "";

                  for (let ri = 0; ri < recommendations.length; ri++) {
                    const r = recommendations[ri];
                    const recRubric = getRubricForSection("recommendation");
                    // Build the consequence directive carefully. If the
                    // clinician filled in r.consequence, it is treated as
                    // raw notes that the AI must transform into participant-
                    // specific prose (NOT verbatim copy). If the field is
                    // blank, the AI is instructed to derive the consequence
                    // from the participant's diagnoses, functional capacity
                    // findings, and risk profile.
                    const consequenceDirective = r.consequence?.trim()
                      ? `Clinician's draft consequence (transform into participant-specific prose, do NOT copy verbatim — name THIS participant's specific risks):\n${r.consequence.trim()}`
                      : `No consequence provided by clinician. You MUST derive a participant-specific consequence statement from:\n  - The named diagnoses above\n  - The functional capacity findings in earlier sections (provided in generated_sections)\n  - The risk and safety profile from Section 12\nDo NOT use generic phrasing like "functional decline" or "social isolation". Name THIS participant's specific risks (e.g., "without daily showering support, [name] faces ongoing skin breakdown given documented poor hygiene tolerance and history of pressure injury").`;

                    const prompt = `${RECOMMENDATION_GUIDANCE}\n\nConvert this structured recommendation into formal NDIS clinical prose. Person-first language, no bullet points, no markdown.\n\nParticipant: ${clientName}\nPrimary Diagnosis: ${client?.primary_diagnosis || ""}\n\nRecommendation ${ri + 1}: ${r.supportName}\nCategory: ${r.ndisCategory}\n${r.isCapital || r.isConsumable ? `Estimated Cost: ${r.estimatedCost || "Not specified"}` : `Current Provision: ${r.currentHours || "Nil"}\nRecommended Provision: ${r.recommendedHours || "Not specified"}\nSupport Ratio: ${r.ratio || "Not specified"}`}\n\nTasks:\n${(r.tasks || []).map(t => `- ${t}`).join("\n")}\n\nJustification: ${r.justification || "Not provided"}\nOutcomes:\n${(r.outcomes || []).map(o => `- ${OUTCOME_LABELS[o] || o}`).join("\n")}\n\nCONSEQUENCE STATEMENT (CRITICAL):\n${consequenceDirective}\n\nThe consequence must be SPECIFIC to this participant. Generic phrasing like "functional decline", "social isolation", or "deterioration in daily functioning" is NOT acceptable. Name actual risks tied to this participant's diagnoses, observed limitations, and documented incidents.\n\nS34 Justification: ${r.s34Justification || "Not provided"}\n\n${recRubric}\n\nWrite 1 cohesive paragraph following the recommendation reasoning chain above. Use 'is expected to' not 'will'. Do NOT end with a sentence about Section 34 or 'reasonable and necessary' — that is covered in its own dedicated section of the report. Output only the recommendation text.`;

                    const inputHash = `${r.supportName}|${r.justification || ""}|${r.consequence || ""}|${(r.tasks || []).join(",")}`;

                    const extraBody: Record<string, any> = {
                      ...baseExtra,
                      section_name: "section17",
                    };
                    if (collateralPayload.length > 0) {
                      extraBody.collateral_interviews = collateralPayload;
                    }
                    if (storedSection6Text || concatenatedDomainTexts || concatenatedAssessmentTexts) {
                      extraBody.generated_sections = {
                        ...(storedSection6Text ? { section6_collateral: storedSection6Text } : {}),
                        ...(concatenatedDomainTexts ? { section13_domains: concatenatedDomainTexts } : {}),
                        ...(concatenatedAssessmentTexts ? { section14_assessments: concatenatedAssessmentTexts } : {}),
                      };
                    }

                    phase2Items.push({ key: `rec_${r.id}`, prompt, maxTokens: 1500, inputForHash: inputHash, label: `Recommendation: ${r.supportName}`, extraBody });
                  }

                  // ── Process Phase 2 ──
                  const phase2Results = await processQueue(phase2Items, (step, _total, label, status) => {
                    const currentStep = globalStep + step;
                    if (status === "generating") {
                      const humanLabel = label.startsWith("Domain:")
                        ? `Generating ${label.replace("Domain: ", "")}...`
                        : label.startsWith("Assessment:")
                        ? `Generating ${label.replace("Assessment: ", "")} interpretation...`
                        : label.startsWith("Recommendation:")
                        ? `Generating ${label.replace("Recommendation: ", "")} recommendation...`
                        : `Generating ${label}...`;
                      setGenerateProgress({ current: currentStep, total: totalItems, label: humanLabel });
                    } else if (status === "refining") {
                      const humanLabel = label.startsWith("Domain:")
                        ? `Refining ${label.replace("Domain: ", "")}...`
                        : label.startsWith("Assessment:")
                        ? `Refining ${label.replace("Assessment: ", "")}...`
                        : label.startsWith("Recommendation:")
                        ? `Refining ${label.replace("Recommendation: ", "")}...`
                        : `Refining ${label}...`;
                      setGenerateProgress(prev => ({ ...prev, label: humanLabel }));
                    } else {
                      setGenerateProgress(prev => ({ ...prev, current: currentStep }));
                    }
                  });

                  // ── Map Phase 2 results ──
                  for (const result of phase2Results) {
                    if (result.skipped && result.skipReason === "unchanged") { successCount++; continue; }
                    if (!result.success) continue;

                    // Domain sections — parse JSON response
                    const domainMatch = domainEntries.find(d => d.reportKey === result.key);
                    if (domainMatch && result.text) {
                      let parsed: Record<string, string> = {};
                      try {
                        const rawText = result.text.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
                        parsed = JSON.parse(rawText);
                      } catch {
                        parsed = {};
                      }

                      const structured: Record<string, { text: string; rating: string; label: string }> = {};
                      for (const row of domainMatch.rowData) {
                        structured[row.fieldId] = {
                          text: typeof parsed[row.fieldId] === "string" ? parsed[row.fieldId] : "",
                          rating: row.rating,
                          label: row.label,
                        };
                      }
                      newContent[result.key] = JSON.stringify(structured);
                      successCount++;
                      continue;
                    }

                    // Assessments
                    if (result.key.startsWith("assessment_")) {
                      const assessId = result.key.replace("assessment_", "");
                      const meta = assessmentMeta.find(m => m.assessment.id === assessId);
                      if (meta) {
                        const existing = newContent["assessments"] ? JSON.parse(newContent["assessments"]) : {};
                        existing[assessId] = {
                          name: meta.aName,
                          dateAdministered: meta.assessment.dateAdministered || "",
                          synopsis: meta.synopsis,
                          scoreRows: meta.scoreSummary.rows,
                          total: meta.scoreSummary.total,
                          classification: meta.scoreSummary.classification,
                          interpretation: result.text || "",
                        };
                        newContent["assessments"] = JSON.stringify(existing);
                        successCount++;
                      }
                      continue;
                    }

                    // Recommendations
                    if (result.key.startsWith("rec_")) {
                      const recId = result.key.replace("rec_", "");
                      const ri = recommendations.findIndex(r => r.id === recId);
                      const r = recommendations[ri];
                      if (r) {
                        const existing = newContent["recommendations"] ? JSON.parse(newContent["recommendations"]) : {};
                        existing[r.id] = {
                          text: result.text || "",
                          supportName: r.supportName,
                          category: r.ndisCategory,
                          currentHours: r.currentHours || "",
                          recommendedHours: r.recommendedHours || "",
                          ratio: r.ratio || "",
                          estimatedCost: r.estimatedCost || "",
                          isCapital: !!(r.isCapital || r.isConsumable),
                        };
                        newContent["recommendations"] = JSON.stringify(existing);
                        successCount++;
                      }
                      continue;
                    }
                  }

                  const allResults = [...phase1Results, ...phase2Results];
                  const totalQueueItems = phase1Items.length + phase2Items.length;

                  // Collect name warnings from all results
                  for (const result of allResults) {
                    if (result.name_warnings && result.name_warnings.length > 0) {
                      allNameWarnings.push(...result.name_warnings);
                    }
                  }

                  // ── NARRATIVE THREADING STEP ──
                  if (narrativeThreadingEnabled) {
                    setIsThreading(true);
                    setGenerateProgress(prev => ({ ...prev, label: "Weaving narrative connections..." }));

                    try {
                      const diagnosesText = diagnoses.map(d => d.name).join(", ") || diagnosis;
                      // max_passes: 1 — thread-narrative's internal Claude calls take ~45-60s
                      // each. With max_passes: 2 or 3, total execution exceeds Supabase's
                      // 150s edge function timeout (observed ~150.2s failures in v1/v2/v4/v5/v6).
                      // Single pass completes reliably in ~60s. Multi-pass returns once
                      // threading is refactored to span multiple client invocations.
                      const { data: threadData, error: threadError } = await supabase.functions.invoke("thread-narrative", {
                        method: "POST",
                        body: {
                          generated_sections: newContent,
                          participant_name: participantFullName,
                          participant_first_name: participantFirstName,
                          diagnoses_context: diagnosesText,
                          max_passes: 1,
                        },
                      });

                      if (threadError) {
                        console.warn("Threading failed:", threadError);
                      } else if (threadData?.success && threadData?.threaded_sections) {
                        // Replace newContent with threaded versions
                        for (const [key, text] of Object.entries(threadData.threaded_sections)) {
                          if (typeof text === "string" && text.trim()) {
                            newContent[key] = text;
                          }
                        }
                        setThreadMap(threadData.thread_map || []);
                        setThreadsIdentified(threadData.threads_identified || 0);
                        setThreadsWoven(threadData.threads_woven || 0);
                        // v2: iterative loop state
                        setThreadPassesCompleted(threadData.passes_completed || 0);
                        setThreadIterationStats(threadData.iteration_stats || []);
                        setThreadSuggestions(threadData.low_confidence_suggestions || []);
                        setThreadContradictions(threadData.contradiction_flags || []);

                        if (threadData.warnings?.length > 0) {
                          setThreadWarnings(threadData.warnings);
                        }

                        if (threadData.threads_woven > 0) {
                          const passes = threadData.passes_completed || 1;
                          toast.success(
                            `${threadData.threads_woven} narrative threads woven across ${passes} pass${passes === 1 ? "" : "es"}`,
                          );
                        }
                        if ((threadData.contradiction_flags?.length || 0) > 0) {
                          toast.warning(
                            `${threadData.contradiction_flags.length} potential contradiction${threadData.contradiction_flags.length === 1 ? "" : "s"} flagged for review`,
                            { duration: 10000 },
                          );
                        }
                      } else {
                        console.warn("Threading returned no data:", threadData);
                      }
                    } catch (err) {
                      console.warn("Threading error (non-fatal):", err);
                    } finally {
                      setIsThreading(false);
                    }
                  }

                  setReportContent(newContent);
                  setMode("report");

                  const skippedCount = allResults.filter(r => r.skipped).length;
                  const failedCount = allResults.filter(r => !r.success && !r.skipped).length;

                  // ── Surface infrastructure failures clearly ──
                  // If EVERY non-skipped item failed, the queue is hitting a
                  // systemic backend problem (most commonly: required .docx
                  // templates missing from the report-documents storage
                  // bucket, which causes generate-report to return 500
                  // "Doc load failed" on every call). Show the actual error
                  // text so the clinician can act, instead of a silent
                  // "0 sections generated".
                  const nonSkippedTotal = totalQueueItems - skippedCount;
                  if (nonSkippedTotal > 0 && successCount === 0 && failedCount === nonSkippedTotal) {
                    const sampleErr = allResults.find(r => !r.success && !r.skipped)?.error || "Unknown error";
                    const isDocLoad = /doc load|load failed|\.docx/i.test(sampleErr);
                    const detail = isDocLoad
                      ? "The 'report-documents' storage bucket is missing the required template files (OT_FCA_Template_v5.1.docx, OT_AI_Prompt_Templates_v5.3.docx, OT_Report_Quality_Rubric_v5.3.docx). Upload them in your backend Storage to enable generation."
                      : sampleErr;
                    toast.error(`Generation failed for all ${nonSkippedTotal} sections. ${detail}`, { duration: 20000 });
                    console.error("[GENERATE] All sections failed. Sample error:", sampleErr);
                  } else {
                    let msg = `Generated ${successCount}/${totalQueueItems} sections.`;
                    if (skippedCount > 0) msg += ` ${skippedCount} skipped (unchanged).`;
                    if (failedCount > 0) msg += ` ${failedCount} failed.`;
                    setGenerateProgress(prev => ({ ...prev, current: prev.total, label: "Report generation complete!" }));
                    toast.success(msg);
                    if (failedCount > 0) {
                      const firstErr = allResults.find(r => !r.success && !r.skipped)?.error;
                      if (firstErr) console.error("[GENERATE] First failure reason:", firstErr);
                    }
                  }

                  // Show name warnings if any
                  const uniqueWarnings = [...new Set(allNameWarnings)];
                  if (uniqueWarnings.length > 0) {
                    toast.warning("Name warnings: " + uniqueWarnings.join(" • "), { duration: 10000 });
                  }
                } catch (err: any) {
                  console.error("Generation error:", err);
                  toast.error("Failed to generate: " + (err?.message || "Unknown error"));
                } finally {
                  setGeneratingReport(false);
                  setTimeout(() => setGenerateProgress({ current: 0, total: 0, label: "" }), 3000);
                  if (report?.id && user?.id) {
                    void logActivity(report.id, user.id, "generated_full_report");
                  }
                }
              }}
            >
              {generatingReport ? "Generating…" : "Generate full report"}
            </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Generation progress bar */}
      {generateProgress.total > 0 && (
        <div className="bg-card border-b border-border/30">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-foreground">{generateProgress.label}</span>
              <span className="text-sm font-semibold text-muted-foreground">
                {generateProgress.current}/{generateProgress.total}
              </span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden bg-muted">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(generateProgress.current / generateProgress.total) * 100}%`,
                  backgroundColor: generateProgress.current === generateProgress.total ? "hsl(var(--chart-2))" : "hsl(var(--primary))",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Thread map summary — v2 iterative, grouped by pass, with suggestions + contradictions */}
      {(threadsWoven > 0 || threadSuggestions.length > 0 || threadContradictions.length > 0) && !generatingReport && mode === "report" && (
        <div className="bg-card border-b border-border/30">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
                <Link2 className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium">
                  {threadsWoven} threads woven{threadPassesCompleted > 0 ? ` across ${threadPassesCompleted} pass${threadPassesCompleted === 1 ? "" : "es"}` : ""}
                  {threadSuggestions.length > 0 ? ` · ${threadSuggestions.length} suggestion${threadSuggestions.length === 1 ? "" : "s"}` : ""}
                  {threadContradictions.length > 0 ? ` · ${threadContradictions.length} contradiction${threadContradictions.length === 1 ? "" : "s"}` : ""}
                </span>
                <span className="text-xs ml-auto">Click to expand</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-4">
                {/* Iteration breakdown */}
                {threadIterationStats.length > 0 && (
                  <div className="text-[11px] text-muted-foreground flex gap-3 flex-wrap pl-5">
                    {threadIterationStats.map((stat) => (
                      <span key={stat.pass} className="px-2 py-0.5 rounded bg-muted/50">
                        Pass {stat.pass}: {stat.woven} woven, {stat.identified} identified
                        {stat.converged ? " · converged" : ""}
                      </span>
                    ))}
                  </div>
                )}

                {/* Woven threads grouped by pass */}
                {threadsWoven > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-foreground pl-5">Woven connections</div>
                    {[1, 2, 3].map((passNum) => {
                      const threadsInPass = threadMap.filter((t) => (t.pass || 1) === passNum);
                      if (threadsInPass.length === 0) return null;
                      return (
                        <div key={passNum} className="pl-5">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-1">
                            Pass {passNum}
                          </div>
                          {threadsInPass.map((thread) => (
                            <div key={thread.id} className="text-xs text-muted-foreground border-l-2 border-primary/20 pl-2 py-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-foreground">📍 {thread.source_section}</span>
                                <span>→</span>
                                <span>{(thread.target_sections || []).join(", ")}</span>
                                {thread.type && (
                                  <span className="text-[9px] uppercase tracking-wide px-1.5 py-0 rounded bg-muted/60">
                                    {thread.type}
                                  </span>
                                )}
                                {thread.confidence && (
                                  <span className={`text-[9px] uppercase tracking-wide px-1.5 py-0 rounded ${
                                    thread.confidence === "high"
                                      ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                                      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300"
                                  }`}>
                                    {thread.confidence}
                                  </span>
                                )}
                              </div>
                              <div className="text-muted-foreground/70 mt-0.5 italic">"{thread.source_observation}"</div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Low-confidence suggestions */}
                {threadSuggestions.length > 0 && (
                  <div className="space-y-1.5 pl-5">
                    <div className="text-[11px] font-semibold text-foreground">Suggestions (not auto-woven — review manually)</div>
                    {threadSuggestions.map((thread) => (
                      <div key={thread.id} className="text-xs text-muted-foreground border-l-2 border-dashed border-yellow-500/40 pl-2 py-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-foreground">💡 {thread.source_section}</span>
                          <span>→</span>
                          <span>{(thread.target_sections || []).join(", ")}</span>
                          {thread.type && (
                            <span className="text-[9px] uppercase tracking-wide px-1.5 py-0 rounded bg-muted/60">
                              {thread.type}
                            </span>
                          )}
                        </div>
                        <div className="text-muted-foreground/70 mt-0.5 italic">"{thread.source_observation}"</div>
                        {thread.clinical_reasoning && (
                          <div className="text-muted-foreground/60 text-[10px] mt-0.5">{thread.clinical_reasoning}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Contradiction flags */}
                {threadContradictions.length > 0 && (
                  <div className="space-y-1.5 pl-5">
                    <div className="text-[11px] font-semibold text-destructive">Potential contradictions (review manually — NOT auto-resolved)</div>
                    {threadContradictions.map((thread) => (
                      <div key={thread.id} className="text-xs text-muted-foreground border-l-2 border-destructive/40 pl-2 py-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-foreground">⚠ {thread.source_section}</span>
                          <span>↔</span>
                          <span>{(thread.target_sections || []).join(", ")}</span>
                        </div>
                        <div className="text-muted-foreground/70 mt-0.5 italic">"{thread.source_observation}"</div>
                        {thread.clinical_reasoning && (
                          <div className="text-destructive/80 text-[10px] mt-0.5">{thread.clinical_reasoning}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      )}

      {/* Thread warnings */}
      {threadWarnings.length > 0 && !generatingReport && mode === "report" && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
          <div className="max-w-7xl mx-auto px-4 py-2">
            {threadWarnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-700 dark:text-amber-300">{w}</p>
            ))}
            <button className="text-xs text-amber-500 hover:text-amber-700 mt-1" onClick={() => setThreadWarnings([])}>Dismiss</button>
          </div>
        </div>
      )}
      {mode === "notes" && (
        <div className="bg-card border-b border-border/30">
          <div className="max-w-4xl mx-auto px-4 py-2 flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{ width: `${(filledSections / totalSections) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {filledSections}/{totalSections} sections have notes
            </span>
          </div>
        </div>
      )}

      {/* Editor with sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {mode === "notes" && (
          <EditorSidebar
            notes={notes}
            assessments={assessments}
            recommendations={recommendations}
            scrollContainerRef={mainRef}
            onWidthChange={setSidebarWidth}
          />
        )}
        <main
          ref={mainRef}
          className="flex-1 overflow-auto transition-[margin] duration-200"
          style={{ marginLeft: mode === "notes" && !isMobile ? sidebarWidth : 0 }}
        >
          {mode === "notes" ? (
            <NotesMode
              notes={notes}
              onUpdateNote={updateNote}
              assessments={assessments}
              onUpdateAssessments={setAssessments}
              recommendations={recommendations}
              onUpdateRecommendations={setRecommendations}
              diagnoses={diagnoses}
              onUpdateDiagnoses={setDiagnoses}
              collateralInterviews={collateralInterviews}
              goals={goals}
              onUpdateGoals={setGoals}
              nilGoals={nilGoals}
              onToggleNilGoals={setNilGoals}
              clientName={client?.client_name}
              ndisNumber={client?.ndis_number || ""}
              clinicianProfile={profile || null}
            />
          ) : mode === "liaise" ? (
            <LiaiseMode
              reportId={report?.id || ""}
              interviews={collateralInterviews}
              onUpdateInterviews={setCollateralInterviews}
            />
          ) : (
            <ReportMode
              reportContent={reportContent}
              notes={notes}
              clientName={client?.client_name || ""}
              clientDiagnosis={client?.primary_diagnosis || ""}
              ndisNumber={client?.ndis_number || ""}
              assessments={assessments}
              recommendations={recommendations}
              diagnoses={diagnoses}
              collateralInterviews={collateralInterviews}
              goals={goals}
              nilGoals={nilGoals}
              onUpdateGoals={setGoals}
              onUpdateRecommendation={(idx, updated) => {
                setRecommendations(prev => prev.map((r, i) => i === idx ? updated : r));
              }}
              onUpdateReportContent={(key, value) => {
                setReportContent(prev => ({ ...prev, [key]: value }));
              }}
              onUpdateNote={updateNote}
              clinicianProfile={profile || null}
              qualityCheckStatus={qualityCheckStatus}
              scorecard={scorecard}
              issueStatuses={issueStatuses}
              scorecardVisible={scorecardVisible}
              hasUnresolvedIssues={!!(scorecard && scorecard.issues.length > 0 && scorecard.issues.some((i: any) => !issueStatuses[i.id] || issueStatuses[i.id] === "unresolved"))}
              onQualityCheck={runQualityCheck}
              onAcceptIssue={(id) => setIssueStatuses(prev => ({ ...prev, [id]: "accepted" }))}
              onDismissIssue={(id) => {
                setIssueStatuses(prev => ({ ...prev, [id]: "dismissed" }));
                if (scorecard?.issues) {
                  const issue = scorecard.issues.find((i: any) => i.id === id);
                  if (issue) {
                    const key = issue.criterion + "::" + issue.section + "::" + (issue.flaggedText || "").substring(0, 50);
                    setDismissedIssueKeys(prev => new Set([...prev, key]));
                  }
                }
              }}
              onAcknowledgeIssue={(id) => setIssueStatuses(prev => ({ ...prev, [id]: "acknowledged" }))}
              onAcceptAllIssues={() => {
                if (scorecard?.issues) {
                  const updates: Record<string, "accepted"> = {};
                  scorecard.issues.forEach((i: any) => {
                    if (i.tier === "auto_correct" && (!issueStatuses[i.id] || issueStatuses[i.id] === "unresolved")) {
                      updates[i.id] = "accepted";
                    }
                  });
                  setIssueStatuses(prev => ({ ...prev, ...updates }));
                }
              }}
              onApplyCorrections={async () => {
                setQualityCheckStatus("correcting");
                try {
                  // Find the reportContent key that best matches an issue's section reference
                  const findSectionText = (sectionRef: string): { key: string; text: string } => {
                    // Direct match first
                    if (reportContent[sectionRef]) return { key: sectionRef, text: reportContent[sectionRef] };
                    const ref = sectionRef.toLowerCase();
                    // Search all reportContent keys for a match
                    for (const [key, text] of Object.entries(reportContent)) {
                      if (!text) continue;
                      // Match by key pattern (e.g. "section13_3" matches "14.3" or "Personal ADLs")
                      const keyLower = key.toLowerCase();
                      if (ref.includes(keyLower) || keyLower.includes(ref)) return { key, text };
                    }
                    // Fuzzy match: search by domain name or section number in the ref
                    const domainMap: Record<string, string> = {
                      "mobility": "section13_1", "transfers": "section13_2",
                      "personal adls": "section13_3", "self-care": "section13_3", "self care": "section13_3",
                      "domestic iadls": "section13_4", "domestic": "section13_4",
                      "executive iadls": "section13_5", "executive": "section13_5",
                      "cognition": "section13_6", "communication": "section13_7",
                      "social functioning": "section13_8", "social": "section13_8",
                      "sensory": "section13_9", "sensory profile": "section13_9",
                    };
                    for (const [name, mappedKey] of Object.entries(domainMap)) {
                      if (ref.includes(name) && reportContent[mappedKey]) return { key: mappedKey, text: reportContent[mappedKey] };
                    }
                    // Match section numbers like "14.3" → "section13_3", "Section 12" → "section12"
                    const numMatch = ref.match(/(\d+)\.?(\d*)/);
                    if (numMatch) {
                      const candidates = Object.keys(reportContent).filter(k => {
                        const km = k.match(/section(\d+)_?(\d*)/);
                        if (!km) return false;
                        if (numMatch[2]) return km[1] === String(Number(numMatch[1]) - 1) && km[2] === numMatch[2];
                        return km[1] === numMatch[1] || km[1] === String(Number(numMatch[1]) - 1);
                      });
                      if (candidates.length > 0 && reportContent[candidates[0]]) return { key: candidates[0], text: reportContent[candidates[0]] };
                    }
                    // Fallback: search all content for the flagged text
                    return { key: sectionRef, text: "" };
                  };

                  const acceptedFixes = scorecard.issues
                    .filter((issue: any) => issue.tier === "auto_correct" && issueStatuses[issue.id] === "accepted")
                    .map((issue: any) => {
                      const { key, text } = findSectionText(issue.section);
                      // If we still have no text, search all sections for the flagged text
                      let sectionText = text;
                      let sectionKey = key;
                      if (!sectionText && issue.flaggedText) {
                        for (const [k, v] of Object.entries(reportContent)) {
                          if (v && typeof v === "string" && v.includes(issue.flaggedText)) {
                            sectionText = v;
                            sectionKey = k;
                            break;
                          }
                        }
                      }
                      return {
                        section: sectionKey, sectionText,
                        criterion: issue.criterion, flaggedText: issue.flaggedText,
                        suggestedFix: issue.suggestedFix, description: issue.description,
                      };
                    });
                  const { data, error } = await supabase.functions.invoke("correct-report", {
                    body: { corrections: acceptedFixes },
                  });
                  if (error) throw error;
                  if (!data?.success) throw new Error(data?.error || "Correction failed");
                  for (const [sectionKey, correctedText] of Object.entries(data.correctedSections)) {
                    setReportContent(prev => ({ ...prev, [sectionKey]: correctedText as string }));
                  }
                  toast.success(`Corrections applied to ${Object.keys(data.correctedSections).length} sections`);
                  setQualityCheckStatus("complete");
                } catch (err: any) {
                  console.error("Correction error:", err);
                  toast.error("Failed to apply corrections: " + (err?.message || "Unknown error"));
                  setQualityCheckStatus("complete");
                }
              }}
              onToggleScorecard={() => setScorecardVisible(prev => !prev)}
              onRecheck={runQualityCheck}
              onClearAndRecheck={() => {
                setScorecard(null);
                setIssueStatuses({});
                setScorecardVisible(false);
                setQualityCheckStatus("idle");
                setTimeout(() => runQualityCheck(), 100);
              }}
              onFindInReport={() => {}}
            />
          )}
        </main>
      </div>
      {isOwner && report?.id && (
        <ManageAccessDialog
          reportId={report.id}
          open={manageAccessOpen}
          onOpenChange={setManageAccessOpen}
        />
      )}
    </div>
  );
}
