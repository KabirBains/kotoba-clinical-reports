import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  X, Check, AlertTriangle, ChevronDown, ChevronUp, Eye,
  ShieldCheck, Search, ChevronLeft, ChevronRight, RotateCcw,
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

/**
 * QUALITY SCORECARD (v2 — focused redesign)
 * --------------------------------------------------------------------
 * Replaces the v1 48-criterion / letter-grade UI with a tight panel that
 * surfaces only what the redesigned `review-report` edge function returns:
 *
 *   - Numerical score 0-100 (no letter grades)
 *   - 3-state readiness gate: ready / review_recommended / address_issues
 *   - Issues grouped by category (contradiction, hallucination,
 *     misplacement, missing_essential)
 *   - Per-issue: severity dot, section, flagged text, conflictsWith,
 *     suggested fix
 *
 * Removed entirely:
 *   - Letter grades (A+, B-, etc.)
 *   - Style/grammar/readability filters (those criteria no longer exist)
 *   - Filter dropdowns (4 categories is small enough to render flat)
 *   - missingSections sidebar warning (now part of missing_essential)
 *
 * The parent component is expected to handle:
 *   - Calling the `review-report` edge function and storing the result
 *   - Persisting issueStatuses and dismissedKeys (the v1 db columns can
 *     stay; just the shape of the issue ids is stable across re-checks)
 *   - Rendering inline highlights in the report text using `issue.flaggedText`
 *   - The soft-confirmation pre-export gate (use `getExportConfirmation()`
 *     exported below to derive whether confirmation is needed + what to show)
 */

// ── Types (mirror the edge-function response) ────────────────────

export type IssueCategory =
  | "contradiction"
  | "hallucination"
  | "misplacement"
  | "missing_essential";

export type IssueSeverity = "high" | "medium" | "low";

export type Readiness = "ready" | "review_recommended" | "address_issues";

export interface QualityIssue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  section: string;
  flaggedText: string;
  /** Other-side quote for contradictions, "not in source data" for
   *  hallucinations, "expected location: X" for misplacements, "" for
   *  missing_essential. */
  conflictsWith: string;
  suggestedFix: string | null;
}

export interface Scorecard {
  score: number;
  readiness: Readiness;
  summary: string;
  stats: {
    total: number;
    high: number;
    medium: number;
    low: number;
    byCategory: Record<IssueCategory, number>;
  };
  issues: QualityIssue[];
}

export type IssueStatus = "unresolved" | "accepted" | "dismissed" | "acknowledged";

// ── Helpers ───────────────────────────────────────────────────────

const CATEGORY_META: Record<IssueCategory, { label: string; description: string }> = {
  contradiction: {
    label: "Contradictions",
    description: "Sections of the report that disagree with each other on a specific fact.",
  },
  hallucination: {
    label: "Hallucinations",
    description: "Claims in the report that don't trace back to the clinician's notes, Liaise bank, diagnosis list, or assessments.",
  },
  misplacement: {
    label: "Misplaced content",
    description: "Content that clearly belongs in a different section than where it appears.",
  },
  missing_essential: {
    label: "Missing essentials",
    description: "Required content gaps — Section 34 justifications, BoCs missing from Risk profile, orphaned Liaise evidence, etc.",
  },
};

/** Score-to-colour for the big readiness display. Tied to readiness state,
 *  not score directly, so colour transitions are clinically meaningful. */
function readinessStyle(readiness: Readiness): { bg: string; fg: string; border: string; label: string } {
  switch (readiness) {
    case "ready":
      return {
        bg: "bg-green-50 dark:bg-green-950/20",
        fg: "text-green-700 dark:text-green-400",
        border: "border-green-200 dark:border-green-800/40",
        label: "Ready to export",
      };
    case "review_recommended":
      return {
        bg: "bg-amber-50 dark:bg-amber-950/20",
        fg: "text-amber-700 dark:text-amber-400",
        border: "border-amber-200 dark:border-amber-800/40",
        label: "Review recommended",
      };
    case "address_issues":
      return {
        bg: "bg-red-50 dark:bg-red-950/20",
        fg: "text-red-700 dark:text-red-400",
        border: "border-red-200 dark:border-red-800/40",
        label: "Issues need addressing",
      };
  }
}

