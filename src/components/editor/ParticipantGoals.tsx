import { useState, useMemo } from "react";
import { Plus, X, AlertCircle, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GoalInstance {
  id: string;
  text: string;
}

interface ParticipantGoalsProps {
  goals: GoalInstance[];
  onUpdateGoals: (goals: GoalInstance[]) => void;
  nilGoals: boolean;
  onToggleNilGoals: (val: boolean) => void;
  clientName?: string;
}

export function ParticipantGoals({ goals, onUpdateGoals, nilGoals, onToggleNilGoals, clientName }: ParticipantGoalsProps) {
  const [open, setOpen] = useState(true);
  const displayName = clientName?.trim() || "[Client Name]";
  const filledGoals = goals.filter(g => g.text.trim()).length;

  const addGoal = () => {
    onUpdateGoals([...goals, { id: crypto.randomUUID(), text: "" }]);
  };

  const updateGoal = (idx: number, text: string) => {
    onUpdateGoals(goals.map((g, i) => i === idx ? { ...g, text } : g));
  };

  const removeGoal = (idx: number) => {
    if (goals.length <= 1) return;
    onUpdateGoals(goals.filter((_, i) => i !== idx));
  };

  return (
    <div className="border-b border-border/30">
      {/* Section header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <span className="text-xs text-muted-foreground font-mono w-8 flex-shrink-0">5</span>
        <span className="text-sm font-medium text-foreground flex-1">Participant Goals</span>
        {(filledGoals > 0 || nilGoals) && (
          <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 pl-[4.5rem] space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Enter the participant's NDIS goals exactly as they appear in their plan. These are their own words and will not be rewritten by AI.
          </p>

          {/* Nil goals toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-sm bg-foreground" />
              <span className="text-sm font-semibold text-foreground">NDIS Goals</span>
              {!nilGoals && filledGoals > 0 && (
                <span className="text-xs text-emerald-600 font-semibold">
                  {filledGoals} goal{filledGoals !== 1 ? "s" : ""} entered
                </span>
              )}
            </div>
            <button
              onClick={() => onToggleNilGoals(!nilGoals)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-md border font-semibold transition-colors",
                nilGoals
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/50"
              )}
            >
              {nilGoals ? "Has NDIS Goals" : "No Current Goals"}
            </button>
          </div>

          {nilGoals ? (
            <div className="border border-border rounded-lg p-5 bg-muted/30 text-center space-y-2">
              <div className="text-2xl text-muted-foreground">—</div>
              <p className="text-sm text-foreground/80 italic max-w-md mx-auto leading-relaxed">
                {displayName} currently has no NDIS goals. This may be due to the participant being new to the NDIS, awaiting their first plan, or undergoing a plan reassessment.
              </p>
              <p className="text-xs text-muted-foreground">
                This statement will appear in Section 3 of the report.
              </p>
            </div>
          ) : (
            <>
              {/* Instruction callout */}
              <div className="px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                Copy these word-for-word from the participant's NDIS plan. They will appear in the report in first person, exactly as entered.
              </div>

              {/* Goal cards */}
              {goals.map((goal, idx) => (
                <div
                  key={goal.id}
                  className="border border-border/50 rounded-lg bg-background overflow-hidden"
                >
                  <div className="p-3 flex items-start gap-3">
                    <div
                      className={cn(
                        "w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold font-mono flex-shrink-0 mt-0.5 transition-colors",
                        goal.text.trim()
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {idx + 1}
                    </div>
                    <textarea
                      rows={2}
                      placeholder={
                        idx === 0
                          ? 'e.g. "I want to be able to look after myself at home and not rely on mum so much"'
                          : `Enter NDIS goal ${idx + 1}...`
                      }
                      value={goal.text}
                      onChange={(e) => updateGoal(idx, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.stopPropagation();
                      }}
                      style={{ resize: "vertical", minHeight: "52px" }}
                      className="flex-1 px-3 py-2 text-xs bg-muted/30 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 placeholder:text-muted-foreground/50"
                    />
                    {goals.length > 1 && (
                      <button
                        onClick={() => removeGoal(idx)}
                        title="Remove goal"
                        className="w-7 h-7 rounded-md border border-destructive/30 bg-destructive/10 text-destructive flex items-center justify-center flex-shrink-0 mt-0.5 hover:bg-destructive/20 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Add goal button */}
              <button
                onClick={addGoal}
                className="w-full p-2.5 rounded-md border-2 border-dashed border-border bg-muted/20 text-muted-foreground text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-muted/40 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add Goal
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
