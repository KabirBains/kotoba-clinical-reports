import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { AssessmentScoreSummary } from "@/lib/assessment-library";

interface LawtonIADLScoringProps {
  scores: Record<string, string>;
  onUpdateScores: (scores: Record<string, string>) => void;
}

const DOMAINS = [
  {
    id: "telephone", letter: "A", name: "Ability to Use Telephone", maleIncluded: true,
    options: [
      { text: "Operates telephone on own initiative — looks up and dials numbers, etc.", score: 1 },
      { text: "Dials a few well-known numbers", score: 1 },
      { text: "Answers telephone but does not dial", score: 1 },
      { text: "Does not use telephone at all", score: 0 },
    ],
  },
  {
    id: "shopping", letter: "B", name: "Shopping", maleIncluded: true,
    options: [
      { text: "Takes care of all shopping needs independently", score: 1 },
      { text: "Shops independently for small purchases", score: 0 },
      { text: "Needs to be accompanied on any shopping trip", score: 0 },
      { text: "Completely unable to shop", score: 0 },
    ],
  },
  {
    id: "food_prep", letter: "C", name: "Food Preparation", maleIncluded: false,
    options: [
      { text: "Plans, prepares and serves adequate meals independently", score: 1 },
      { text: "Prepares adequate meals if supplied with ingredients", score: 0 },
      { text: "Heats, serves and prepares meals, but does not maintain adequate diet", score: 0 },
      { text: "Needs to have meals prepared and served", score: 0 },
    ],
  },
  {
    id: "housekeeping", letter: "D", name: "Housekeeping", maleIncluded: false,
    options: [
      { text: "Maintains house alone or with occasional assistance (e.g. heavy work domestic help)", score: 1 },
      { text: "Performs light daily tasks such as dish washing, bed making", score: 1 },
      { text: "Performs light daily tasks but cannot maintain acceptable level of cleanliness", score: 1 },
      { text: "Needs help with all home maintenance tasks", score: 1 },
      { text: "Does not participate in any housekeeping tasks", score: 0 },
    ],
  },
  {
    id: "laundry", letter: "E", name: "Laundry", maleIncluded: false,
    options: [
      { text: "Does personal laundry completely", score: 1 },
      { text: "Launders small items — rinses stockings, etc.", score: 1 },
      { text: "All laundry must be done by others", score: 0 },
    ],
  },
  {
    id: "transport", letter: "F", name: "Mode of Transportation", maleIncluded: true,
    options: [
      { text: "Travels independently on public transportation or drives own car", score: 1 },
      { text: "Arranges own travel via taxi, but does not otherwise use public transportation", score: 1 },
      { text: "Travels on public transportation when accompanied by another", score: 1 },
      { text: "Travel limited to taxi or automobile with assistance of another", score: 0 },
      { text: "Does not travel at all", score: 0 },
    ],
  },
  {
    id: "medications", letter: "G", name: "Responsibility for Own Medications", maleIncluded: true,
    options: [
      { text: "Is responsible for taking medication in correct dosages at correct time", score: 1 },
      { text: "Takes responsibility if medication is prepared in advance in separate dosage", score: 0 },
      { text: "Is not capable of dispensing own medication", score: 0 },
    ],
  },
  {
    id: "finances", letter: "H", name: "Ability to Handle Finances", maleIncluded: true,
    options: [
      { text: "Manages financial matters independently (budgets, writes checks, pays rent, bills, goes to bank)", score: 1 },
      { text: "Manages day-to-day purchases, but needs help with banking, major purchases, etc.", score: 1 },
      { text: "Incapable of handling money", score: 0 },
    ],
  },
];

function getFunctionLevel(score: number, max: number) {
  if (max === 0) return null;
  const pct = (score / max) * 100;
  if (pct >= 75) return { label: "Independent", className: "text-green-600" };
  if (pct >= 50) return { label: "Mildly Dependent", className: "text-lime-600" };
  if (pct >= 25) return { label: "Moderately Dependent", className: "text-yellow-600" };
  if (pct > 0) return { label: "Severely Dependent", className: "text-orange-600" };
  return { label: "Totally Dependent", className: "text-red-600" };
}

