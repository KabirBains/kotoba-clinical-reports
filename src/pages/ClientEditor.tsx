import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TEMPLATE_SECTIONS } from "@/lib/constants";
import { type AssessmentInstance } from "@/lib/assessment-library";
import { type RecommendationInstance } from "@/lib/recommendations-library";
import { assembleReport } from "@/ai/reportAssembler";
import { KotobaLogo } from "@/components/KotobaLogo";
import { NotesMode } from "@/components/editor/NotesMode";
import { ReportMode } from "@/components/editor/ReportMode";
import { EditorSidebar } from "@/components/editor/EditorSidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, PenLine, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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
  const [generatingReport, setGeneratingReport] = useState(false);
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
              disabled={generatingReport}
              onClick={async () => {
                setGeneratingReport(true);

                try {
                  const clientName = client?.client_name || "the participant";
                  const diagnosis = client?.primary_diagnosis || "";
                  const sectionEntries = Object.entries(notes).filter(
                    ([key, val]) =>
                      typeof val === "string" &&
                      (typeof val === "string" ? val.trim() : "") &&
                      !key.startsWith("__") &&
                      !key.endsWith("__rating")
                  );

                  const totalAssessments = assessments.filter(
                    a => a.scores && Object.keys(a.scores).length > 0
                  ).length;
                  const totalRecs = recommendations.length > 0 ? 1 : 0;
                  const totalSteps = sectionEntries.length + totalAssessments + totalRecs;

                  if (sectionEntries.length === 0 && totalAssessments === 0 && totalRecs === 0) {
                    toast.warning("Add notes, assessments, or recommendations before generating.");
                    setGeneratingReport(false);
                    return;
                  }

                  let currentStep = 0;
                  const newContent: Record<string, string> = { ...reportContent };
                  let successCount = 0;

                  // Track generated section summaries for cross-referencing
                  const generatedSections: { title: string; text: string }[] = [];

                  // === STEP 1: Generate text sections from notes ===
                  for (const [sectionId, observations] of sectionEntries) {
                    currentStep++;
                    toast.info(`Generating section ${currentStep} of ${totalSteps}...`);

                    const rating = typeof notes[`${sectionId}__rating`] === "string" ? notes[`${sectionId}__rating`] : "";
                    const prompt = `Write a section of an NDIS Functional Capacity Assessment for ${clientName}.

SECTION: ${sectionId}
FUNCTIONAL RATING: ${rating || "[Not provided]"}

CLINICIAN OBSERVATIONS (transform these into formal clinical prose):
${observations}

DIAGNOSIS CONTEXT: ${diagnosis || "[Not provided]"}

Write 2-3 paragraphs of formal NDIS report prose following the observation → impact → support need structure. Use person-first language and third-person active voice.`;

                    try {
                      const { data, error } = await supabase.functions.invoke("generate-report", {
                        body: { prompt, max_tokens: 3000 },
                      });
                      if (error) throw error;
                      if (!data?.success) throw new Error(data?.error || "Generation failed");

                      newContent[sectionId] = data.text;
                      generatedSections.push({ title: sectionId, text: data.text });
                      successCount++;
                    } catch (sectionErr: any) {
                      console.error(`Failed to generate ${sectionId}:`, sectionErr);
                    }
                  }

                  // === STEP 2: Generate assessment interpretations ===
                  const assessmentInterpretations: string[] = [];

                  for (const assessment of assessments) {
                    if (!assessment.scores || Object.keys(assessment.scores).length === 0) continue;
                    currentStep++;
                    toast.info(`Generating section ${currentStep} of ${totalSteps} — ${typeof assessment.name === "string" ? assessment.name : "Assessment"}...`);

                    const contextSummary = generatedSections
                      .map(s => `${s.title}: ${typeof s.text === "string" ? s.text.substring(0, 300) : ""}`)
                      .join("\n\n");

                    const assessmentPrompt = `Write the interpretation for ${typeof assessment.name === "string" ? assessment.name : "this assessment"} in Section 15 (Standardised Assessments) of an NDIS Functional Capacity Assessment for ${clientName}.

ASSESSMENT TOOL: ${typeof assessment.name === "string" ? assessment.name : "Unknown"}
DATE ADMINISTERED: ${typeof assessment.dateAdministered === "string" ? assessment.dateAdministered : "Not recorded"}

SCORES:
${JSON.stringify(assessment.scores, null, 2)}

CLINICIAN INTERPRETATION NOTES:
${typeof assessment.interpretation === "string" && assessment.interpretation ? assessment.interpretation : "No clinician notes provided"}

PREVIOUSLY GENERATED REPORT SECTIONS FOR CONTEXT:
${contextSummary}

Write 2-3 paragraphs of formal NDIS clinical prose:
Paragraph 1: State what this assessment tool measures and why it was selected for this participant.
Paragraph 2: State the scores and classification. Identify the highest-scoring domains or subscales and describe their functional implications.
Paragraph 3: Weave in the clinician's notes. Cross-reference findings from earlier sections of the report using the format: 'This finding is consistent with [observation] documented in Section [X] of this report.'`;

                    try {
                      const { data, error } = await supabase.functions.invoke("generate-report", {
                        body: { prompt: assessmentPrompt, max_tokens: 2000 },
                      });
                      if (error) throw error;
                      if (data?.success) {
                        const heading = `**${typeof assessment.name === "string" ? assessment.name : "Assessment"}** (${typeof assessment.dateAdministered === "string" ? assessment.dateAdministered : "Date not recorded"})`;
                        assessmentInterpretations.push(`${heading}\n\n${data.text}`);
                        successCount++;
                      }
                    } catch (err: any) {
                      console.error(`Failed to generate assessment ${assessment.name}:`, err);
                    }
                  }

                  if (assessmentInterpretations.length > 0) {
                    const combinedAssessments = assessmentInterpretations.join("\n\n---\n\n");
                    newContent["assessments"] = combinedAssessments;
                    generatedSections.push({ title: "Section 15 - Standardised Assessments", text: combinedAssessments });
                  }

                  // === STEP 3: Generate recommendation narratives ===
                  if (recommendations.length > 0) {
                    currentStep++;
                    toast.info(`Generating section ${currentStep} of ${totalSteps} — Recommendations...`);

                    const recsData = recommendations.map(r => ({
                      support: typeof r.supportName === "string" ? r.supportName : "",
                      category: typeof r.ndisCategory === "string" ? r.ndisCategory : "",
                      currentHours: typeof r.currentHours === "string" && r.currentHours ? r.currentHours : "Nil",
                      recommendedHours: typeof r.recommendedHours === "string" ? r.recommendedHours : "",
                      ratio: typeof r.ratio === "string" ? r.ratio : "",
                      tasks: Array.isArray(r.tasks) ? r.tasks : [],
                      justification: typeof r.justification === "string" ? r.justification : "",
                      outcomes: Array.isArray(r.outcomes) ? r.outcomes : [],
                      consequence: typeof r.consequence === "string" ? r.consequence : "",
                      linkedSections: Array.isArray(r.linkedSections) ? r.linkedSections : [],
                      s34Justification: typeof r.s34Justification === "string" ? r.s34Justification : "",
                      estimatedCost: typeof r.estimatedCost === "string" ? r.estimatedCost : "",
                    }));

                    const contextSummary = generatedSections
                      .map(s => `${s.title}: ${typeof s.text === "string" ? s.text.substring(0, 300) : ""}`)
                      .join("\n\n");

                    const recsPrompt = `Write Section 18 (Recommendations) of an NDIS Functional Capacity Assessment for ${clientName}.

RECOMMENDATIONS DATA:
${JSON.stringify(recsData, null, 2)}

PREVIOUSLY GENERATED REPORT SECTIONS FOR CONTEXT:
${contextSummary}

CRITICAL INSTRUCTIONS:
For EACH recommendation, write a single cohesive clinical narrative paragraph (not a table, not bullet points) that includes ALL of:

1. Bold heading with support name and NDIS category
2. State current provision and recommended provision with hours, frequency, and ratio
3. Name the specific diagnosis and explain how it causes the functional limitation that requires this support. Reference the linked report sections.
4. List the specific tasks this support will cover
5. Explain how this support will help therapeutically - capacity building, recovery, community integration
6. State the consequence: 'Without this support, ${clientName} is at risk of [specific consequence]'
7. Close with: 'This support is considered reasonable and necessary under Section 34 of the NDIS Act 2013. [S34 justification]'

Use 'is expected to' not 'will'. Name diagnoses explicitly. No bullet points.

After all individual recommendations, write a Total Support Summary paragraph listing the count of supports by NDIS category.`;

                    try {
                      const { data, error } = await supabase.functions.invoke("generate-report", {
                        body: { prompt: recsPrompt, max_tokens: 4000 },
                      });
                      if (error) throw error;
                      if (data?.success) {
                        newContent["recommendations"] = data.text;
                        generatedSections.push({ title: "Section 18 - Recommendations", text: data.text });
                        successCount++;
                      }
                    } catch (err: any) {
                      console.error("Failed to generate recommendations:", err);
                    }
                  }

                  setReportContent(newContent);
                  setMode("report");
                  toast.success(`Generated ${successCount}/${totalSteps} sections successfully. Building .docx...`);

                  // Build the .docx download using the assembler
                  try {
                    const today = new Date().toLocaleDateString("en-AU");
                    const reportData = {
                      participant: {
                        fullName: client?.client_name || "Participant",
                        dob: notes["participant-dob"] || "",
                        age: notes["participant-age"] || "",
                        ndisNumber: client?.ndis_number || "",
                        address: notes["participant-address"] || "",
                        primaryContact: notes["participant-contact"] || "",
                        primaryDiagnosis: client?.primary_diagnosis || "",
                        secondaryDiagnoses: notes["secondary-diagnoses"] || "",
                      },
                      clinician: {
                        name: profile?.clinician_name || "",
                        qualifications: profile?.qualifications || "",
                        ahpra: profile?.ahpra_number || "",
                        organisation: profile?.practice_name || "",
                        phoneEmail: "",
                        dateOfAssessment: notes["assessment-date"] || "",
                        dateOfReport: today,
                        otServicesCommenced: notes["ot-services-commenced"] || "",
                      },
                      presentAtAssessment: notes["present-at-assessment"] || "",
                      assessmentSetting: notes["assessment-setting"] || "",
                      section1: newContent["reason-referral"] || "",
                      section2: newContent["background"] || "",
                      section3: newContent["participant-goals"] || "",
                      section4: newContent["diagnoses"] || "",
                      section5: newContent["ot-case-history"] || "",
                      section6: newContent["methodology"] || "",
                      section7: newContent["informal-supports"] || "",
                      section8: newContent["home-environment"] || "",
                      section9: newContent["social-environment"] || "",
                      section10: newContent["typical-week"] || "",
                      section11: newContent["risk-safety"] || "",
                      section12_1: newContent["mobility"] || "",
                      section12_2: newContent["transfers"] || "",
                      section12_3: newContent["personal-adls"] || "",
                      section12_4: newContent["domestic-iadls"] || "",
                      section12_5: newContent["executive-iadls"] || "",
                      section12_6: newContent["cognition"] || "",
                      section12_7: newContent["communication"] || "",
                      section12_8: newContent["social-functioning"] || "",
                      section12_9: newContent["sensory-profile"] || "",
                      section13: newContent["assessments"] || "",
                      section14: newContent["limitations-barriers"] || "",
                      section15: newContent["functional-impact"] || "",
                      section16: newContent["recommendations"] || "",
                      section17: notes["risks-insufficient-funding"] || "",
                      section18: newContent["review-monitoring"] || "",
                      section19: notes["section-34-statement"] || "",
                      assessments: assessments.map(a => ({
                        tool: typeof a.name === "string" ? a.name : "",
                        date: typeof a.dateAdministered === "string" ? a.dateAdministered : "",
                        score: Object.entries(a.scores || {}).map(([k, v]) => `${k}: ${v}`).join(", "),
                        classification: String(a.scores?.classification || a.scores?.level || ""),
                        whySelected: typeof a.interpretation === "string" ? a.interpretation : "",
                      })),
                      recommendations: recommendations.map(r => ({
                        support: typeof r.supportName === "string" ? r.supportName : "",
                        category: typeof r.ndisCategory === "string" ? r.ndisCategory : "",
                        currentHours: typeof r.currentHours === "string" && r.currentHours ? r.currentHours : "Nil",
                        recommendedHours: typeof r.recommendedHours === "string" ? r.recommendedHours : "",
                        ratio: typeof r.ratio === "string" ? r.ratio : "",
                        tasks: Array.isArray(r.tasks) ? r.tasks.filter(Boolean).join(", ") : "",
                        linkedSections: Array.isArray(r.linkedSections) ? r.linkedSections.map((s: any) => `S.${s}`).join(", ") : "",
                      })),
                    };

                    await assembleReport(reportData);
                    toast.success("Report downloaded as .docx!");
                  } catch (docxErr: any) {
                    console.error("DOCX assembly error:", docxErr);
                    toast.error("Report generated but .docx download failed: " + (docxErr?.message || "Unknown error"));
                  }
                } catch (err: any) {
                  console.error("Generation error:", err);
                  toast.error("Failed to generate: " + (err?.message || "Unknown error"));
                } finally {
                  setGeneratingReport(false);
                }
              }}
            >
              {generatingReport ? "Generating…" : "Generate full report"}
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
