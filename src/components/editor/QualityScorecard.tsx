import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  X, Check, CheckCheck, AlertTriangle, Filter,
  ChevronDown, ChevronUp, Eye, ShieldCheck,
  Search, ChevronLeft, ChevronRight, RotateCcw,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  score: number | null;
  grade: string | null;
  summary: string;
  totalIssues?: number;
  autoCorrectableCount?: number;
  clinicianReviewCount?: number;
  categories: {
    clinical: { passed: number; total: number; failed?: number };
    editorial: { passed: number; total: number; failed?: number };
    cross_section: { passed: number; total: number; failed?: number };
  } | null;
  categoryCounts?: {
    clinical?: { passed: number; failed: number; total: number };
    editorial?: { passed: number; failed: number; total: number };
    cross_section?: { passed: number; failed: number; total: number };
  };
  missingSections: string[];
  issues: QualityIssue[];
}

export type IssueStatus = "unresolved" | "accepted" | "dismissed" | "acknowledged";

interface QualityScorecardProps {
  scorecard: Scorecard;
  issueStatuses: Record<string, IssueStatus>;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onAcknowledge: (id: string) => void;
  onAcceptAll: () => void;
  onApplyCorrections: () => void;
  onClose: () => void;
  onRecheck: () => void;
  onClearAndRecheck: () => void;
  onFindInReport: (issue: QualityIssue) => void;
  isApplying: boolean;
  isRechecking: boolean;
}

function severityBorder(severity: string): string {
  if (severity === "high") return "#dc2626";
  if (severity === "medium") return "#d97706";
  return "#9ca3af";
}

function statusBorder(status: IssueStatus, severity: string): string {
  if (status === "accepted") return "#16a34a";
  if (status === "acknowledged") return "#2563eb";
  if (status === "dismissed") return "#9ca3af";
  return severityBorder(severity);
}

function severityDot(severity: string): string {
  if (severity === "high") return "bg-destructive";
  if (severity === "medium") return "bg-yellow-500";
  return "bg-muted-foreground/40";
}

function isNoIssuesSummary(summary: string): boolean {
  return summary?.toLowerCase().includes("no issues") || false;
}

/* ── Persistent summary bar (always visible when scorecard exists) ── */
export function QualitySummaryBar({
  scorecard,
  issueStatuses,
  isExpanded,
  onToggle,
}: {
  scorecard: Scorecard;
  issueStatuses: Record<string, IssueStatus>;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const unresolvedCount = scorecard.issues.filter(
    i => !issueStatuses[i.id] || issueStatuses[i.id] === "unresolved"
  ).length;
  const noIssues = isNoIssuesSummary(scorecard.summary) || scorecard.issues.length === 0;

  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-2 border border-border/50 rounded-lg bg-card hover:bg-muted/30 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <ShieldCheck className={`h-4 w-4 ${noIssues ? "text-green-600" : "text-amber-600"}`} />
        <span className="text-sm font-medium text-foreground">
          {noIssues ? (
            <span className="text-green-600 dark:text-green-400">No issues found</span>
          ) : (
            <>
              <span className="text-amber-600 dark:text-amber-400">{unresolvedCount} issue{unresolvedCount !== 1 ? "s" : ""} remaining</span>
            </>
          )}
        </span>
      </div>
      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
    </button>
  );
}

