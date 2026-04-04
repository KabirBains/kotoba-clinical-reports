import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TEMPLATE_SECTIONS } from "@/lib/constants";
import { type AssessmentInstance, ASSESSMENT_LIBRARY, calculateTotal, getClassification, calculateSubscaleTotal } from "@/lib/assessment-library";
import { type RecommendationInstance } from "@/lib/recommendations-library";
import { type DiagnosisInstance } from "@/lib/diagnosis-library";
import { type QueueItem, processQueue } from "@/ai/generationQueue";
import { getTemplateGuidance, getRubricForSection, FUNCTIONAL_DOMAIN_GUIDANCE, ASSESSMENT_INTERPRETATION_GUIDANCE, RECOMMENDATION_GUIDANCE } from "@/ai/promptGuidance";
import { SYNOPSIS_LIBRARY } from "@/ai/reportEngine";

import { KotobaLogo } from "@/components/KotobaLogo";
import { NotesMode } from "@/components/editor/NotesMode";
import { ReportMode } from "@/components/editor/ReportMode";
import { LiaiseMode, type CollateralInterview } from "@/components/editor/LiaiseMode";
import { EditorSidebar } from "@/components/editor/EditorSidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, PenLine, Clock, Handshake } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ClientEditor() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"notes" | "report" | "liaise">("notes");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [assessments, setAssessments] = useState<AssessmentInstance[]>([]);
  const [diagnoses, setDiagnoses] = useState<DiagnosisInstance[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationInstance[]>([]);
  const [collateralInterviews, setCollateralInterviews] = useState<CollateralInterview[]>([]);
  const [reportContent, setReportContent] = useState<Record<string, string>>({});
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generateProgress, setGenerateProgress] = useState({ current: 0, total: 0, label: "" });
  const [qualityCheckStatus, setQualityCheckStatus] = useState<"idle" | "checking" | "complete" | "correcting">("idle");
  const [scorecard, setScorecard] = useState<any>(null);
  const [issueStatuses, setIssueStatuses] = useState<Record<string, "unresolved" | "accepted" | "dismissed" | "acknowledged">>({});
  const [dismissedIssueKeys, setDismissedIssueKeys] = useState<Set<string>>(new Set());
  const [scorecardVisible, setScorecardVisible] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setInterval>>();
  const mainRef = useRef<HTMLElement>(null);

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
      // Load persisted quality scorecard
      const savedScorecard = (report as any).quality_scorecard;
      if (savedScorecard && typeof savedScorecard === "object" && savedScorecard.score !== undefined) {
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
    const notesWithAssessments = { ...notes, __assessments__: assessments as any, __recommendations__: recommendations as any, __diagnoses__: diagnoses as any };
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
    }
  }, [report?.id, notes, assessments, recommendations, diagnoses, reportContent, clientId, scorecard, issueStatuses, dismissedIssueKeys]);

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
    "section12_9": "Section 14.9 - Sensory Profile",
    "assessments": "Section 15 - Standardised Assessments",
    "limitations-barriers": "Section 16 - Limitations and Barriers",
    "functional-impact": "Section 17 - Functional Impact Summary",
    "recommendations": "Section 18 - Recommendations",
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
            {lastSaved && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Saved {format(lastSaved, "HH:mm")}
              </span>
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

            <Button
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={generatingReport}
              onClick={async () => {
                setGeneratingReport(true);

                try {
                  const clientName = client?.client_name || "the participant";
                  const diagnosis = client?.primary_diagnosis || "";

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
                    { id: "sensory-profile", name: "Sensory Profile", reportKey: "section12_9" },
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

                  // ── Build queue items ──
                  const queueItems: QueueItem[] = [];
                  const newContent: Record<string, string> = { ...reportContent };

                  // 1. Top-level text sections
                  for (const [sectionId, observations] of topLevelEntries) {
                    const templateGuidance = getTemplateGuidance(sectionId);
                    const rubric = getRubricForSection("text");
                    const prompt = `Write a section of an NDIS Functional Capacity Assessment for ${clientName}.\n\nSECTION: ${sectionId}\n\n${templateGuidance ? templateGuidance + "\n\n" : ""}CLINICIAN OBSERVATIONS (transform these into formal clinical prose):\n${observations}\n\nDIAGNOSIS CONTEXT: ${diagnosis || "[Not provided]"}\n\n${rubric}\n\nWrite 2-3 paragraphs of formal NDIS report prose. Use observation → impact → support need structure. Person-first language, third-person active voice. No bullet points, no markdown. Output only the section text.`;
                    queueItems.push({ key: sectionId, prompt, maxTokens: 2000, inputForHash: observations, label: `Section: ${sectionId}` });
                  }

                  // 2. Section 14 functional domains
                  for (const domain of domainEntries) {
                    const rowLines = domain.rowData.map(r =>
                      `- ${r.label} | Support level: ${r.rating || "Not specified"} | Observations: ${r.observation || "Nil documented"}`
                    ).join("\n");
                    const fieldKeys = domain.rowData.map(r => r.fieldId);
                    const inputText = domain.rowData.map(r => `${r.fieldId}:${r.rating}:${r.observation}`).join("|");

                    const domainRubric = getRubricForSection("domain");
                    const prompt = `You are writing the '${domain.name}' subsection of Section 12 (Functional Capacity) of an NDIS Functional Capacity Assessment for ${clientName}.\n\n${FUNCTIONAL_DOMAIN_GUIDANCE}\n\nDOMAIN: ${domain.name}\n\nSTRUCTURED OBSERVATIONS:\n${rowLines}\n\nDIAGNOSIS CONTEXT: ${diagnosis || "[Not specified]"}\n\n${domainRubric}\n\nFor EACH row, write 1-2 sentences of formal NDIS clinical prose describing observed function, impact, and support need. Person-first language, third-person active voice, no bullet points.\n\nReturn valid JSON only — no markdown, no code fences. Keys must be from: ${JSON.stringify(fieldKeys)}\nEach value is a string of clinical prose for that row.\n\nExample: {"bed": "Mr X requires full physical assistance..."}`;
                    queueItems.push({ key: domain.reportKey, prompt, maxTokens: 2000, inputForHash: inputText, label: `Domain: ${domain.name}` });
                  }

                  // 3. Assessments
                  // Build score summaries first
                  const WHODAS_DOMAINS_DEF = [
                    { id: "cognition", name: "Cognition", items: [1,2,3,4,5,6] },
                    { id: "mobility", name: "Mobility", items: [7,8,9,10,11] },
                    { id: "selfcare", name: "Self-Care", items: [12,13,14] },
                    { id: "getting_along", name: "Getting Along", items: [15,16,17,18,19,20] },
                    { id: "life_household", name: "Life Activities (Household)", items: [21,22,23,24] },
                    { id: "life_work", name: "Life Activities (Work/School)", items: [25,26,27,28] },
                    { id: "participation", name: "Participation", items: [29,30,31,32,33,34,35,36] },
                  ];
                  const WHODAS_SCORE_MAP: Record<string, number> = { "None": 0, "Mild": 1, "Moderate": 2, "Severe": 3, "Extreme / Cannot do": 4 };

                  function buildScoreSummary(assessment: AssessmentInstance): { rows: { label: string; value: string }[]; total: string; classification: string } {
                    const def = ASSESSMENT_LIBRARY.find(d => d.id === assessment.definitionId);
                    const rows: { label: string; value: string }[] = [];
                    let total = "";
                    let classification = "";
                    const sc = assessment.scores;

                    if (assessment.definitionId === "whodas-2.0") {
                      let grandTotal = 0; let maxPossible = 0;
                      for (const domain of WHODAS_DOMAINS_DEF) {
                        let domainTotal = 0; let domainMax = 0;
                        for (const itemNum of domain.items) {
                          const val = sc[`whodas_${itemNum}`];
                          if (val) { domainTotal += WHODAS_SCORE_MAP[val] ?? 0; domainMax += 4; }
                        }
                        if (domainMax > 0) {
                          const pct = Math.round((domainTotal / domainMax) * 100);
                          rows.push({ label: domain.name, value: `${pct}%` });
                          grandTotal += domainTotal; maxPossible += domainMax;
                        }
                      }
                      if (maxPossible > 0) {
                        const overallPct = Math.round((grandTotal / maxPossible) * 100);
                        total = `${grandTotal}/${maxPossible} (${overallPct}%)`;
                        if (overallPct <= 4) classification = "No disability";
                        else if (overallPct <= 24) classification = "Mild disability";
                        else if (overallPct <= 49) classification = "Moderate disability";
                        else if (overallPct <= 95) classification = "Severe disability";
                        else classification = "Extreme disability";
                      }
                    } else if (assessment.definitionId === "lsp-16") {
                      const LSP_SUBSCALES: Record<string, { name: string; max: number; items: number[] }> = {
                        withdrawal: { name: "Withdrawal", max: 12, items: [1, 2, 3, 8] },
                        selfcare: { name: "Self-Care", max: 15, items: [4, 5, 6, 9, 16] },
                        compliance: { name: "Compliance", max: 9, items: [10, 11, 12] },
                        antisocial: { name: "Anti-Social", max: 12, items: [7, 13, 14, 15] },
                      };
                      let sum = 0; let answered = 0;
                      for (let i = 1; i <= 16; i++) {
                        const val = sc[String(i)];
                        if (val !== undefined && val !== "") { sum += parseInt(val); answered++; }
                      }
                      total = `${sum}/48`;
                      if (sum <= 15) classification = "Low disability";
                      else if (sum <= 31) classification = "Moderate disability";
                      else classification = "High disability";
                      for (const [, sub] of Object.entries(LSP_SUBSCALES)) {
                        let subSum = 0;
                        for (const n of sub.items) { const v = sc[String(n)]; if (v !== undefined && v !== "") subSum += parseInt(v); }
                        rows.push({ label: sub.name, value: `${subSum}/${sub.max}` });
                      }
                    } else if (assessment.definitionId === "zarit") {
                      let sum = 0; let answered = 0;
                      for (let i = 1; i <= 22; i++) {
                        const val = sc[String(i)];
                        if (val !== undefined && val !== "") { sum += parseInt(val); answered++; }
                      }
                      total = `${sum}/88`;
                      if (answered === 22) {
                        if (sum <= 20) classification = "No to Mild Burden";
                        else if (sum <= 40) classification = "Mild to Moderate Burden";
                        else if (sum <= 60) classification = "Moderate to Severe Burden";
                        else classification = "Severe Burden";
                      } else { classification = `Incomplete (${answered}/22)`; }
                    } else if (assessment.definitionId === "frat") {
                      const FRAT_ITEMS = [
                        { id: "recent_falls", name: "Recent Falls", options: [
                          { text: "None in last 12 months", score: 2 }, { text: "One or more between 3 and 12 months ago", score: 4 },
                          { text: "One or more in last 3 months", score: 6 }, { text: "One or more in last 3 months whilst inpatient/resident", score: 8 },
                        ]},
                        { id: "medications", name: "Medications", options: [
                          { text: "Not taking any of these", score: 1 }, { text: "Taking one", score: 2 },
                          { text: "Taking two", score: 3 }, { text: "Taking more than two", score: 4 },
                        ]},
                        { id: "psychological", name: "Psychological", options: [
                          { text: "Does not appear to have any of these", score: 1 }, { text: "Appears mildly affected by one or more", score: 2 },
                          { text: "Appears moderately affected by one or more", score: 3 }, { text: "Appears severely affected by one or more", score: 4 },
                        ]},
                        { id: "cognitive", name: "Cognitive Status", options: [
                          { text: "AMTS 9 or 10/10 OR intact", score: 1 }, { text: "AMTS 7–8 — mildly impaired", score: 2 },
                          { text: "AMTS 5–6 — moderately impaired", score: 3 }, { text: "AMTS 4 or less — severely impaired", score: 4 },
                        ]},
                      ];
                      let fratTotal = 0; let fratAnswered = 0;
                      for (const item of FRAT_ITEMS) {
                        const idx = sc[`part1_${item.id}`];
                        if (idx !== undefined && idx !== "") {
                          const optIdx = parseInt(idx);
                          const score = item.options[optIdx]?.score ?? 0;
                          fratTotal += score; fratAnswered++;
                          rows.push({ label: item.name, value: `${item.options[optIdx]?.text} (${score})` });
                        }
                      }
                      const anyAutoHigh = sc["auto_functional_change"] === "true" || sc["auto_dizziness"] === "true";
                      if (anyAutoHigh) { classification = "High risk (automatic trigger)"; total = `${fratTotal}/20 (auto HIGH)`; }
                      else if (fratAnswered === 4) {
                        total = `${fratTotal}/20`;
                        if (fratTotal >= 16) classification = "High risk";
                        else if (fratTotal >= 12) classification = "Medium risk";
                        else classification = "Low risk";
                      } else { total = `${fratTotal}/20 (${fratAnswered}/4 answered)`; classification = "Incomplete"; }
                      let amtsTotal = 0; let amtsAnswered = 0;
                      for (let i = 1; i <= 10; i++) { const v = sc[`amts_${i}`]; if (v !== undefined && v !== "") { amtsTotal += parseInt(v); amtsAnswered++; } }
                      if (amtsAnswered > 0) rows.push({ label: "AMTS Score", value: `${amtsTotal}/10` });
                    } else if (assessment.definitionId === "cans") {
                      const CANS_GROUPS = [
                        { id: "A", name: "Group A", items: [1,2,3,4,5,6,7,8,9,10] },
                        { id: "B", name: "Group B", items: [11,12,13,14] },
                        { id: "C", name: "Group C", items: [15,16,17,18,19,20,21,22,23,24,25] },
                        { id: "D", name: "Group D", items: [26,27,28] },
                      ];
                      let totalYes = 0; let totalAnswered = 0; let highestGroup: string | null = null;
                      for (const g of CANS_GROUPS) {
                        let groupYes = 0; let groupAnswered = 0;
                        for (const n of g.items) { const v = sc[String(n)]; if (v === "true") { groupYes++; groupAnswered++; } else if (v === "false") { groupAnswered++; } }
                        totalYes += groupYes; totalAnswered += groupAnswered;
                        if (groupYes > 0 && !highestGroup) highestGroup = g.id;
                        rows.push({ label: g.name, value: `${groupYes} needs identified` });
                      }
                      const cansLevel = sc["__cans_level"] || null;
                      const CANS_LEVELS: Record<string, string> = {
                        "7": "Cannot be left alone — 24hr support", "6": "Can be left alone a few hours — 20–23hr support",
                        "5": "Can be left alone part of day, not overnight — 12–19hr", "4.3": "Up to 11hr (Group A)",
                        "4.2": "Up to 11hr (Group B)", "4.1": "Up to 11hr (Group C)",
                        "3": "Needs support a few days a week", "2": "Needs support at least once a week",
                        "1": "Needs intermittent support (less than weekly)", "0": "No support needed",
                      };
                      if (cansLevel) { total = `Level ${cansLevel}`; classification = CANS_LEVELS[cansLevel] || `Level ${cansLevel}`; }
                      else if (highestGroup) { total = `${totalYes} needs identified`; classification = `Highest group: ${highestGroup} (level not set)`; }
                      else if (totalAnswered === 28) { total = "0 needs identified"; classification = "No support needed (Level 0)"; }
                    } else if (assessment.definitionId === "lawton-iadl") {
                      const LAWTON_DOMAINS = [
                        { id: "telephone", name: "Telephone", maleIncluded: true, options: [1,1,1,0] },
                        { id: "shopping", name: "Shopping", maleIncluded: true, options: [1,0,0,0] },
                        { id: "food_prep", name: "Food Preparation", maleIncluded: false, options: [1,0,0,0] },
                        { id: "housekeeping", name: "Housekeeping", maleIncluded: false, options: [1,1,1,1,0] },
                        { id: "laundry", name: "Laundry", maleIncluded: false, options: [1,1,0] },
                        { id: "transport", name: "Transportation", maleIncluded: true, options: [1,1,1,0,0] },
                        { id: "medications", name: "Medications", maleIncluded: true, options: [1,0,0] },
                        { id: "finances", name: "Finances", maleIncluded: true, options: [1,1,0] },
                      ];
                      const gender = sc["__gender"] || "all";
                      const activeDomains = gender === "male" ? LAWTON_DOMAINS.filter(d => d.maleIncluded) : LAWTON_DOMAINS;
                      let sum = 0; let answered = 0;
                      for (const domain of activeDomains) {
                        const val = sc[domain.id];
                        if (val !== undefined && val !== "") {
                          const optIdx = parseInt(val);
                          const score = domain.options[optIdx] ?? 0;
                          sum += score; answered++;
                          rows.push({ label: domain.name, value: score === 1 ? "Independent" : "Dependent" });
                        }
                      }
                      total = `${sum}/${activeDomains.length}`;
                      if (sum === activeDomains.length) classification = "High function — independent";
                      else if (sum >= 5) classification = "Moderate function — some assistance needed";
                      else classification = "Low function — significant assistance needed";
                    } else if (assessment.definitionId === "sensory-profile") {
                      const SP_QUADRANTS: Record<string, { name: string; items: number[] }> = {
                        registration: { name: "Low Registration", items: [3,6,12,15,21,23,36,37,39,41,44,45,52,55,59] },
                        seeking: { name: "Sensation Seeking", items: [2,4,8,10,14,17,19,28,30,32,40,42,47,50,58] },
                        sensitivity: { name: "Sensory Sensitivity", items: [7,9,13,16,20,22,25,27,31,33,34,48,51,54,60] },
                        avoiding: { name: "Sensation Avoiding", items: [1,5,11,18,24,26,29,35,38,43,46,49,53,56,57] },
                      };
                      const SP_NORMS: Record<string, Record<string, Record<string, [number, number]>>> = {
                        "18-64": {
                          registration: { muchLess: [15,18], less: [19,23], similar: [24,35], more: [36,44], muchMore: [45,75] },
                          seeking: { muchLess: [15,35], less: [36,42], similar: [43,56], more: [57,62], muchMore: [63,75] },
                          sensitivity: { muchLess: [15,18], less: [19,25], similar: [26,41], more: [42,48], muchMore: [49,75] },
                          avoiding: { muchLess: [15,19], less: [20,26], similar: [27,41], more: [42,49], muchMore: [50,75] },
                        },
                        "11-17": {
                          registration: { muchLess: [15,18], less: [19,26], similar: [27,40], more: [41,51], muchMore: [52,75] },
                          seeking: { muchLess: [15,27], less: [28,41], similar: [42,58], more: [59,65], muchMore: [66,75] },
                          sensitivity: { muchLess: [15,19], less: [20,25], similar: [26,40], more: [41,48], muchMore: [49,75] },
                          avoiding: { muchLess: [15,18], less: [19,25], similar: [26,40], more: [41,48], muchMore: [49,75] },
                        },
                        "65+": {
                          registration: { muchLess: [15,19], less: [20,26], similar: [27,40], more: [41,51], muchMore: [52,75] },
                          seeking: { muchLess: [15,28], less: [29,39], similar: [40,52], more: [53,63], muchMore: [64,75] },
                          sensitivity: { muchLess: [15,18], less: [19,25], similar: [26,41], more: [42,48], muchMore: [49,75] },
                          avoiding: { muchLess: [15,18], less: [19,25], similar: [26,42], more: [43,49], muchMore: [50,75] },
                        },
                      };
                      const CLASS_LABELS: Record<string, string> = {
                        muchLess: "Much Less Than Most People", less: "Less Than Most People",
                        similar: "Similar To Most People", more: "More Than Most People", muchMore: "Much More Than Most People",
                      };
                      const ageGroup = sc["__age_group"] || "18-64";
                      let totalAnswered = 0;
                      for (const [key, q] of Object.entries(SP_QUADRANTS)) {
                        const answered = q.items.filter(n => { const v = sc[String(n)]; return v !== undefined && v !== ""; }).length;
                        const sum = q.items.reduce((acc, n) => { const v = sc[String(n)]; return acc + (v !== undefined && v !== "" ? parseInt(v) : 0); }, 0);
                        totalAnswered += answered;
                        let classLabel = "Incomplete";
                        if (answered === q.items.length) {
                          const norms = SP_NORMS[ageGroup]?.[key];
                          if (norms) { for (const [clKey, range] of Object.entries(norms)) { if (sum >= range[0] && sum <= range[1]) { classLabel = CLASS_LABELS[clKey] || clKey; break; } } }
                        }
                        rows.push({ label: q.name, value: `${sum}/75 — ${classLabel}` });
                      }
                      total = `${totalAnswered}/60 items scored`;
                      classification = "See quadrant breakdown";
                    } else if (assessment.definitionId === "dass-42") {
                      const DASS_SUBSCALES = [
                        { id: "depression", name: "Depression", short: "D", items: [3,5,10,13,16,17,21,24,26,31,34,37,38,42], thresholds: [{max:9,label:"Normal"},{max:13,label:"Mild"},{max:20,label:"Moderate"},{max:27,label:"Severe"},{max:999,label:"Extremely Severe"}] },
                        { id: "anxiety", name: "Anxiety", short: "A", items: [2,4,7,9,15,19,20,23,25,28,30,36,40,41], thresholds: [{max:7,label:"Normal"},{max:9,label:"Mild"},{max:14,label:"Moderate"},{max:19,label:"Severe"},{max:999,label:"Extremely Severe"}] },
                        { id: "stress", name: "Stress", short: "S", items: [1,6,8,11,12,14,18,22,27,29,32,33,35,39], thresholds: [{max:14,label:"Normal"},{max:18,label:"Mild"},{max:25,label:"Moderate"},{max:33,label:"Severe"},{max:999,label:"Extremely Severe"}] },
                      ];
                      let grandTotal = 0; let grandAnswered = 0;
                      for (const sub of DASS_SUBSCALES) {
                        let subSum = 0; let subAnswered = 0;
                        for (const n of sub.items) { const v = sc[String(n)]; if (v !== undefined && v !== "") { subSum += parseInt(v); subAnswered++; } }
                        grandTotal += subSum; grandAnswered += subAnswered;
                        let cls = "Incomplete";
                        if (subAnswered === sub.items.length) { for (const t of sub.thresholds) { if (subSum <= t.max) { cls = t.label; break; } } }
                        rows.push({ label: `${sub.name} (${sub.short})`, value: `${subSum}/${sub.items.length * 3} — ${cls}` });
                      }
                      total = `${grandTotal}/126`;
                      classification = grandAnswered === 42 ? "See subscale breakdown" : `Incomplete (${grandAnswered}/42)`;
                    } else if (def) {
                      const t = calculateTotal(def, assessment.scores);
                      classification = getClassification(def, t);
                      total = String(t);
                      if (def.subscales.length > 0) {
                        for (const sub of def.subscales) {
                          rows.push({ label: sub.label, value: String(calculateSubscaleTotal(def, sub.id, assessment.scores)) });
                        }
                      }
                    }

                    if (assessment.isCustom && assessment.customItems) {
                      for (const item of assessment.customItems) {
                        if (item.value) rows.push({ label: item.label, value: item.value });
                      }
                    }

                    return { rows, total, classification };
                  }

                  // Pre-compute assessment data for queue items
                  const assessmentMeta: { assessment: AssessmentInstance; scoreSummary: ReturnType<typeof buildScoreSummary>; synopsis: string; aName: string }[] = [];
                  for (const assessment of scoredAssessments) {
                    const scoreSummary = buildScoreSummary(assessment);
                    const def = ASSESSMENT_LIBRARY.find(d => d.id === assessment.definitionId);
                    const synopsis = def?.synopsis || "";
                    const aName = typeof assessment.name === "string" ? assessment.name : "Assessment";
                    assessmentMeta.push({ assessment, scoreSummary, synopsis, aName });

                    const scoresText = scoreSummary.rows.length > 0
                      ? scoreSummary.rows.map(r => `- ${r.label}: ${r.value}`).join("\n")
                      : JSON.stringify(assessment.scores, null, 2);

                    const assessRubric = getRubricForSection("assessment");
                    const prompt = `Write the interpretation for ${aName} in Section 15 (Standardised Assessments) of an NDIS Functional Capacity Assessment for ${clientName}.\n\n${ASSESSMENT_INTERPRETATION_GUIDANCE}\n\nASSESSMENT TOOL: ${aName}\nDATE ADMINISTERED: ${typeof assessment.dateAdministered === "string" ? assessment.dateAdministered : "Not recorded"}\n\nTOTAL SCORE: ${scoreSummary.total || "Not calculated"}\nCLASSIFICATION: ${scoreSummary.classification || "Not classified"}\n\nDOMAIN/SUBSCALE SCORES:\n${scoresText}\n\nCLINICIAN NOTES:\n${typeof assessment.interpretation === "string" && assessment.interpretation ? assessment.interpretation : "No clinician notes provided"}\n\n${assessRubric}\n\nWrite 2 paragraphs following the interpretation rules above. Do NOT include a synopsis — it is displayed separately. Person-first language, no markdown. Output only the interpretation text.`;

                    const inputHash = `${scoreSummary.total}|${scoreSummary.classification}|${assessment.interpretation || ""}`;
                    queueItems.push({ key: `assessment_${assessment.id}`, prompt, maxTokens: 1500, inputForHash: inputHash, label: `Assessment: ${aName}` });
                  }

                  // 4. Recommendations
                  const OUTCOME_LABELS: Record<string, string> = {
                    maintain_safety: "Maintain safety and wellbeing",
                    build_capacity: "Build capacity toward independence",
                    social_participation: "Increase social and community participation",
                    reduce_informal: "Reduce reliance on informal supports",
                    achieve_goals: "Support achievement of NDIS goals",
                    prevent_deterioration: "Prevent functional deterioration",
                    prevent_hospitalisation: "Reduce risk of hospitalisation or crisis",
                  };

                  for (let ri = 0; ri < recommendations.length; ri++) {
                    const r = recommendations[ri];
                    const recRubric = getRubricForSection("recommendation");
                    const prompt = `${RECOMMENDATION_GUIDANCE}\n\nConvert this structured recommendation into formal NDIS clinical prose. Person-first language, no bullet points, no markdown.\n\nParticipant: ${clientName}\nPrimary Diagnosis: ${client?.primary_diagnosis || ""}\n\nRecommendation ${ri + 1}: ${r.supportName}\nCategory: ${r.ndisCategory}\n${r.isCapital || r.isConsumable ? `Estimated Cost: ${r.estimatedCost || "Not specified"}` : `Current Provision: ${r.currentHours || "Nil"}\nRecommended Provision: ${r.recommendedHours || "Not specified"}\nSupport Ratio: ${r.ratio || "Not specified"}`}\n\nTasks:\n${(r.tasks || []).map(t => `- ${t}`).join("\n")}\n\nJustification: ${r.justification || "Not provided"}\nOutcomes:\n${(r.outcomes || []).map(o => `- ${OUTCOME_LABELS[o] || o}`).join("\n")}\nConsequence without support: ${r.consequence || "Not specified"}\nS34 Justification: ${r.s34Justification || "Not provided"}\n\n${recRubric}\n\nWrite 1 cohesive paragraph following the recommendation reasoning chain above. Use 'is expected to' not 'will'. Output only the recommendation text.`;

                    const inputHash = `${r.supportName}|${r.justification || ""}|${r.consequence || ""}|${(r.tasks || []).join(",")}`;
                    queueItems.push({ key: `rec_${r.id}`, prompt, maxTokens: 1500, inputForHash: inputHash, label: `Recommendation: ${r.supportName}` });
                  }

                  // ── Process queue sequentially with throttle ──
                  setGenerateProgress({ current: 0, total: queueItems.length, label: "Starting report generation..." });
                  const results = await processQueue(queueItems, (step, total, label, status) => {
                    if (status === "generating") {
                      // Build human-readable label
                      const humanLabel = label.startsWith("Section:") 
                        ? `Generating ${label.replace("Section: ", "")}...`
                        : label.startsWith("Domain:") 
                        ? `Generating ${label.replace("Domain: ", "")}...`
                        : label.startsWith("Assessment:") 
                        ? `Generating ${label.replace("Assessment: ", "")} interpretation...`
                        : label.startsWith("Recommendation:") 
                        ? `Generating ${label.replace("Recommendation: ", "")} recommendation...`
                        : `Generating ${label}...`;
                      setGenerateProgress({ current: step, total, label: humanLabel });
                    } else {
                      setGenerateProgress(prev => ({ ...prev, current: step }));
                    }
                  });

                  // ── Map results back ──
                  let successCount = 0;

                  for (const result of results) {
                    if (result.skipped && result.skipReason === "unchanged") {
                      // Keep existing content
                      successCount++;
                      continue;
                    }
                    if (!result.success) continue;

                    // Top-level sections
                    const topMatch = topLevelEntries.find(([id]) => id === result.key);
                    if (topMatch) { newContent[result.key] = result.text || ""; successCount++; continue; }

                    // Domain sections — parse JSON response
                    const domainMatch = domainEntries.find(d => d.reportKey === result.key);
                    if (domainMatch && result.text) {
                      let parsed: Record<string, string> = {};
                      try {
                        const rawText = result.text.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
                        parsed = JSON.parse(rawText);
                      } catch { parsed = { _fullText: result.text }; }

                      const structured: Record<string, { text: string; rating: string; label: string }> = {};
                      for (const row of domainMatch.rowData) {
                        structured[row.fieldId] = { text: parsed[row.fieldId] || parsed._fullText || "", rating: row.rating, label: row.label };
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
                        // Build per-assessment result entry
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

                  setReportContent(newContent);
                  setMode("report");

                  const skippedCount = results.filter(r => r.skipped).length;
                  const failedCount = results.filter(r => !r.success && !r.skipped).length;
                  let msg = `Generated ${successCount}/${queueItems.length} sections.`;
                  if (skippedCount > 0) msg += ` ${skippedCount} skipped (unchanged).`;
                  if (failedCount > 0) msg += ` ${failedCount} failed.`;
                  setGenerateProgress(prev => ({ ...prev, current: prev.total, label: "Report generation complete!" }));
                  toast.success(msg);
                } catch (err: any) {
                  console.error("Generation error:", err);
                  toast.error("Failed to generate: " + (err?.message || "Unknown error"));
                } finally {
                  setGeneratingReport(false);
                  setTimeout(() => setGenerateProgress({ current: 0, total: 0, label: "" }), 3000);
                }
              }}
            >
              {generatingReport ? "Generating…" : "Generate full report"}
            </Button>
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
          <EditorSidebar notes={notes} assessments={assessments} recommendations={recommendations} scrollContainerRef={mainRef} />
        )}
        <main ref={mainRef} className="flex-1 overflow-auto">
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
              onUpdateRecommendation={(idx, updated) => {
                setRecommendations(prev => prev.map((r, i) => i === idx ? updated : r));
              }}
              onUpdateReportContent={(key, value) => {
                setReportContent(prev => ({ ...prev, [key]: value }));
              }}
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
                  const acceptedFixes = scorecard.issues
                    .filter((issue: any) => issue.tier === "auto_correct" && issueStatuses[issue.id] === "accepted")
                    .map((issue: any) => ({
                      section: issue.section, sectionText: reportContent[issue.section] || "",
                      criterion: issue.criterion, flaggedText: issue.flaggedText,
                      suggestedFix: issue.suggestedFix, description: issue.description,
                    }));
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
    </div>
  );
}
