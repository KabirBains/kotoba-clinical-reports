import { useState, useMemo } from "react";
import {
  type RecommendationInstance,
  SUPPORT_LIBRARY,
  findSupport,
} from "@/lib/recommendations-library";
import { type DiagnosisInstance } from "@/lib/diagnosis-library";
import { type GoalInstance } from "@/components/editor/ParticipantGoals";
import { RecommendationCard } from "./RecommendationCard";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface RecommendationsSectionProps {
  recommendations: RecommendationInstance[];
  onUpdateRecommendations: (recommendations: RecommendationInstance[]) => void;
  // Optional context for AI-assisted justification drafting. Passed in from
  // NotesMode when available. If not supplied, the "Suggest with AI" button
  // degrades gracefully (button still works but produces a generic draft).
  clinicianNotes?: Record<string, string>;
  diagnoses?: DiagnosisInstance[];
  // Participant goals from the Participant Goals section. When present, the
  // AI justification draft will reference goal numbers ("Goals 1, 3, 5")
  // where this support enables progress toward them — matching the
  // senior-OT Clinical Reasoning column convention.
  goals?: GoalInstance[];
  participantName?: string;
  participantFirstName?: string;
  participantPronouns?: string;
  participantSex?: string;
}

export function RecommendationsSection({
  recommendations,
  onUpdateRecommendations,
  clinicianNotes,
  diagnoses,
  goals,
  participantName,
  participantFirstName,
  participantPronouns,
  participantSex,
}: RecommendationsSectionProps) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  // Per-recommendation loading state for the "Suggest with AI" button.
  // Keyed by recommendation index so multiple simultaneous clicks (unlikely
  // but possible) don't clobber each other.
  const [justifyingIndex, setJustifyingIndex] = useState<number | null>(null);

  const alreadyAdded = new Set(recommendations.map((r) => r.supportId));

  const addSupport = (
    supportId: string,
    supportName: string,
    categoryName: string,
    ndisCategory: "Core" | "Capacity Building" | "Capital",
    catColor: string,
    tasks: string[],
    outcomes: string[],
    isCapital?: boolean,
    isConsumable?: boolean
  ) => {
    const instance: RecommendationInstance = {
      id: crypto.randomUUID(),
      supportId,
      supportName,
      categoryName,
      ndisCategory,
      catColor,
      currentHours: "",
      recommendedHours: "",
      ratio: "",
      tasks: [...tasks],
      customTask: "",
      justification: "",
      outcomes: [...outcomes],
      // Consequence starts BLANK. The clinician fills it in (with the
      // help of the placeholder hint shown in RecommendationCard) or the
      // AI generation pipeline writes a participant-specific consequence
      // at report time. We deliberately do NOT seed this with the
      // exampleConsequenceTemplate from the library, because that would
      // become generic boilerplate copied verbatim into reports — which
      // violates rubric criterion B11 (consequence specificity).
      consequence: "",
      s34Justification: "",
      estimatedCost: "",
      isCapital,
      isConsumable,
    };
    onUpdateRecommendations([...recommendations, instance]);
    toast.success(`${supportName} added`);
  };

  const updateRec = (index: number, updated: RecommendationInstance) => {
    const next = [...recommendations];
    next[index] = updated;
    onUpdateRecommendations(next);
  };

  const removeRec = (index: number) => {
    onUpdateRecommendations(recommendations.filter((_, i) => i !== index));
  };

  // ── AI-assisted Clinical Justification ────────────────────────────────
  // Drafts (or expands) the justification field for a single recommendation
  // using the clinician's notes as cross-section context. Calls the
  // generate-report edge function with section_name
  // "section-recommendation-justification" — see the edge function for the
  // prompt guidance that defines structure / weakness-framing / length.
  //
  // The clinician's existing dot points (if any) are passed into the prompt
  // so the AI expands them rather than overwriting. If the field is empty,
  // the AI drafts from scratch.
  const handleSuggestJustification = async (index: number) => {
    const rec = recommendations[index];
    if (!rec) return;

    setJustifyingIndex(index);
    try {
      // Build a clean summary of the recommendation for the prompt.
      // Skip the ratio for items flagged hideRatio (therapies, coordination,
      // etc.) so the AI doesn't receive noise from legacy data where a
      // ratio may have been entered before hideRatio was introduced.
      const supportDef = findSupport(rec.supportId);
      const showRatio = !supportDef?.hideRatio && !!rec.ratio;
      const recSummary = [
        `SUPPORT: ${rec.supportName}`,
        `CATEGORY: ${rec.categoryName} (${rec.ndisCategory})`,
        `CURRENT FUNDING: ${rec.currentHours || "Not currently funded"}`,
        `RECOMMENDED: ${rec.recommendedHours || "Not yet specified"}${showRatio ? ` (${rec.ratio})` : ""}`,
        rec.tasks.length > 0 ? `KEY TASKS:\n${rec.tasks.map((t) => `- ${t}`).join("\n")}` : "",
        rec.outcomes.length > 0 ? `EXPECTED OUTCOMES: ${rec.outcomes.join(", ")}` : "",
        "",
        "EXISTING CLINICIAN DOT POINTS (expand these, do not replace):",
        rec.justification.trim() || "(none — clinician has not entered any dot points yet; draft from scratch using the notes context)",
      ]
        .filter(Boolean)
        .join("\n");

      const prompt = `Draft the Clinical Justification for this support recommendation. Reference specific findings from the clinician's notes where relevant.\n\n${recSummary}`;

      // Prepare the notes context. The edge function's generated_sections
      // lookback mechanism treats each key as a section name and each value
      // as that section's content. We reuse this infrastructure for raw
      // clinician notes — the AI reads them as documented findings.
      //
      // We filter out empty / internal-state keys (like __assessments__ and
      // __participant__* which start with double underscore) so they don't
      // pollute the prompt context.
      const notesContext: Record<string, string> = {};
      if (clinicianNotes) {
        for (const [key, value] of Object.entries(clinicianNotes)) {
          if (!key || key.startsWith("__")) continue;
          if (typeof value !== "string" || !value.trim()) continue;
          notesContext[key] = value;
        }
      }

      const diagnosesText = (diagnoses && diagnoses.length > 0)
        ? diagnoses.map((d) => d.name).filter(Boolean).join(", ")
        : "";

      // Pack goals into the structured format the edge function expects.
      // {number, text} objects so the model can cite "Goals 1, 3, 5" without
      // re-numbering. We send only goals with non-empty text.
      const goalsPayload = (goals || [])
        .map((g, i) => ({ number: i + 1, text: (g.text || "").trim() }))
        .filter((g) => g.text.length > 0);

      const { data, error } = await supabase.functions.invoke("generate-report", {
        body: {
          prompt,
          section_name: "section-recommendation-justification",
          max_tokens: 1200,
          participant_name: participantName || "",
          participant_first_name: participantFirstName || "",
          participant_pronouns: participantPronouns || "",
          participant_sex: participantSex || "",
          diagnoses_context: diagnosesText,
          generated_sections: notesContext,
          participant_goals: goalsPayload,
        },
      });

      if (error || !data?.success || typeof data?.text !== "string" || !data.text.trim()) {
        const msg = data?.error || data?.details || error?.message || "Unknown error";
        console.error("[suggest-justification] failed:", msg);
        toast.error("Couldn't draft justification — please try again");
        return;
      }

      updateRec(index, { ...rec, justification: data.text.trim() });
      toast.success("Draft justification added — edit as needed");
    } catch (e) {
      console.error("[suggest-justification] exception:", e);
      toast.error("Couldn't draft justification — please try again");
    } finally {
      setJustifyingIndex(null);
    }
  };

  const summary = useMemo(() => {
    // NDIS funding categories — Core / Capacity Building / Capital map
    // directly from r.ndisCategory. Consumables (e.g. continence aids,
    // low-cost AT) are ndisCategory "Core" with isConsumable=true; they
    // belong in the Core tally for NDIS budgeting purposes — they are
    // NOT Capital. Earlier code incorrectly counted consumables under
    // Capital and excluded them from Core; fixed Apr 25 2026.
    //
    // Items flagged isCapital=true are always Capital regardless of how
    // ndisCategory is set, so we route by isCapital first, then fall
    // back to ndisCategory.
    const core = recommendations.filter(
      (r) => !r.isCapital && r.ndisCategory === "Core",
    ).length;
    const cb = recommendations.filter(
      (r) => !r.isCapital && r.ndisCategory === "Capacity Building",
    ).length;
    const capital = recommendations.filter(
      (r) => r.isCapital || r.ndisCategory === "Capital",
    ).length;
    return { core, cb, capital, total: recommendations.length };
  }, [recommendations]);

  return (
    <div data-section-id="recommendations" className="border-b border-border/30">
      {/* Section header */}
      <div className="w-full flex items-center gap-3 px-5 py-3 text-left">
        <span className="text-xs text-muted-foreground font-mono w-8 flex-shrink-0 ml-[1.75rem]">
          18
        </span>
        <span className="text-sm font-semibold text-foreground flex-1">
          Recommendations
        </span>
      </div>

      {/* Summary bar */}
      {recommendations.length > 0 && (
        <div className="px-5 pb-2 pl-[4.5rem] flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            <strong className="text-blue-600">{summary.core}</strong> Core
          </span>
          <span>
            <strong className="text-violet-600">{summary.cb}</strong> Capacity Building
          </span>
          <span>
            <strong className="text-red-600">{summary.capital}</strong> Capital
          </span>
          <span className="font-semibold text-foreground">{summary.total} total</span>
        </div>
      )}

      {/* Add button */}
      <div className="px-5 pb-4 pl-[4.5rem]">
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => setLibraryOpen(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add support recommendation
        </Button>
      </div>

      {/* Recommendation cards */}
      {recommendations.length > 0 && (
        <div className="px-5 pb-5 pl-[4.5rem] space-y-3">
          {recommendations.map((rec, index) => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              index={index}
              onUpdate={updateRec}
              onRemove={removeRec}
              onSuggestJustification={() => handleSuggestJustification(index)}
              isJustifying={justifyingIndex === index}
            />
          ))}
        </div>
      )}

      {/* Summary table */}
      {recommendations.length > 0 && (
        <div className="px-5 pb-5 pl-[4.5rem]">
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <div className="bg-foreground px-4 py-3">
              <h3 className="text-sm font-bold text-background">Recommendations Summary</h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Support</th>
                  <th className="text-center px-2 py-2 font-medium text-muted-foreground w-20">Category</th>
                  <th className="text-center px-2 py-2 font-medium text-muted-foreground w-24">Current</th>
                  <th className="text-center px-2 py-2 font-medium text-muted-foreground w-28">Recommended</th>
                  <th className="text-center px-2 py-2 font-medium text-muted-foreground w-14">Ratio</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((rec, idx) => (
                  <tr
                    key={rec.id}
                    className={cn(
                      "border-t border-border/30",
                      idx % 2 === 0 ? "bg-background" : "bg-muted/20"
                    )}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-[3px] h-3.5 rounded-sm shrink-0"
                          style={{ backgroundColor: rec.catColor }}
                        />
                        <span className="font-medium text-foreground">{rec.supportName}</span>
                      </div>
                    </td>
                    <td className="text-center px-2 py-2">
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: rec.catColor + "15",
                          color: rec.catColor,
                        }}
                      >
                        {rec.ndisCategory}
                      </span>
                    </td>
                    <td className="text-center px-2 py-2 font-mono text-[11px] text-muted-foreground">
                      {rec.currentHours || "nil"}
                    </td>
                    <td className="text-center px-2 py-2 font-mono text-[11px] font-semibold" style={{ color: rec.recommendedHours ? rec.catColor : undefined }}>
                      {rec.recommendedHours || "—"}
                    </td>
                    <td className="text-center px-2 py-2 font-mono text-[11px]">
                      {/* Show dash for items where ratio is not applicable
                          (therapies, coordination, etc.) even if legacy data
                          has a stored ratio value. */}
                      {findSupport(rec.supportId)?.hideRatio ? "—" : (rec.ratio || "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 bg-muted/30 border-t border-border/50 flex gap-5 text-xs text-muted-foreground">
              <span><strong className="text-blue-600">Core:</strong> {summary.core} supports</span>
              <span><strong className="text-violet-600">Capacity Building:</strong> {summary.cb} supports</span>
              <span><strong className="text-red-600">Capital:</strong> {summary.capital} items</span>
            </div>
          </div>
        </div>
      )}

      {/* Library modal */}
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Support Library</DialogTitle>
            <DialogDescription>
              Select a support to add to your recommendations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {Object.entries(SUPPORT_LIBRARY).map(([catName, cat]) => (
              <div key={catName}>
                <div
                  className="text-xs font-bold mb-1.5 pb-1 border-b-2"
                  style={{ color: cat.color, borderColor: cat.color + "30" }}
                >
                  {catName}
                </div>
                <div className="space-y-1">
                  {cat.items.map((item) => {
                    const added = alreadyAdded.has(item.id);
                    return (
                      <button
                        key={item.id}
                        disabled={added}
                        onClick={() =>
                          addSupport(
                            item.id,
                            item.name,
                            catName,
                            cat.category,
                            cat.color,
                            item.tasks,
                            item.outcomes,
                            item.isCapital,
                            item.isConsumable
                          )
                        }
                        className={cn(
                          "w-full text-left p-2.5 rounded-md border transition-colors",
                          added
                            ? "border-border/30 bg-muted/30 opacity-50 cursor-not-allowed"
                            : "border-border/50 hover:bg-muted/50 hover:border-accent/30 cursor-pointer"
                        )}
                      >
                        <span className="text-sm font-medium text-foreground">{item.name}</span>
                        {added && (
                          <span className="text-[10px] text-muted-foreground ml-2">(already added)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