function severityDot(severity: IssueSeverity): string {
  if (severity === "high") return "bg-red-600";
  if (severity === "medium") return "bg-amber-500";
  return "bg-muted-foreground/40";
}

function severityBorderColor(severity: IssueSeverity, status: IssueStatus): string {
  if (status === "accepted") return "#16a34a";
  if (status === "acknowledged") return "#2563eb";
  if (status === "dismissed") return "#9ca3af";
  if (severity === "high") return "#dc2626";
  if (severity === "medium") return "#d97706";
  return "#9ca3af";
}

/**
 * Decide whether the soft-confirmation export gate should fire.
 * Returns `{ needsConfirmation: boolean, reason: string, blockingIssues: QualityIssue[] }`.
 * Soft-confirmation policy: any unresolved high-severity issue triggers the modal.
 * Medium and low don't block — they're advisory.
 */
export function getExportConfirmation(
  scorecard: Scorecard | null,
  issueStatuses: Record<string, IssueStatus>,
): { needsConfirmation: boolean; reason: string; blockingIssues: QualityIssue[] } {
  if (!scorecard) return { needsConfirmation: false, reason: "", blockingIssues: [] };
  const blocking = scorecard.issues.filter(
    (iss) => iss.severity === "high" && (issueStatuses[iss.id] ?? "unresolved") === "unresolved"
  );
  if (blocking.length === 0) return { needsConfirmation: false, reason: "", blockingIssues: [] };
  return {
    needsConfirmation: true,
    reason: `${blocking.length} high-severity issue${blocking.length === 1 ? "" : "s"} unresolved`,
    blockingIssues: blocking,
  };
}

// ── Compact summary bar (always visible) ──────────────────────────

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
    (iss) => (issueStatuses[iss.id] ?? "unresolved") === "unresolved"
  ).length;
  const style = readinessStyle(scorecard.readiness);

  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-4 px-4 py-2.5 border border-border/50 rounded-lg bg-card hover:bg-muted/30 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <ShieldCheck className={`h-5 w-5 ${style.fg}`} />
        <div className="flex items-baseline gap-2">
          <span className={`text-xl font-bold tabular-nums ${style.fg}`}>{scorecard.score}</span>
          <span className="text-xs text-muted-foreground">/100</span>
        </div>
        <span className={`text-sm font-medium ${style.fg}`}>{style.label}</span>
      </div>
      <div className="flex items-center gap-3">
        {unresolvedCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {unresolvedCount} issue{unresolvedCount !== 1 ? "s" : ""} unresolved
          </span>
        )}
        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </div>
    </button>
  );
}

// ── Main scorecard panel ──────────────────────────────────────────

interface QualityScorecardProps {
  scorecard: Scorecard;
  issueStatuses: Record<string, IssueStatus>;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onAcknowledge: (id: string) => void;
  onApplyAcceptedFixes: () => void;
  onClose: () => void;
  onRecheck: () => void;
  onClearAndRecheck: () => void;
  onFindInReport: (issue: QualityIssue) => void;
  isApplying: boolean;
  isRechecking: boolean;
}