/* ── Main scorecard panel (inline, not modal) ── */
export function QualityScorecard({
  scorecard,
  issueStatuses,
  onAccept,
  onDismiss,
  onAcknowledge,
  onAcceptAll,
  onApplyCorrections,
  onClose,
  onRecheck,
  onClearAndRecheck,
  onFindInReport,
  isApplying,
  isRechecking,
}: QualityScorecardProps) {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterTier, setFilterTier] = useState<string>("all");

  const acceptedCount = scorecard.issues.filter(i => issueStatuses[i.id] === "accepted").length;
  const dismissedCount = scorecard.issues.filter(i => issueStatuses[i.id] === "dismissed").length;
  const acknowledgedCount = scorecard.issues.filter(i => issueStatuses[i.id] === "acknowledged").length;
  const addressedCount = acceptedCount + dismissedCount + acknowledgedCount;
  const totalIssues = scorecard.totalIssues ?? scorecard.issues.length;
  const allAddressed = totalIssues === 0 || addressedCount === totalIssues;
  const noIssues = isNoIssuesSummary(scorecard.summary) || scorecard.issues.length === 0;

  const autoFixable = scorecard.autoCorrectableCount ?? scorecard.issues.filter(i => i.tier === "auto_correct").length;
  const clinicianReview = scorecard.clinicianReviewCount ?? scorecard.issues.filter(i => i.tier === "clinician_review").length;

  const pendingAutoCorrect = scorecard.issues.filter(
    i => i.tier === "auto_correct" && (!issueStatuses[i.id] || issueStatuses[i.id] === "unresolved")
  ).length;

  const filteredIssues = useMemo(() => {
    return scorecard.issues.filter(i => {
      if (filterCategory !== "all" && i.category !== filterCategory) return false;
      if (filterSeverity !== "all" && i.severity !== filterSeverity) return false;
      if (filterTier !== "all" && i.tier !== filterTier) return false;
      return true;
    });
  }, [scorecard.issues, filterCategory, filterSeverity, filterTier]);

  const unresolvedIssues = useMemo(() =>
    scorecard.issues.filter(i => !issueStatuses[i.id] || issueStatuses[i.id] === "unresolved"),
    [scorecard.issues, issueStatuses]
  );
  const [navIndex, setNavIndex] = useState(0);

  const navigateIssue = useCallback((dir: 1 | -1) => {
    if (unresolvedIssues.length === 0) return;
    const next = (navIndex + dir + unresolvedIssues.length) % unresolvedIssues.length;
    setNavIndex(next);
    onFindInReport(unresolvedIssues[next]);
  }, [unresolvedIssues, navIndex, onFindInReport]);

  // Get category data from either new categoryCounts or legacy categories
  const catData = scorecard.categoryCounts || scorecard.categories;

  return (
    <div className="border border-border/50 rounded-lg bg-background shadow-sm" style={{ maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div className="p-6 border-b border-border/50 space-y-4 shrink-0">
        {/* Summary banner */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h2 className="text-base font-semibold text-foreground mb-2">Report Quality Check</h2>
            <div className={`flex items-start gap-2 rounded-md p-3 ${
              noIssues
                ? "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/40"
                : "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40"
            }`}>
              {noIssues ? (
                <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              )}
              <span className={`text-sm ${noIssues ? "text-green-800 dark:text-green-200" : "text-amber-800 dark:text-amber-200"}`}>
                {scorecard.summary}
              </span>
            </div>

            {/* Simple counts */}
            {!noIssues && (
              <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                <span>{totalIssues} total issue{totalIssues !== 1 ? "s" : ""}</span>
                <span className="text-green-600 dark:text-green-400">{autoFixable} auto-correctable</span>
                <span className="text-amber-600 dark:text-amber-400">{clinicianReview} need review</span>
                {dismissedCount > 0 && <span>{dismissedCount} dismissed</span>}
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
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

        {/* Issue navigation bar */}
        {unresolvedIssues.length > 0 && (
          <div className="flex items-center gap-2 bg-muted/30 rounded-md px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground flex-1">
              Navigate unresolved issues ({unresolvedIssues.length} remaining)
            </span>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => navigateIssue(-1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground font-mono">
              {unresolvedIssues.length > 0 ? navIndex + 1 : 0}/{unresolvedIssues.length}
            </span>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => navigateIssue(1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Progress + filters row */}
        <div className="space-y-2">
          {totalIssues > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(addressedCount / totalIssues) * 100}%`,
                    backgroundColor: allAddressed ? "hsl(142 76% 36%)" : "hsl(217 91% 60%)",
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {addressedCount} of {totalIssues} issues addressed
              </span>
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground">
              <option value="all">All categories</option>
              <option value="clinical">Clinical</option>
              <option value="editorial">Editorial</option>
              <option value="cross_section">Cross-Section</option>
            </select>
            <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground">
              <option value="all">All severity</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)} className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground">
              <option value="all">All types</option>
              <option value="auto_correct">Auto-correctable</option>
              <option value="clinician_review">Clinician review</option>
            </select>
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredIssues.length} issue{filteredIssues.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Issues list — scrollable */}
      <ScrollArea className="flex-1 min-h-0" style={{ overflowY: "auto" }}>
        <div className="p-4 space-y-3">
          {filteredIssues.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {scorecard.issues.length === 0
                ? "No issues found — excellent report quality!"
                : "No issues match the current filters."}
            </div>
          ) : (
            filteredIssues.map((issue) => {
              const status = issueStatuses[issue.id] || "unresolved";
              const isDone = status !== "unresolved";

              return (
                <div
                  key={issue.id}
                  className={`border border-border/50 rounded-lg overflow-hidden transition-opacity ${isDone ? "opacity-70" : ""}`}
                  style={{ borderLeftWidth: "3px", borderLeftColor: statusBorder(status, issue.severity) }}
                >
                  <div className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isDone && status === "accepted" && <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                        {isDone && status === "acknowledged" && <Eye className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
                        <div className={`w-2 h-2 rounded-full shrink-0 ${isDone ? "bg-muted-foreground/20" : severityDot(issue.severity)}`} />
                        <span className="text-xs font-mono font-semibold text-muted-foreground">{issue.criterion}</span>
                        <span className={`text-sm font-medium ${isDone && status === "dismissed" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {issue.title}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
                        {issue.section}
                      </span>
                    </div>

                    <p className={`text-xs ${isDone && status === "dismissed" ? "line-through text-muted-foreground/60" : "text-muted-foreground"}`}>
                      {issue.description}
                    </p>

                    {issue.flaggedText && (
                      <div className="text-xs p-2 rounded" style={{ backgroundColor: "hsl(48 96% 89% / 0.5)", border: "1px solid hsl(48 96% 70% / 0.3)" }}>
                        <span className="font-medium text-muted-foreground">Flagged: </span>
                        "{issue.flaggedText}"
                      </div>
                    )}

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

                    {issue.tier === "auto_correct" && issue.suggestedFix && !isDone && (
                      <div className="space-y-2">
                        <div className="text-xs p-2 rounded" style={{ backgroundColor: "hsl(142 76% 36% / 0.06)", borderLeft: "3px solid hsl(142 76% 36% / 0.4)" }}>
                          <span className="font-medium text-muted-foreground">Suggested: </span>
                          "{issue.suggestedFix}"
                        </div>
                      </div>
                    )}

                    {!isDone && (
                      <div className="flex gap-2 pt-1">
                        {issue.flaggedText && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onFindInReport(issue)}>
                            <Search className="h-3 w-3 mr-1" /> Find in Report
                          </Button>
                        )}
                        {issue.tier === "auto_correct" ? (
                          <>
                            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => onAccept(issue.id)}>
                              <Check className="h-3 w-3 mr-1" /> Accept Fix
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => onDismiss(issue.id)}>
                              Dismiss
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={() => onAcknowledge(issue.id)}>
                              <Eye className="h-3 w-3 mr-1" /> Acknowledged
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => onDismiss(issue.id)}>
                              Dismiss
                            </Button>
                          </>
                        )}
                      </div>
                    )}

                    {isDone && (
                      <div className="text-xs pt-1">
                        {status === "accepted" && <span className="text-green-600 dark:text-green-400 flex items-center gap-1"><Check className="h-3 w-3" /> Fix accepted</span>}
                        {status === "acknowledged" && <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1"><Eye className="h-3 w-3" /> Reviewed by clinician</span>}
                        {status === "dismissed" && <span className="text-muted-foreground flex items-center gap-1">Dismissed</span>}
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
      <div className="border-t border-border/50 p-4 flex items-center justify-between shrink-0">
        <div className="flex gap-2">
          {pendingAutoCorrect > 0 && (
            <Button size="sm" variant="outline" onClick={onAcceptAll}>
              <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
              Accept all auto-corrections ({pendingAutoCorrect})
            </Button>
          )}
          {acceptedCount > 0 && (
            <Button
              size="sm"
              onClick={onApplyCorrections}
              disabled={isApplying}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isApplying ? "Applying..." : `Apply ${acceptedCount} correction${acceptedCount !== 1 ? "s" : ""}`}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onRecheck}
            disabled={!allAddressed || isRechecking}
            title={!allAddressed ? "Address all issues before re-checking" : ""}
          >
            {isRechecking ? "Checking…" : "Re-check Quality"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-xs text-muted-foreground">
                <RotateCcw className="h-3 w-3 mr-1" /> Clear & Re-check
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear quality check results?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will clear your current quality check results and run a fresh analysis. Any unresolved issues will be lost.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onClearAndRecheck}>Clear & Re-check</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
