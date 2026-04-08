import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { AssessmentScoreSummary } from "@/lib/assessment-library";

const DOMAINS = [
  {
    id: "cognition",
    name: "Domain 1 — Cognition",
    subtitle: "Understanding & Communicating",
    items: [
      { num: 1, text: "Concentrating on doing something for ten minutes?" },
      { num: 2, text: "Remembering to do important things?" },
      { num: 3, text: "Analysing and finding solutions to problems in day-to-day life?" },
      { num: 4, text: "Learning a new task, for example, learning how to get to a new place?" },
      { num: 5, text: "Generally understanding what people say?" },
      { num: 6, text: "Starting and maintaining a conversation?" },
    ],
  },
  {
    id: "mobility",
    name: "Domain 2 — Mobility",
    subtitle: "Getting Around",
    items: [
      { num: 7, text: "Standing for long periods such as 30 minutes?" },
      { num: 8, text: "Standing up from sitting down?" },
      { num: 9, text: "Moving around inside your home?" },
      { num: 10, text: "Getting out of your home?" },
      { num: 11, text: "Walking a long distance such as a kilometre (or equivalent)?" },
    ],
  },
  {
    id: "selfcare",
    name: "Domain 3 — Self-Care",
    subtitle: "",
    items: [
      { num: 12, text: "Washing your whole body?" },
      { num: 13, text: "Getting dressed?" },
      { num: 14, text: "Eating?" },
    ],
  },
  {
    id: "getting_along",
    name: "Domain 4 — Getting Along",
    subtitle: "Getting Along with People",
    items: [
      { num: 15, text: "Staying by yourself for a few days?" },
      { num: 16, text: "Dealing with people you do not know?" },
      { num: 17, text: "Maintaining a friendship?" },
      { num: 18, text: "Getting along with people who are close to you?" },
      { num: 19, text: "Making new friends?" },
      { num: 20, text: "Sexual activities?" },
    ],
  },
  {
    id: "life_household",
    name: "Domain 5a — Life Activities (Household)",
    subtitle: "Household Activities",
    items: [
      { num: 21, text: "Taking care of your household responsibilities?" },
      { num: 22, text: "Doing most important household tasks well?" },
      { num: 23, text: "Getting all the household work done that you needed to do?" },
      { num: 24, text: "Getting your household work done as quickly as needed?" },
    ],
  },
  {
    id: "life_work",
    name: "Domain 5b — Life Activities (Work/School)",
    subtitle: "Optional — Complete only if participant works or attends school",
    optional: true,
    items: [
      { num: 25, text: "Your day-to-day work/school?" },
      { num: 26, text: "Doing your most important work/school tasks well?" },
      { num: 27, text: "Getting all the work done that you need to do?" },
      { num: 28, text: "Getting your work done as quickly as needed?" },
    ],
  },
  {
    id: "participation",
    name: "Domain 6 — Participation",
    subtitle: "Participation in Society",
    items: [
      { num: 29, text: "Joining in community activities (e.g. festivities, religious or other activities) in the same way as anyone else?" },
      { num: 30, text: "Problems because of barriers or hindrances in the world around you?" },
      { num: 31, text: "Problems living with dignity because of the attitudes and actions of others?" },
      { num: 32, text: "Time spent on your health condition, or its consequences?" },
      { num: 33, text: "Being emotionally affected by your health condition?" },
      { num: 34, text: "Health condition being a drain on financial resources of you or your family?" },
      { num: 35, text: "Problems your family had because of your health problems?" },
      { num: 36, text: "Problems doing things by yourself for relaxation or pleasure?" },
    ],
  },
];

const SCORE_OPTIONS = [
  { value: 0, label: "None" },
  { value: 1, label: "Mild" },
  { value: 2, label: "Moderate" },
  { value: 3, label: "Severe" },
  { value: 4, label: "Extreme" },
];

function getDisabilityLevel(percent: number) {
  if (percent <= 4) return { level: "None", variant: "success" as const };
  if (percent <= 24) return { level: "Mild", variant: "lime" as const };
  if (percent <= 49) return { level: "Moderate", variant: "warning" as const };
  if (percent <= 95) return { level: "Severe", variant: "destructive" as const };
  return { level: "Extreme", variant: "extreme" as const };
}

