import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TEMPLATE_SECTIONS } from "@/lib/constants";
import { type AssessmentInstance } from "@/lib/assessment-library";
import { type RecommendationInstance } from "@/lib/recommendations-library";
import { KotobaLogo } from "@/components/KotobaLogo";
import { NotesMode } from "@/components/editor/NotesMode";
import { ReportMode } from "@/components/editor/ReportMode";
import { EditorSidebar } from "@/components/editor/EditorSidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, PenLine, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { generateSection } from "@/ai/reportEngine";

export default function ClientEditor() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"notes" | "report">("notes");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [assessments, setAssessments] = useState<AssessmentInstance[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationInstance[]>([]);
  const [reportContent, setReportContent] = useState<Record<string, string>>({});
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
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

  // Load notes and report from DB
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
    }
  }, [report]);

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
    const notesWithAssessments = { ...notes, __assessments__: assessments as any, __recommendations__: recommendations as any };
    const { error } = await supabase
      .from("reports")
      .update({ notes: notesWithAssessments, report_content: reportContent || null })
      .eq("id", report.id);
    if (!error) {
      setLastSaved(new Date());
      if (clientId) localStorage.setItem(`kotoba-notes-${clientId}`, JSON.stringify(notes));
    }
  }, [report?.id, notes, assessments, recommendations, reportContent, clientId]);

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
                Notes mode
              </Button>
              <Button
                variant={mode === "report" ? "default" : "ghost"}
                size="sm"
                className="rounded-none"
                onClick={() => setMode("report")}
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Report mode
              </Button>
            </div>

            <Button
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={isGenerating}
              onClick={async () => {
                setIsGenerating(true);
                toast.info("Generating report — this may take a minute...");
                const clientName = client?.client_name || "Participant";
                const sectionMap: Record<string, Record<string, any>> = {
                  reason_for_referral: {
                    referral_source: notes["reason-referral"] || "",
                    purpose: notes["reason-referral"] || "",
                    funding_context: "",
                    current_supports: notes["intervention-team"] || "",
                    supports_requested: "",
                  },
                  background: {
                    participant_overview: notes["background"] || "",
                    living_situation: notes["home-environment"] || "",
                    education_work: notes["background"] || "",
                    psychosocial_history: notes["background"] || "",
                    medical_history: notes["background"] || "",
                    treating_team: notes["intervention-team"] || "",
                  },
                  goals: {
                    ndis_goals: notes["participant-goals"] || "",
                    ot_goals: notes["participant-goals"] || "",
                  },
                  diagnoses: {
                    primary_dx: client?.primary_diagnosis || "",
                    secondary_dx: notes["diagnoses"] || "",
                    comorbidities: "",
                    dx_description: notes["diagnoses"] || "",
                    functional_impact: "",
                  },
                  allied_health_history: {
                    disciplines: notes["ot-case-history"] || "",
                    discipline_details: notes["ot-case-history"] || "",
                    assessment_type: "Initial",
                  },
                  methodology: {
                    observation_details: notes["methodology"] || "",
                    collateral_sources: notes["methodology"] || "",
                    environment_assessment: notes["home-environment"] || "",
                  },
                  informal_supports: {
                    carer_details: notes["informal-supports"] || "",
                    support_provided: notes["informal-supports"] || "",
                    carer_health: "",
                    carer_burnout: "",
                    sustainability_risks: "",
                  },
                  limitations: {
                    limitations_list: notes["limitations-barriers"] || "",
                  },
                  impact_summary: {
                    diagnoses: client?.primary_diagnosis || "",
                    impairments_by_domain: notes["functional-impact"] || "",
                    supports_requested: "",
                    capacity_building_goal: "",
                    assessment_summary: "",
                  },
                  risks: {
                    risks_list: notes["risks-insufficient-funding"] || notes["review-monitoring"] || "",
                  },
                  section_34: {
                    ndis_goals: notes["participant-goals"] || "",
                    intended_outcomes: notes["functional-impact"] || "",
                  },
                };

                // Map functional domains
                const domainIds = ["mobility", "transfers", "personal-adls", "domestic-iadls", "executive-iadls", "cognition", "communication", "social-functioning", "sensory-profile"];
                const domainNames = ["Mobility", "Transfers", "Personal ADLs", "Domestic IADLs", "Executive IADLs", "Cognition", "Communication", "Social Functioning", "Sensory Profile"];
                domainIds.forEach((domId, i) => {
                  // Gather structured field data for each domain
                  const domainNotes = Object.entries(notes)
                    .filter(([k]) => k.startsWith(`${domId}__`))
                    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : ""}`)
                    .join("\n");
                  const rawObs = notes[domId] || domainNotes || "";
                  if (rawObs.trim()) {
                    sectionMap[`functional_domain_${domId}`] = {
                      domain_name: domainNames[i],
                      functional_level: notes[`${domId}__rating`] || "",
                      raw_observations: rawObs,
                      support_need: "",
                      diagnosis_context: client?.primary_diagnosis || "",
                      assessment_scores: "",
                    };
                  }
                });

                const newReportContent: Record<string, string> = { ...reportContent };
                const sectionIdToNoteKey: Record<string, string> = {
                  reason_for_referral: "reason-referral",
                  background: "background",
                  goals: "participant-goals",
                  diagnoses: "diagnoses",
                  allied_health_history: "ot-case-history",
                  methodology: "methodology",
                  informal_supports: "informal-supports",
                  limitations: "limitations-barriers",
                  impact_summary: "functional-impact",
                  risks: "review-monitoring",
                  section_34: "section-34-statement",
                };

                let generated = 0;
                let failed = 0;

                for (const [sectionId, input] of Object.entries(sectionMap)) {
                  // Skip sections with no meaningful input
                  const hasInput = Object.values(input).some(
                    (v) => typeof v === "string" && v.trim().length > 5
                  );
                  if (!hasInput) continue;

                  try {
                    const prose = await generateSection(sectionId, clientName, input);
                    // Map back to note key for reportContent
                    if (sectionId.startsWith("functional_domain_")) {
                      const domId = sectionId.replace("functional_domain_", "");
                      newReportContent[domId] = prose;
                    } else {
                      const noteKey = sectionIdToNoteKey[sectionId] || sectionId;
                      newReportContent[noteKey] = prose;
                    }
                    generated++;
                  } catch (err: any) {
                    console.error(`Failed to generate ${sectionId}:`, err);
                    failed++;
                  }
                }

                setReportContent(newReportContent);
                setMode("report");
                setIsGenerating(false);

                if (generated > 0) {
                  toast.success(`Generated ${generated} sections.${failed > 0 ? ` ${failed} failed.` : ""}`);
                } else {
                  toast.error("No sections generated. Please add notes first.");
                }

                // Save to cloud
                saveToCloud();
              }}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Generating…
                </>
              ) : (
                "Generate full report"
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Progress bar */}
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
              clinicianProfile={profile || null}
            />
          )}
        </main>
      </div>
    </div>
  );
}
