import { useState } from "react";
import {
  type RecommendationInstance,
  type SupportItem,
  OUTCOME_OPTIONS,
  SECTION_OPTIONS,
  SUPPORT_LIBRARY,
} from "@/lib/recommendations-library";
import { ChevronDown, ChevronRight, Trash2, GripVertical, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RecommendationCardProps {
  rec: RecommendationInstance;
  index: number;
  onUpdate: (index: number, updated: RecommendationInstance) => void;
  onRemove: (index: number) => void;
  // AI-assisted Clinical Justification drafting. Optional — if not provided,
  // the Suggest-with-AI button is hidden so the card still works in contexts
  // that don't have access to clinician notes (e.g. standalone demos).
  onSuggestJustification?: () => Promise<void> | void;
  isJustifying?: boolean;
}

function findSupport(supportId: string): SupportItem | null {
  for (const cat of Object.values(SUPPORT_LIBRARY)) {
    const item = cat.items.find((i) => i.id === supportId);
    if (item) return item;
  }
  return null;
}

export function RecommendationCard({ rec, index, onUpdate, onRemove, onSuggestJustification, isJustifying = false }: RecommendationCardProps) {
  const [open, setOpen] = useState(true);
  const support = findSupport(rec.supportId);

  const updateField = <K extends keyof RecommendationInstance>(field: K, value: RecommendationInstance[K]) => {
    onUpdate(index, { ...rec, [field]: value });
  };

  const toggleTask = (task: string) => {
    const tasks = rec.tasks.includes(task)
      ? rec.tasks.filter((t) => t !== task)
      : [...rec.tasks, task];
    updateField("tasks", tasks);
  };

  const toggleOutcome = (id: string) => {
    const outcomes = rec.outcomes.includes(id)
      ? rec.outcomes.filter((o) => o !== id)
      : [...rec.outcomes, id];
    updateField("outcomes", outcomes);
  };

  const toggleSection = (s: string) => {
    const sections = rec.linkedSections.includes(s)
      ? rec.linkedSections.filter((x) => x !== s)
      : [...rec.linkedSections, s];
    updateField("linkedSections", sections);
  };

  const allTasks = support?.tasks ?? [];
  const isCapitalOrConsumable = rec.isCapital || rec.isConsumable;

  return (
    <div
      data-section-id={`recommendation-${rec.id}`}
      className="border border-border/50 rounded-lg bg-card overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors text-left"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <span className="text-xs text-muted-foreground font-mono w-8 flex-shrink-0">
          18.{index + 1}
        </span>
        <span className="text-sm font-medium text-foreground flex-1">{rec.supportName}</span>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: rec.catColor + "15",
            color: rec.catColor,
          }}
        >
          {rec.ndisCategory}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(index);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-border/30 pt-4">
          {/* Hours / Cost */}
          {!isCapitalOrConsumable ? (
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[140px]">
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Current Provision
                </label>
                <input
                  type="text"
                  placeholder="e.g. 7 hrs/week or nil"
                  value={rec.currentHours}
                  onChange={(e) => updateField("currentHours", e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-muted/30 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-accent/50"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Recommended Provision
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2 hrs/day, 7 days/week"
                  value={rec.recommendedHours}
                  onChange={(e) => updateField("recommendedHours", e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-muted/30 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-accent/50"
                />
              </div>
              {/*
                Support Ratio — only rendered for support items where the
                ratio is a meaningful decision variable (i.e., support
                worker items like Personal Care, Community Access, SIL).
                Hidden for professional/clinician services (OT, Physio,
                Psychology, Speech, etc.) where the 1:1 clinician-to-
                participant ratio is implicit, and for coordination services
                which are hours-based. See SupportItem.hideRatio in
                recommendations-library.ts for the flagged items.
              */}
              {!support?.hideRatio && (
                <div className="min-w-[100px]">
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Support Ratio
                  </label>
                  <Select value={rec.ratio} onValueChange={(val) => updateField("ratio", val)}>
                    <SelectTrigger className="h-9 text-xs bg-background border-border/60">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {["1:1", "1:2", "2:1", "Group", "N/A"].map((r) => (
                        <SelectItem key={r} value={r} className="text-xs">
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-[300px]">
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                Estimated Cost
              </label>
              <input
                type="text"
                placeholder="e.g. $2,500"
                value={rec.estimatedCost}
                onChange={(e) => updateField("estimatedCost", e.target.value)}
                className="w-full h-9 px-3 text-xs bg-muted/30 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-accent/50"
              />
            </div>
          )}

          {/* Tasks */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
              Tasks Covered
            </label>
            <div className="flex flex-wrap gap-1">
              {allTasks.map((task) => {
                const active = rec.tasks.includes(task);
                return (
                  <button
                    key={task}
                    onClick={() => toggleTask(task)}
                    className={cn(
                      "px-2.5 py-1 rounded text-[11px] border transition-colors",
                      active
                        ? "border-accent bg-accent/10 text-accent font-semibold"
                        : "border-border/50 bg-background text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {task}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              placeholder="Add custom task… (press Enter)"
              value={rec.customTask}
              onChange={(e) => updateField("customTask", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && rec.customTask.trim()) {
                  updateField("tasks", [...rec.tasks, rec.customTask.trim()]);
                  updateField("customTask", "");
                }
              }}
              className="mt-1.5 w-full h-8 px-3 text-xs bg-muted/20 border border-border/40 rounded-md focus:outline-none focus:ring-1 focus:ring-accent/50 placeholder:text-muted-foreground/40"
            />
          </div>

          {/* Clinical Justification */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-muted-foreground">
                Clinical Justification — Why this level is needed
              </label>
              {onSuggestJustification && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isJustifying}
                  onClick={() => { void onSuggestJustification(); }}
                  className="h-6 px-2 text-[10px] font-semibold text-accent hover:text-accent hover:bg-accent/10 gap-1"
                  title={rec.justification.trim()
                    ? "Expand your dot points into a full clinical justification using your documented notes"
                    : "Draft a clinical justification using your documented notes"}
                >
                  {isJustifying ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Drafting…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3" />
                      {rec.justification.trim() ? "Expand with AI" : "Suggest with AI"}
                    </>
                  )}
                </Button>
              )}
            </div>
            <textarea
              rows={2}
              placeholder="Why this participant needs this support at this level..."
              value={rec.justification}
              onChange={(e) => updateField("justification", e.target.value)}
              className="w-full p-3 text-xs bg-muted/30 border border-border/50 rounded-md resize-y focus:outline-none focus:ring-1 focus:ring-accent/50 placeholder:text-muted-foreground/50"
            />
            {onSuggestJustification && (
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                Enter your own dot points and use "Expand with AI" to draft the full reasoning chain from your notes. Or leave blank and use "Suggest with AI" to draft from scratch.
              </p>
            )}
          </div>

          {/* Expected Outcomes */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
              Expected Outcomes
            </label>
            <div className="flex flex-wrap gap-1">
              {OUTCOME_OPTIONS.map((o) => {
                const active = rec.outcomes.includes(o.id);
                return (
                  <button
                    key={o.id}
                    onClick={() => toggleOutcome(o.id)}
                    title={o.label}
                    className={cn(
                      "px-2.5 py-1 rounded text-[11px] border transition-colors",
                      active
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 font-semibold"
                        : "border-border/50 bg-background text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {o.short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Consequence */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Without this support, <strong>{rec.supportName.split(" ")[0] || "the participant"}</strong> is at risk of…
              <span className="text-[10px] font-normal text-muted-foreground/70 ml-1">
                (be specific to this participant — generic statements will be flagged)
              </span>
            </label>
            <textarea
              rows={2}
              value={rec.consequence}
              onChange={(e) => updateField("consequence", e.target.value)}
              placeholder={
                support?.exampleConsequenceTemplate
                  ? `e.g., ${support.exampleConsequenceTemplate}\n\nBut tailor this to THIS participant — name their specific risks, link to their diagnosis and observed limitations.`
                  : "Name the specific consequences for this participant if the support is not provided. Reference their diagnosis, observed limitations, and concrete risks (not generic statements)."
              }
              className="w-full p-3 text-xs bg-muted/30 border border-border/50 rounded-md resize-y focus:outline-none focus:ring-1 focus:ring-accent/50 placeholder:text-muted-foreground/50"
            />
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              If left blank, the AI will generate a participant-specific consequence at report time using the participant's diagnoses, functional capacity findings, and risk profile.
            </p>
          </div>

          {/* Linked sections */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
              Linked Report Sections
            </label>
            <div className="flex flex-wrap gap-1">
              {SECTION_OPTIONS.map((s) => {
                const active = rec.linkedSections.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleSection(s)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-mono border transition-colors",
                      active
                        ? "border-accent bg-accent/10 text-accent font-bold"
                        : "border-border/40 bg-background text-muted-foreground/50 hover:bg-muted/50"
                    )}
                  >
                    S.{s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* S34 Justification */}
          <div className="bg-muted/20 border border-border/40 rounded-md p-3">
            <label className="text-[11px] font-semibold text-accent block mb-1">
              Why NDIS-funded (not independently funded)?
            </label>
            <textarea
              rows={2}
              placeholder="This support cannot reasonably be provided by informal supports because..."
              value={rec.s34Justification}
              onChange={(e) => updateField("s34Justification", e.target.value)}
              className="w-full p-3 text-xs bg-background border border-border/50 rounded-md resize-y focus:outline-none focus:ring-1 focus:ring-accent/50 placeholder:text-muted-foreground/50"
            />
          </div>
        </div>
      )}
    </div>
  );
}