const levelColors: Record<string, string> = {
  success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  lime: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  destructive: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  extreme: "bg-red-200 text-red-900 dark:bg-red-950/50 dark:text-red-300",
};

const scoreButtonStyles: Record<number, { base: string; active: string }> = {
  0: { base: "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800", active: "bg-green-600 border-green-600 text-white" },
  1: { base: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800", active: "bg-yellow-600 border-yellow-600 text-white" },
  2: { base: "bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800", active: "bg-orange-600 border-orange-600 text-white" },
  3: { base: "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800", active: "bg-red-600 border-red-600 text-white" },
  4: { base: "bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800", active: "bg-purple-600 border-purple-600 text-white" },
};

// ─── EXPORTED SCORING DATA ──────────────────────────────────────
// Single source of truth for WHODAS 2.0 domain definitions and scoring.
// Consumed by ReportMode.tsx for rendering and by the assessment-scoring
// dispatcher for the AI generation prompt.

export const WHODAS_DOMAIN_DEFS = DOMAINS.map((d) => ({
  id: d.id,
  name: d.name.replace(/^Domain \d+[a-z]? — /, ""),
  fullName: d.name,
  items: d.items.map((i) => i.num),
  optional: !!(d as { optional?: boolean }).optional,
}));

/**
 * Read a single WHODAS item score from the scores object. Tolerates legacy
 * key formats so historical data still scores correctly.
 */
export function readWhodasItemScore(scores: Record<string, string>, itemNum: number): number | null {
  const candidates = [
    scores[`whodas-${itemNum}`],
    scores[`whodas_${itemNum}`], // legacy underscore format
    scores[String(itemNum)],
    scores[`item_${itemNum}`],
    scores[`q${itemNum}`],
  ];
  for (const v of candidates) {
    if (v === undefined || v === null || v === "") continue;
    // Numeric string ("0" through "4")
    const n = Number(v);
    if (!isNaN(n)) return n;
    // Text label fallback ("None", "Mild", etc.)
    const labelMap: Record<string, number> = {
      "None": 0, "Mild": 1, "Moderate": 2, "Severe": 3, "Extreme / Cannot do": 4, "Extreme": 4,
    };
    if (v in labelMap) return labelMap[v];
  }
  return null;
}

function whodasClassification(percent: number): string {
  if (percent <= 4) return "No disability";
  if (percent <= 24) return "Mild disability";
  if (percent <= 49) return "Moderate disability";
  if (percent <= 95) return "Severe disability";
  return "Extreme disability";
}

/**
 * Compute the per-domain breakdown for WHODAS 2.0. Returns one row per
 * domain that has at least one answered item, plus aggregate totals.
 * Used by both ReportMode rendering and the AI prompt builder.
 */
export function getWhodasDomainBreakdown(scores: Record<string, string>): {
  rows: { id: string; name: string; raw: number; max: number; percent: number; classification: string; assessed: boolean }[];
  grandTotal: number;
  maxPossible: number;
  overallPct: number | null;
  overallClassification: string;
} {
  const rows = WHODAS_DOMAIN_DEFS.map((d) => {
    let sum = 0;
    let answered = 0;
    for (const itemNum of d.items) {
      const v = readWhodasItemScore(scores, itemNum);
      if (v !== null) { sum += v; answered++; }
    }
    const max = d.items.length * 4;
    const assessed = answered > 0;
    const percent = assessed ? Math.round((sum / max) * 100) : 0;
    return {
      id: d.id,
      name: d.name,
      raw: sum,
      max,
      percent,
      classification: assessed ? whodasClassification(percent) : "Not assessed",
      assessed,
    };
  });
  const assessedRows = rows.filter((r) => r.assessed);
  const grandTotal = assessedRows.reduce((s, r) => s + r.raw, 0);
  const maxPossible = assessedRows.reduce((s, r) => s + r.max, 0);
  const overallPct = maxPossible > 0 ? Math.round((grandTotal / maxPossible) * 100) : null;
  const overallClassification = overallPct !== null ? whodasClassification(overallPct) : "";
  return { rows, grandTotal, maxPossible, overallPct, overallClassification };
}

/**
 * Unified score summary for the AI prompt builder and report assembler.
 * Consumed by the dispatcher in src/lib/assessment-scoring.ts.
 */
export function getWhodasScoreSummary(scores: Record<string, string>): AssessmentScoreSummary {
  const breakdown = getWhodasDomainBreakdown(scores);
  const itemsTotal = WHODAS_DOMAIN_DEFS.reduce((s, d) => s + d.items.length, 0);
  // Items 25-28 are optional (work/school) — only count toward total if any answered
  const workItems = [25, 26, 27, 28];
  const workAnswered = workItems.some((n) => readWhodasItemScore(scores, n) !== null);
  const effectiveItemsTotal = workAnswered ? itemsTotal : itemsTotal - workItems.length;
  let itemsAnswered = 0;
  for (let n = 1; n <= itemsTotal; n++) {
    if (readWhodasItemScore(scores, n) !== null) itemsAnswered++;
  }
  const isComplete = itemsAnswered >= effectiveItemsTotal;

  const rows = breakdown.rows
    .filter((r) => r.assessed)
    .map((r) => ({ label: r.name, value: `${r.raw}/${r.max} (${r.percent}%)` }));

  const total = breakdown.maxPossible > 0
    ? `${breakdown.grandTotal}/${breakdown.maxPossible} (${breakdown.overallPct}%)`
    : "";

  return {
    rows,
    total,
    classification: breakdown.overallClassification,
    isComplete,
    itemsAnswered,
    itemsTotal: effectiveItemsTotal,
    scoringDirection: "WHODAS 2.0: HIGHER scores = WORSE disability. 0% = no disability, 100% = extreme disability across all assessed domains.",
  };
}

interface WHODASScoringProps {
  scores: Record<string, string>;
  onUpdateScores: (scores: Record<string, string>) => void;
}

export function WHODASScoring({ scores, onUpdateScores }: WHODASScoringProps) {
  const [workEnabled, setWorkEnabled] = useState(() => {
    return [25, 26, 27, 28].some(n => scores[`whodas-${n}`] !== undefined);
  });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const getScore = (num: number): number | undefined => {
    const val = scores[`whodas-${num}`];
    return val !== undefined ? parseInt(val, 10) : undefined;
  };

  const setScore = (num: number, value: number) => {
    onUpdateScores({ ...scores, [`whodas-${num}`]: String(value) });
  };

  const supplementary = {
    q37: scores["whodas-q37"] || "",
    q38: scores["whodas-q38"] || "",
    q39: scores["whodas-q39"] || "",
  };

  const setSupplementary = (key: string, val: string) => {
    onUpdateScores({ ...scores, [`whodas-${key}`]: val });
  };

  const domainResults = useMemo(() => {
    return DOMAINS.map((domain) => {
      if (domain.optional && !workEnabled) {
        return { ...domain, sum: null as number | null, max: null as number | null, percent: null as number | null, answered: 0, total: domain.items.length, level: null as ReturnType<typeof getDisabilityLevel> | null };
      }
      const answered = domain.items.filter(i => getScore(i.num) !== undefined);
      const sum = answered.reduce((acc, i) => acc + (getScore(i.num) || 0), 0);
      const max = domain.items.length * 4;
      const percent = answered.length > 0 ? (sum / max) * 100 : null;
      const level = percent !== null ? getDisabilityLevel(percent) : null;
      return { ...domain, sum, max, percent, answered: answered.length, total: domain.items.length, level };
    });
  }, [scores, workEnabled]);

  const totalResult = useMemo(() => {
    const active = domainResults.filter(d => d.percent !== null);
    if (active.length === 0) return null;
    const totalSum = active.reduce((acc, d) => acc + (d.sum || 0), 0);
    const totalMax = active.reduce((acc, d) => acc + (d.max || 0), 0);
    const percent = (totalSum / totalMax) * 100;
    return { sum: totalSum, max: totalMax, percent, level: getDisabilityLevel(percent) };
  }, [domainResults]);

  const answeredCount = DOMAINS.reduce((acc, d) => {
    if (d.optional && !workEnabled) return acc;
    return acc + d.items.filter(i => getScore(i.num) !== undefined).length;
  }, 0);
  const totalQuestions = workEnabled ? 36 : 32;

  const clearAll = () => {
    const next = { ...scores };
    for (let i = 1; i <= 36; i++) delete next[`whodas-${i}`];
    delete next["whodas-q37"];
    delete next["whodas-q38"];
    delete next["whodas-q39"];
    onUpdateScores(next);
  };

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border-b-2 border-foreground pb-3">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h3 className="text-lg font-bold text-foreground tracking-tight">WHODAS 2.0</h3>
          <span className="text-xs text-muted-foreground font-medium">36-Item Self-Report — Simple Scoring</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
          World Health Organisation Disability Assessment Schedule. Rate each item based on difficulty experienced in the past 30 days.
        </p>
      </div>

      {/* Progress + Controls */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-foreground">
            {answeredCount}/{totalQuestions} items scored
          </span>
          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <label className="text-[11px] flex items-center gap-1.5 cursor-pointer text-muted-foreground">
            <input
              type="checkbox"
              checked={workEnabled}
              onChange={(e) => {
                setWorkEnabled(e.target.checked);
                if (!e.target.checked) {
                  const next = { ...scores };
                  [25, 26, 27, 28].forEach(n => delete next[`whodas-${n}`]);
                  onUpdateScores(next);
                }
              }}
              className="accent-accent"
            />
            Include Work/School
          </label>
          <button
            onClick={clearAll}
            className="text-[11px] px-2.5 py-1 rounded-md border border-border bg-background text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-[11px] text-muted-foreground flex-wrap">
        {SCORE_OPTIONS.map(s => (
          <span key={s.value} className="flex items-center gap-1">
            <span className="font-mono font-semibold text-foreground/60">{s.value}</span> = {s.label}
          </span>
        ))}
      </div>

      {/* Domains */}
      {DOMAINS.map((domain) => {
        const result = domainResults.find(d => d.id === domain.id)!;
        const isSkipped = domain.optional && !workEnabled;
        const isCollapsed = collapsed[domain.id];

        return (
          <div
            key={domain.id}
            className={cn(
              "border border-border/50 rounded-lg overflow-hidden transition-opacity",
              isSkipped && "opacity-40"
            )}
          >
            {/* Domain header */}
            <button
              onClick={() => !isSkipped && toggleCollapse(domain.id)}
              disabled={isSkipped}
              className={cn(
                "w-full flex items-center justify-between px-4 py-2.5 text-left select-none transition-colors",
                !isSkipped && "hover:bg-muted/30 cursor-pointer",
                !isCollapsed && !isSkipped && "border-b border-border/30"
              )}
            >
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 rounded-sm bg-accent" />
                  <span className="text-[13px] font-bold text-foreground">{domain.name}</span>
                  {domain.subtitle && <span className="text-[11px] text-muted-foreground">{domain.subtitle}</span>}
                </div>
                {isSkipped && (
                  <span className="text-[11px] text-muted-foreground ml-3">Enable "Include Work/School" to score</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {result.percent !== null && (
                  <>
                    <div className="text-right">
                      <span className="font-mono text-sm font-bold text-accent">
                        {result.percent.toFixed(1)}%
                      </span>
                      <span className="text-[11px] text-muted-foreground ml-1.5">
                        ({result.sum}/{result.max})
                      </span>
                    </div>
                    {result.level && (
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                        levelColors[result.level.variant]
                      )}>
                        {result.level.level}
                      </span>
                    )}
                  </>
                )}
                {!isSkipped && (
                  <span className={cn(
                    "text-muted-foreground transition-transform text-sm",
                    isCollapsed && "-rotate-90"
                  )}>▾</span>
                )}
              </div>
            </button>

            {/* Items */}
            {!isCollapsed && !isSkipped && (
              <div>
                {domain.items.map((item, idx) => (
                  <div
                    key={item.num}
                    className={cn(
                      "flex items-center px-4 py-2 gap-3",
                      idx % 2 === 0 ? "bg-muted/20" : "bg-background"
                    )}
                  >
                    <span className="font-mono text-[11px] text-muted-foreground min-w-[28px] text-right">
                      Q{item.num}
                    </span>
                    <span className="flex-1 text-xs text-foreground/80 leading-relaxed">
                      {item.text}
                    </span>
                    <div className="flex gap-1 flex-shrink-0">
                      {SCORE_OPTIONS.map(s => {
                        const selected = getScore(item.num) === s.value;
                        const styles = scoreButtonStyles[s.value];
                        return (
                          <button
                            key={s.value}
                            title={s.label}
                            onClick={() => setScore(item.num, s.value)}
                            className={cn(
                              "w-9 h-8 rounded-md border text-xs font-medium transition-all",
                              selected ? styles.active : styles.base,
                              !selected && "hover:opacity-80"
                            )}
                          >
                            {s.value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Supplementary Questions */}
      <div className="border border-border/50 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border/30">
          <span className="text-[13px] font-bold text-foreground">Supplementary — Days Affected</span>
          <span className="text-[11px] text-muted-foreground ml-2">Items 37–39 (not scored in domains)</span>
        </div>
        <div className="p-4 space-y-3">
          {[
            { key: "q37", num: 37, text: "Overall, in the past 30 days, how many days were these difficulties present?" },
            { key: "q38", num: 38, text: "In the past 30 days, how many days were you totally unable to carry out your usual activities or work?" },
            { key: "q39", num: 39, text: "In the past 30 days (not counting totally unable days), how many days did you cut back or reduce your usual activities?" },
          ].map(q => (
            <div key={q.key} className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-muted-foreground min-w-[28px] text-right">
                Q{q.num}
              </span>
              <span className="flex-1 text-xs text-foreground/80 leading-relaxed">{q.text}</span>
              <input
                type="number"
                min={0}
                max={30}
                value={supplementary[q.key as keyof typeof supplementary]}
                onChange={(e) => setSupplementary(q.key, e.target.value)}
                placeholder="days"
                className="w-16 h-8 px-2 rounded-md border border-border/50 bg-muted/30 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-accent/50"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Summary Table */}
      <div className="border-2 border-foreground rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-foreground">
          <h4 className="text-sm font-bold text-background">Scoring Summary</h4>
          <span className="text-[11px] text-background/60">Simple Scoring Method — Sum of item scores per domain</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground border-b border-border/30">Domain</th>
              <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground border-b border-border/30 w-14">Items</th>
              <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground border-b border-border/30 w-20">Raw Score</th>
              <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground border-b border-border/30 w-20">% Disability</th>
              <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground border-b border-border/30 w-24">Level</th>
            </tr>
          </thead>
          <tbody>
            {domainResults.map((d, idx) => {
              const isSkipped = d.optional && !workEnabled;
              return (
                <tr key={d.id} className={idx % 2 === 0 ? "bg-background" : "bg-muted/10"}>
                  <td className="px-4 py-2.5 border-b border-border/10">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-0.5 h-4 rounded-sm", isSkipped ? "bg-muted-foreground/20" : "bg-accent")} />
                      <span className={cn("font-medium", isSkipped ? "text-muted-foreground" : "text-foreground")}>
                        {d.name.replace(/Domain \d+[ab]? — /, "")}
                      </span>
                    </div>
                  </td>
                  <td className="text-center px-3 py-2.5 border-b border-border/10 font-mono text-muted-foreground">
                    {isSkipped ? "—" : `${d.answered}/${d.total}`}
                  </td>
                  <td className="text-center px-3 py-2.5 border-b border-border/10 font-mono">
                    {isSkipped || d.percent === null ? "—" : `${d.sum}/${d.max}`}
                  </td>
                  <td className="text-center px-3 py-2.5 border-b border-border/10 font-mono font-bold">
                    {isSkipped || d.percent === null ? "—" : `${d.percent.toFixed(1)}%`}
                  </td>
                  <td className="text-center px-3 py-2.5 border-b border-border/10">
                    {isSkipped || !d.level ? (
                      <span className="text-muted-foreground/30">—</span>
                    ) : (
                      <span className={cn(
                        "text-[10px] font-bold px-2.5 py-0.5 rounded uppercase tracking-wider",
                        levelColors[d.level.variant]
                      )}>
                        {d.level.level}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {/* Total row */}
            <tr className="bg-foreground text-background">
              <td className="px-4 py-3 font-bold">TOTAL</td>
              <td className="text-center px-3 py-3 font-mono text-background/60">
                {answeredCount}/{totalQuestions}
              </td>
              <td className="text-center px-3 py-3 font-mono font-bold">
                {totalResult ? `${totalResult.sum}/${totalResult.max}` : "—"}
              </td>
              <td className="text-center px-3 py-3 font-mono font-bold text-[15px]">
                {totalResult ? `${totalResult.percent.toFixed(1)}%` : "—"}
              </td>
              <td className="text-center px-3 py-3">
                {totalResult ? (
                  <span className={cn(
                    "text-[10px] font-bold px-2.5 py-0.5 rounded uppercase tracking-wider",
                    "bg-background/20 text-background"
                  )}>
                    {totalResult.level.level}
                  </span>
                ) : (
                  <span className="text-background/40">—</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Supplementary days row */}
        {(supplementary.q37 || supplementary.q38 || supplementary.q39) && (
          <div className="px-4 py-2.5 bg-muted/30 border-t border-border/30 text-xs text-muted-foreground flex gap-5 flex-wrap">
            {supplementary.q37 && <span><strong>Days difficulties present:</strong> {supplementary.q37}/30</span>}
            {supplementary.q38 && <span><strong>Days totally unable:</strong> {supplementary.q38}/30</span>}
            {supplementary.q39 && <span><strong>Days cut back:</strong> {supplementary.q39}/30</span>}
          </div>
        )}
      </div>

      {/* Disability level key */}
      <div className="flex gap-4 text-[11px] text-muted-foreground flex-wrap justify-center">
        <span className="font-semibold text-foreground/60">Disability levels:</span>
        {[
          { range: "0–4%", label: "None", variant: "success" },
          { range: "5–24%", label: "Mild", variant: "lime" },
          { range: "25–49%", label: "Moderate", variant: "warning" },
          { range: "50–95%", label: "Severe", variant: "destructive" },
          { range: "96–100%", label: "Extreme", variant: "extreme" },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1">
            <span className={cn("w-2 h-2 rounded-sm inline-block", levelColors[l.variant].split(" ")[0])} />
            {l.label} ({l.range})
          </span>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground/40 text-center">
        WHODAS 2.0 — WHO (2010). Simple scoring method. For clinical use only.
      </p>
    </div>
  );
}

/**
 * Extracts WHODAS summary data from scores for report generation.
 */
export function getWHODASSummary(scores: Record<string, string>) {
  const getScore = (num: number): number | undefined => {
    const val = scores[`whodas-${num}`];
    return val !== undefined ? parseInt(val, 10) : undefined;
  };

  const workEnabled = [25, 26, 27, 28].some(n => getScore(n) !== undefined);

  const results = DOMAINS.map(domain => {
    if (domain.optional && !workEnabled) return null;
    const answered = domain.items.filter(i => getScore(i.num) !== undefined);
    const sum = answered.reduce((acc, i) => acc + (getScore(i.num) || 0), 0);
    const max = domain.items.length * 4;
    const percent = answered.length > 0 ? (sum / max) * 100 : null;
    const level = percent !== null ? getDisabilityLevel(percent) : null;
    return { domain: domain.name.replace(/Domain \d+[ab]? — /, ""), sum, max, percent, level: level?.level || "—" };
  }).filter(Boolean);

  const totalSum = results.reduce((acc, r) => acc + (r?.sum || 0), 0);
  const totalMax = results.reduce((acc, r) => acc + (r?.max || 0), 0);
  const totalPercent = totalMax > 0 ? (totalSum / totalMax) * 100 : 0;
  const totalLevel = getDisabilityLevel(totalPercent);

  return {
    domains: results,
    total: { sum: totalSum, max: totalMax, percent: totalPercent, level: totalLevel.level },
    supplementary: {
      daysDifficultiesPresent: scores["whodas-q37"] || "",
      daysTotallyUnable: scores["whodas-q38"] || "",
      daysCutBack: scores["whodas-q39"] || "",
    },
  };
}