// ─── EXPORTED SCORING FUNCTION ──────────────────────────────────
// Single source of truth for Lawton IADL scoring including gender-aware
// domain filtering. Replaces duplicated logic in ClientEditor.tsx.

/**
 * Unified score summary for the AI prompt builder.
 * Lawton IADL is gender-aware: by default the male variant excludes
 * food preparation, housekeeping, and laundry domains (5 domains).
 * The full version (8 domains) applies for female and unspecified.
 */
export function getLawtonScoreSummary(scores: Record<string, string>): AssessmentScoreSummary {
  const gender = scores["__gender"] || "all";
  const activeDomains = gender === "male" ? DOMAINS.filter((d) => d.maleIncluded) : DOMAINS;

  const rows: { label: string; value: string }[] = [];
  let sum = 0;
  let answered = 0;

  for (const domain of activeDomains) {
    const val = scores[domain.id];
    if (val !== undefined && val !== "") {
      const optIdx = parseInt(val);
      const opt = domain.options[optIdx];
      const score = opt?.score ?? 0;
      sum += score;
      answered++;
      rows.push({ label: domain.name, value: score === 1 ? "Independent" : "Dependent" });
    }
  }

  const itemsTotal = activeDomains.length;
  const isComplete = answered === itemsTotal;
  const total = answered > 0 ? `${sum}/${itemsTotal}` : "";

  let classification = "";
  if (answered > 0) {
    if (sum === itemsTotal) classification = "High function — independent";
    else if (sum >= 5) classification = "Moderate function — some assistance needed";
    else classification = "Low function — significant assistance needed";
  }

  return {
    rows,
    total,
    classification,
    isComplete,
    itemsAnswered: answered,
    itemsTotal,
    scoringDirection: "Lawton IADL: HIGHER scores = BETTER function. 0 = fully dependent, 8 (or 5 for the male variant) = fully independent. Each domain scores 0 or 1.",
  };
}

