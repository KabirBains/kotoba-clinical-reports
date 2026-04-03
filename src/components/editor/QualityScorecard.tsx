import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Check, CheckCheck, AlertTriangle, Filter } from "lucide-react";

export interface QualityIssue {
  id: string;
  criterion: string;
  category: "clinical" | "editorial" | "cross_section";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  section: string;
  flaggedText: string;
  tier: "auto_correct" | "clinician_review";
  suggestedFix: string | null;
  crossRefSource: string | null;
  crossRefTarget: string | null;
}

export interface Scorecard {
  score: number;
  grade: string;
  summary: string;
  categories: {
    clinical: { passed: number; total: number };
    editorial: { passed: number; total: number };
    cross_section: { passed: number; total: number };
  };
  missingSections: string[];
  issues: QualityIssue[];
}

interface QualityScorecardProps {
  scorecard: Scorecard;
  acceptedIssues: string[];
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onAcceptAll: () => void;
  onApplyCorrections: () => void;
  onClose: () => void;
  isApplying: boolean;
}

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "hsl(142 76% 36%)";
  if (grade.startsWith("B")) return "hsl(217 91% 60%)";
  if (grade.startsWith("C")) return "hsl(32 95% 44%)";
  return "hsl(0 72% 51%)";
}

function severityBorder(severity: string): string {
  if (severity === "high") return "#dc2626";
  if (severity === "medium") return "#d97706";
  return "#9ca3af";
}

function severityDot(severity: string): string {
  if (severity === "high") return "bg-destructive";
  if (severity === "medium") return "bg-yellow-500";
  return "bg-muted-foreground/40";
}

function CategoryCard({ label, passed, total }: { label: string; passed: number; total: number }) {
  const pct = total > 0 ? (passed / total) * 100 : 0;
  return (
    <div className="flex-1 border border-border/50 rounded-lg p-3 space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground">{passed}/{total} passed</div>
      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            backgroundColor: pct >= 90 ? "hsl(142 76% 36%)" : pct >= 70 ? "hsl(217 91% 60%)" : "hsl(32 95% 44%)",
          }}
        />
      </div>
    </div>
  );
}