export function QualityScorecard({
  scorecard,
  issueStatuses,
  onAccept,
  onDismiss,
  onAcknowledge,
  onApplyAcceptedFixes,
  onClose,
  onRecheck,
  onClearAndRecheck,
  onFindInReport,
  isApplying,
  isRechecking,
}: QualityScorecardProps) {
  const style = readinessStyle(scorecard.readiness);

  const acceptedCount = scorecard.issues.filter((i) => issueStatuses[i.id] === "accepted").length;
  const dismissedCount = scorecard.issues.filter((i) => issueStatuses[i.id] === "dismissed").length;
  const acknowledgedCount = scorecard.issues.filter((i) => issueStatuses[i.id] === "acknowledged").length;
  const addressedCount = acceptedCount + dismissedCount + acknowledgedCount;
  const totalIssues = scorecard.stats.total;
  const allAddressed = totalIssues === 0 || addressedCount === totalIssues;

  // Group issues by category, preserving the order from CATEGORY_META.
  const groupedIssues = useMemo(() => {
    const groups: Record<IssueCategory, QualityIssue[]> = {
      contradiction: [],
      hallucination: [],
      misplacement: [],
      missing_essential: [],
    };
    for (const iss of scorecard.issues) {
      groups[iss.category].push(iss);
    }
    return groups;
  }, [scorecard.issues]);

  // Unresolved-issue navigation (the "next/prev" arrows scroll through
  // unresolved findings only — addressed ones are skipped).
  const unresolvedIssues = useMemo(
    () => scorecard.issues.filter((i) => (issueStatuses[i.id] ?? "unresolved") === "unresolved"),
    [scorecard.issues, issueStatuses],
  );
  const [navIndex, setNavIndex] = useState(0);
  const navigateIssue = useCallback(
    (dir: 1 | -1) => {
      if (unresolvedIssues.length === 0) return;
      const next = (navIndex + dir + unresolvedIssues.length) % unresolvedIssues.length;
      setNavIndex(next);
      onFindInReport(unresolvedIssues[next]);
    },
    [unresolvedIssues, navIndex, onFindInReport],
  );

  return (
    <div
      className="border border-border/50 rounded-lg bg-background shadow-sm"
      style={{ maxHeight: "80vh", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div className="p-5 border-b border-border/50 space-y-3 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h2 className="text-base font-semibold text-foreground mb-2">Report Quality Check</h2>

            {/* Big score + readiness banner */}
            <div className={`flex items-center gap-4 rounded-md p-3 ${style.bg} border ${style.border}`}>
              <div className="flex items-baseline gap-1 shrink-0">
                <span className={`text-3xl font-bold tabular-nums ${style.fg}`}>{scorecard.score}</span>
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold ${style.fg}`}>{style.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{scorecard.summary}</div>
              </div>
            </div>

            {/* Counts row — only shown when there are issues */}
            {totalIssues > 0 && (
              <div className="flex flex-wrap gap-3 mt-3 text-xs">
                <span className="text-red-700 dark:text-red-400 font-medium">{scorecard.stats.high} high</span>
                <span className="text-amber-700 dark:text-amber-400 font-medium">{scorecard.stats.medium} medium</span>
                {scorecard.stats.low > 0 && (
                  <span className="text-muted-foreground">{scorecard.stats.low} low</span>
                )}
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  {addressedCount}/{totalIssues} addressed
                </span>
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Issue navigation bar (only when there's something to navigate) */}
        {unresolvedIssues.length > 0 && (
          <div className="flex items-center gap-2 bg-muted/30 rounded-md px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground flex-1">
              Navigate unresolved issues
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

        {/* Progress bar */}
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
          </div>
        )}
      </div>

      {/* Issues list — grouped by category */}
      <ScrollArea className="flex-1 min-h-0" style={{ overflowY: "auto" }}>
        <div className="p-4 space-y-5">
          {totalIssues === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No factual or structural issues detected. Report appears ready.
            </div>
          ) : (
            (Object.keys(CATEGORY_META) as IssueCategory[]).map((cat) => {
              const issues = groupedIssues[cat];
              if (issues.length === 0) return null;
              const meta = CATEGORY_META[cat];
              return (
                <div key={cat} className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-semibold text-foreground">{meta.label}</h3>
                    <span className="text-xs text-muted-foreground">{issues.length}</span>
                  </div>
                  <p className="text-xs text-muted-foreground/80">{meta.description}</p>
                  <div className="space-y-2 pt-1">
                    {issues.map((issue) => (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        status={issueStatuses[issue.id] ?? "unresolved"}
                        onAccept={onAccept}
                        onDismiss={onDismiss}
                        onAcknowledge={onAcknowledge}
                        onFindInReport={onFindInReport}
                      />
                    ))}
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
          {acceptedCount > 0 && (
            <Button
              size="sm"
              onClick={onApplyAcceptedFixes}
              disabled={isApplying}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isApplying
                ? "Applying…"
                : `Apply ${acceptedCount} fix${acceptedCount !== 1 ? "es" : ""}`}
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
            {isRechecking ? "Checking…" : "Re-check"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-xs text-muted-foreground">
                <RotateCcw className="h-3 w-3 mr-1" /> Clear & re-check
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear quality check results?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will clear your current quality-check results and run a fresh analysis. Any unresolved issues will be lost.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onClearAndRecheck}>Clear & re-check</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

// ── Per-issue card ────────────────────────────────────────────────

function IssueCard({
  issue,
  status,
  onAccept,
  onDismiss,
  onAcknowledge,
  onFindInReport,
}: {
  issue: QualityIssue;
  status: IssueStatus;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onAcknowledge: (id: string) => void;
  onFindInReport: (issue: QualityIssue) => void;
}) {
  const isDone = status !== "unresolved";
  const hasFix = issue.suggestedFix !== null && issue.suggestedFix.trim().length > 0;

  return (
    <div
      className={`border border-border/50 rounded-md overflow-hidden transition-opacity ${isDone ? "opacity-70" : ""}`}
      style={{ borderLeftWidth: "3px", borderLeftColor: severityBorderColor(issue.severity, status) }}
    >
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {isDone && status === "accepted" && <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />}
            {isDone && status === "acknowledged" && <Eye className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
            <div className={`w-2 h-2 rounded-full shrink-0 ${isDone ? "bg-muted-foreground/20" : severityDot(issue.severity)}`} />
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
            <span className="italic">"{issue.flaggedText}"</span>
          </div>
        )}

        {issue.conflictsWith && issue.conflictsWith.trim().length > 0 && (
          <div className="text-xs p-2 rounded bg-muted/30 border border-border/30">
            <span className="font-medium text-muted-foreground">Conflicts with: </span>
            <span className="italic">{issue.conflictsWith.startsWith("expected") || issue.conflictsWith.startsWith("not in") ? issue.conflictsWith : `"${issue.conflictsWith}"`}</span>
          </div>
        )}

        {hasFix && !isDone && (
          <div className="text-xs p-2 rounded" style={{ backgroundColor: "hsl(142 76% 36% / 0.06)", borderLeft: "3px solid hsl(142 76% 36% / 0.4)" }}>
            <span className="font-medium text-muted-foreground">Suggested fix: </span>
            <span className="italic">"{issue.suggestedFix}"</span>
          </div>
        )}

        {!isDone && (
          <div className="flex flex-wrap gap-2 pt-1">
            {issue.flaggedText && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onFindInReport(issue)}>
                <Search className="h-3 w-3 mr-1" /> Find in report
              </Button>
            )}
            {hasFix ? (
              <>
                <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => onAccept(issue.id)}>
                  <Check className="h-3 w-3 mr-1" /> Accept fix
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
            {status === "accepted" && (
              <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                <Check className="h-3 w-3" /> Fix accepted
              </span>
            )}
            {status === "acknowledged" && (
              <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <Eye className="h-3 w-3" /> Reviewed by clinician
              </span>
            )}
            {status === "dismissed" && (
              <span className="text-muted-foreground">Dismissed</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Soft-confirmation dialog for pre-export ───────────────────────

/**
 * Soft-confirmation dialog. Shown when the clinician initiates a report
 * export (e.g. .docx download) and there are unresolved high-severity issues.
 * The clinician retains authority — they can confirm and proceed — but
 * the modal creates a deliberate friction moment to surface unresolved
 * factual issues before the report leaves the system.
 *
 * Use `getExportConfirmation(scorecard, issueStatuses)` to determine
 * whether to render this dialog (returns `needsConfirmation: false`
 * when score is already at "ready" or "review_recommended" with no
 * unresolved high-severity issues).
 */
export function ExportConfirmDialog({
  open,
  onOpenChange,
  blockingIssues,
  reason,
  onConfirm,
  onAddressIssues,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockingIssues: QualityIssue[];
  reason: string;
  /** Called when the clinician chooses to proceed with export anyway. */
  onConfirm: () => void;
  /** Called when the clinician chooses to address the issues first. */
  onAddressIssues: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Export with unresolved issues?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {reason}. You can still export, but consider addressing the high-severity issues first to ensure factual accuracy.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {blockingIssues.length > 0 && (
          <div className="my-2 max-h-48 overflow-y-auto space-y-1.5 rounded border border-border/50 p-2 bg-muted/20">
            {blockingIssues.map((iss) => (
              <div key={iss.id} className="text-xs flex items-start gap-2">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${severityDot(iss.severity)}`} />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-foreground">{iss.title}</span>
                  <span className="text-muted-foreground"> · {iss.section}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onAddressIssues}>Address issues first</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Export anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