export function LawtonIADLScoring({ scores, onUpdateScores }: LawtonIADLScoringProps) {
  const gender = scores["__gender"] || "all";
  
  const selections = useMemo(() => {
    const result: Record<string, number> = {};
    DOMAINS.forEach(d => {
      const val = scores[d.id];
      if (val !== undefined && val !== "") result[d.id] = parseInt(val);
    });
    return result;
  }, [scores]);

  const activeDomains = gender === "male" ? DOMAINS.filter(d => d.maleIncluded) : DOMAINS;
  const maxScore = activeDomains.length;

  const domainScores = useMemo(() => {
    const result: Record<string, number> = {};
    for (const domain of DOMAINS) {
      if (selections[domain.id] !== undefined) {
        result[domain.id] = domain.options[selections[domain.id]].score;
      }
    }
    return result;
  }, [selections]);

  const totalResult = useMemo(() => {
    const scored = activeDomains.filter(d => domainScores[d.id] !== undefined);
    if (scored.length === 0) return null;
    const sum = scored.reduce((acc, d) => acc + domainScores[d.id], 0);
    return { sum, answered: scored.length, max: maxScore, level: getFunctionLevel(sum, maxScore) };
  }, [domainScores, activeDomains, maxScore]);

  const answeredCount = activeDomains.filter(d => selections[d.id] !== undefined).length;

  const setSelection = (domainId: string, optIndex: number) => {
    onUpdateScores({ ...scores, [domainId]: String(optIndex) });
  };

  const setGender = (g: string) => {
    onUpdateScores({ ...scores, __gender: g });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-foreground">{answeredCount}/{activeDomains.length} domains scored</span>
          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${(answeredCount / activeDomains.length) * 100}%` }} />
          </div>
        </div>
        <div className="flex gap-1.5">
          {[{ key: "all", label: "All 8 domains" }, { key: "male", label: "5 domains (excl. C,D,E)" }].map(opt => (
            <button
              key={opt.key}
              onClick={() => setGender(opt.key)}
              className={`text-[11px] px-2.5 py-1 rounded-md font-semibold border transition-colors ${
                gender === opt.key ? 'bg-foreground text-background border-foreground' : 'bg-background text-muted-foreground border-border'
              }`}
            >{opt.label}</button>
          ))}
        </div>
      </div>

      {DOMAINS.map(domain => {
        const isExcluded = gender === "male" && !domain.maleIncluded;
        const selectedIdx = selections[domain.id];
        const score = domainScores[domain.id];

        return (
          <div key={domain.id} className={`border border-border/50 rounded-lg overflow-hidden transition-opacity ${isExcluded ? 'opacity-30' : ''}`}>
            <div className="px-4 py-2.5 bg-muted/20 border-b border-border/30 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-accent">{domain.letter}.</span>
                <span className="text-sm font-bold text-foreground">{domain.name}</span>
                {isExcluded && <span className="text-[10px] text-muted-foreground italic">Excluded</span>}
              </div>
              {score !== undefined && !isExcluded && (
                <span className={`font-mono text-lg font-bold ${score === 1 ? 'text-green-600' : 'text-red-600'}`}>{score}</span>
              )}
            </div>
            {!isExcluded && (
              <div>
                {domain.options.map((opt, idx) => {
                  const isSelected = selectedIdx === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelection(domain.id, idx)}
                      className={`w-full flex items-center gap-2 px-4 py-1.5 text-left border-l-[3px] transition-colors ${
                        isSelected
                          ? (opt.score === 1 ? 'border-l-green-500 bg-green-50/50' : 'border-l-red-500 bg-red-50/50')
                          : 'border-l-transparent hover:bg-muted/30'
                      }`}
                    >
                      <span className="font-mono text-[11px] text-muted-foreground min-w-[16px] text-right">{idx + 1}.</span>
                      <span className={`flex-1 text-xs ${isSelected ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{opt.text}</span>
                      <span className={`font-mono text-sm font-bold ${isSelected ? (opt.score === 1 ? 'text-green-600' : 'text-red-600') : 'text-muted-foreground/20'}`}>{opt.score}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Summary */}
      <div className="border-2 border-foreground/20 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-foreground text-background">
          <h3 className="text-sm font-bold">Scoring Summary</h3>
          <span className="text-[11px] opacity-70">0 = dependent · {maxScore} = independent</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Domain</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground w-20">Score</th>
            </tr>
          </thead>
          <tbody>
            {activeDomains.map((domain, idx) => (
              <tr key={domain.id} className={idx % 2 === 0 ? '' : 'bg-muted/10'}>
                <td className="px-3 py-2 border-t border-border/20">
                  <span className="font-mono font-bold text-accent mr-1">{domain.letter}.</span>
                  <span className="text-foreground/80">{domain.name}</span>
                </td>
                <td className="px-3 py-2 text-center border-t border-border/20">
                  {domainScores[domain.id] !== undefined ? (
                    <span className={`font-mono font-bold text-base ${domainScores[domain.id] === 1 ? 'text-green-600' : 'text-red-600'}`}>{domainScores[domain.id]}</span>
                  ) : <span className="text-muted-foreground/30">—</span>}
                </td>
              </tr>
            ))}
            <tr className="bg-foreground text-background">
              <td className="px-3 py-2 font-bold">Total Score</td>
              <td className="px-3 py-2 text-center font-mono font-bold text-lg">
                {totalResult ? totalResult.sum : "—"}<span className="text-xs opacity-60">/{maxScore}</span>
              </td>
            </tr>
          </tbody>
        </table>
        {totalResult?.level && (
          <div className="p-3 text-center border-t border-border/20">
            <span className={`text-xs font-bold uppercase ${totalResult.level.className}`}>{totalResult.level.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function getLawtonSummary(scores: Record<string, string>) {
  const gender = scores["__gender"] || "all";
  const activeDomains = gender === "male" ? DOMAINS.filter(d => d.maleIncluded) : DOMAINS;
  let sum = 0; let answered = 0;
  for (const d of activeDomains) {
    const val = scores[d.id];
    if (val !== undefined && val !== "") {
      sum += d.options[parseInt(val)].score;
      answered++;
    }
  }
  const max = activeDomains.length;
  let level = "Incomplete";
  if (answered === max) {
    const pct = (sum / max) * 100;
    if (pct >= 75) level = "Independent";
    else if (pct >= 50) level = "Mildly Dependent";
    else if (pct >= 25) level = "Moderately Dependent";
    else if (pct > 0) level = "Severely Dependent";
    else level = "Totally Dependent";
  }
  return { sum, max, answered, level };
}