export function QualityScorecard({
  scorecard,
  acceptedIssues,
  onAccept,
  onDismiss,
  onAcceptAll,
  onApplyCorrections,
  onClose,
  isApplying,
}: QualityScorecardProps) {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterTier, setFilterTier] = useState<string>("all");

  const autoCorrectCount = scorecard.issues.filter(i => i.tier === "auto_correct").length;
  const pendingAcceptCount = scorecard.issues.filter(
    i => i.tier === "auto_correct" && !acceptedIssues.includes(i.id)
  ).length;

  const filteredIssues = useMemo(() => {
    return scorecard.issues.filter(i => {
      if (filterCategory !== "all" && i.category !== filterCategory) return false;
      if (filterSeverity !== "all" && i.severity !== filterSeverity) return false;
      if (filterTier !== "all" && i.tier !== filterTier) return false;
      return true;
    });
  }, [scorecard.issues, filterCategory, filterSeverity, filterTier]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border/50 space-y-4">
          {/* Overall score */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-[32px] font-bold leading-none" style={{ color: gradeColor(scorecard.grade) }}>
                  {scorecard.score}
                </div>
                <div className="text-lg font-semibold mt-1" style={{ color: gradeColor(scorecard.grade) }}>
                  {scorecard.grade}
                </div>
              </div>
              <div className="border-l border-border/50 pl-4">
                <h2 className="text-base font-semibold text-foreground">Report Quality Check</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{scorecard.summary}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Category cards */}
          <div className="flex gap-3">
            <CategoryCard label="Clinical & Structural" passed={scorecard.categories.clinical.passed} total={scorecard.categories.clinical.total} />
            <CategoryCard label="Editorial & Coherence" passed={scorecard.categories.editorial.passed} total={scorecard.categories.editorial.total} />
            <CategoryCard label="Cross-Section Consistency" passed={scorecard.categories.cross_section.passed} total={scorecard.categories.cross_section.total} />
          </div>

          {/* Missing sections warning */}
          {scorecard.missingSections && scorecard.missingSections.length > 0 && (
            <div className="flex items-start gap-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800/40 rounded-md p-3">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
              <div className="text-xs text-yellow-800 dark:text-yellow-200">
                <span className="font-medium">Missing sections:</span> {scorecard.missingSections.join(", ")}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground"
            >
              <option value="all">All categories</option>
              <option value="clinical">Clinical</option>
              <option value="editorial">Editorial</option>
              <option value="cross_section">Cross-Section</option>
            </select>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground"
            >
              <option value="all">All severity</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value)}
              className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground"
            >
              <option value="all">All types</option>
              <option value="auto_correct">Auto-correctable</option>
              <option value="clinician_review">Clinician review</option>
            </select>
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredIssues.length} issue{filteredIssues.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Issues list */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-3">
            {filteredIssues.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                {scorecard.issues.length === 0
                  ? "No issues found — excellent report quality!"
                  : "No issues match the current filters."}
              </div>
            ) : (
              filteredIssues.map((issue) => {
                const isAccepted = acceptedIssues.includes(issue.id);
                return (
                  <div
                    key={issue.id}
                    className="border border-border/50 rounded-lg overflow-hidden"
                    style={{ borderLeftWidth: "3px", borderLeftColor: severityBorder(issue.severity) }}
                  >
                    <div className="p-3 space-y-2">
                      {/* Issue header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${severityDot(issue.severity)}`} />
                          <span className="text-xs font-mono font-semibold text-muted-foreground">{issue.criterion}</span>
                          <span className="text-sm font-medium text-foreground">{issue.title}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
                          {issue.section}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground">{issue.description}</p>

                      {/* Flagged text */}
                      {issue.flaggedText && (
                        <div className="text-xs p-2 rounded" style={{ backgroundColor: "hsl(48 96% 89% / 0.5)", border: "1px solid hsl(48 96% 70% / 0.3)" }}>
                          <span className="font-medium text-muted-foreground">Flagged: </span>
                          "{issue.flaggedText}"
                        </div>
                      )}

                      {/* Cross-reference block */}
                      {issue.category === "cross_section" && (issue.crossRefSource || issue.crossRefTarget) && (
                        <div className="grid grid-cols-2 gap-2">
                          {issue.crossRefSource && (
                            <div className="text-xs p-2 rounded bg-muted/30 border border-border/30">
                              <span className="font-medium text-muted-foreground block mb-1">Source section:</span>
                              "{issue.crossRefSource}"
                            </div>
                          )}
                          {issue.crossRefTarget && (
                            <div className="text-xs p-2 rounded bg-muted/30 border border-border/30">
                              <span className="font-medium text-muted-foreground block mb-1">Inconsistent in:</span>
                              "{issue.crossRefTarget}"
                            </div>
                          )}
                        </div>
                      )}

                      {/* Auto-correct suggestion */}
                      {issue.tier === "auto_correct" && issue.suggestedFix && (
                        <div className="space-y-2">
                          <div
                            className="text-xs p-2 rounded"
                            style={{ backgroundColor: "hsl(142 76% 36% / 0.06)", borderLeft: "3px solid hsl(142 76% 36% / 0.4)" }}
                          >
                            <span className="font-medium text-muted-foreground">Suggested: </span>
                            "{issue.suggestedFix}"
                          </div>
                          <div className="flex gap-2">
                            {isAccepted ? (
                              <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                <Check className="h-3 w-3" /> Accepted
                              </span>
                            ) : (
                              <>
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAccept(issue.id)}>
                                  <Check className="h-3 w-3 mr-1" /> Accept
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => onDismiss(issue.id)}>
                                  Dismiss
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Clinician review label */}
                      {issue.tier === "clinician_review" && (
                        <div className="text-xs text-muted-foreground italic flex items-center gap-1.5">
                          <AlertTriangle className="h-3 w-3" />
                          Requires clinician review — no auto-fix available
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Action bar */}
        <div className="border-t border-border/50 p-4 flex items-center justify-between">
          <div className="flex gap-2">
            {pendingAcceptCount > 0 && (
              <Button size="sm" variant="outline" onClick={onAcceptAll}>
                <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
                Accept all auto-corrections ({autoCorrectCount})
              </Button>
            )}
            {acceptedIssues.length > 0 && (
              <Button
                size="sm"
                onClick={onApplyCorrections}
                disabled={isApplying}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {isApplying ? "Applying..." : `Apply ${acceptedIssues.length} correction${acceptedIssues.length !== 1 ? "s" : ""}`}
              </Button>
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
