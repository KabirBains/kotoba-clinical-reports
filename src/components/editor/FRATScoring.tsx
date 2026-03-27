import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";

interface FRATScoringProps {
  scores: Record<string, string>;
  onUpdateScores: (scores: Record<string, string>) => void;
}

const AMTS_QUESTIONS = [
  { num: 1, text: "What is your age?", hint: "Must state correct age", type: "verify" },
  { num: 2, text: "What is the time to the nearest hour?", hint: "Within 1 hour of actual time", type: "verify" },
  { num: 3, text: "Give the patient an address — ask them to repeat it at the end of the test", hint: "e.g. 42 West Street — score at Q10, but tell them now", type: "recall", recallNote: "Scored at end" },
  { num: 4, text: "What is the year?", hint: "Must state correct year", type: "verify" },
  { num: 5, text: "What is the name of this place?", hint: "Hospital name, ward, residence, or home address", type: "verify" },
  { num: 6, text: "Can the patient recognise two persons?", hint: "Point to doctor, nurse, carer, family — must identify role or name of two", type: "observe" },
  { num: 7, text: "What is your date of birth?", hint: "Day and month sufficient", type: "verify" },
  { num: 8, text: "In what year did World War I begin?", hint: "Correct answer: 1914", type: "verify" },
  { num: 9, text: "Name the present monarch / prime minister / president", hint: "Must be currently correct", type: "verify" },
  { num: 10, text: "Count backwards from 20 down to 1", hint: "No errors allowed. Also: ask patient to recall the address from Q3", type: "perform" },
];

function amtsToFratIndex(amtsScore: number): number {
  if (amtsScore >= 9) return 0;
  if (amtsScore >= 7) return 1;
  if (amtsScore >= 5) return 2;
  return 3;
}

function amtsClassification(score: number) {
  if (score >= 9) return { label: "Intact", color: "text-green-600" };
  if (score >= 7) return { label: "Mildly Impaired", color: "text-yellow-600" };
  if (score >= 5) return { label: "Moderately Impaired", color: "text-orange-600" };
  return { label: "Severely Impaired", color: "text-red-600" };
}

const PART1_ITEMS = [
  {
    id: "recent_falls",
    name: "Recent Falls",
    instruction: "To score this, complete history of falls",
    options: [
      { text: "None in last 12 months", score: 2 },
      { text: "One or more between 3 and 12 months ago", score: 4 },
      { text: "One or more in last 3 months", score: 6 },
      { text: "One or more in last 3 months whilst inpatient/resident", score: 8 },
    ],
  },
  {
    id: "medications",
    name: "Medications",
    instruction: "Sedatives, Anti-Depressants, Anti-Parkinson's, Diuretics, Anti-hypertensives, Hypnotics",
    options: [
      { text: "Not taking any of these", score: 1 },
      { text: "Taking one", score: 2 },
      { text: "Taking two", score: 3 },
      { text: "Taking more than two", score: 4 },
    ],
  },
  {
    id: "psychological",
    name: "Psychological",
    instruction: "Anxiety, Depression, Cooperation, Insight or Judgement esp. re mobility",
    options: [
      { text: "Does not appear to have any of these", score: 1 },
      { text: "Appears mildly affected by one or more", score: 2 },
      { text: "Appears moderately affected by one or more", score: 3 },
      { text: "Appears severely affected by one or more", score: 4 },
    ],
  },
  {
    id: "cognitive",
    name: "Cognitive Status",
    instruction: "AMTS: Hodkinson Abbreviated Mental Test Score — use the AMTS tool below or select manually",
    hasAMTS: true,
    options: [
      { text: "AMTS 9 or 10/10 OR intact", score: 1 },
      { text: "AMTS 7–8 — mildly impaired", score: 2 },
      { text: "AMTS 5–6 — moderately impaired", score: 3 },
      { text: "AMTS 4 or less — severely impaired", score: 4 },
    ],
  },
];

const AUTO_HIGH_RISK = [
  { id: "functional_change", text: "Recent change in functional status and/or medications affecting safe mobility (or anticipated)" },
  { id: "dizziness", text: "Dizziness / postural hypotension" },
];

const PART2_SECTIONS = [
  { id: "vision", name: "Vision", items: [{ id: "vision_1", text: "Reports/observed difficulty seeing — objects, signs, finding way around" }] },
  { id: "mobility", name: "Mobility", items: [{ id: "mobility_1", text: "Mobility status unknown or appears unsafe / impulsive / forgets gait aid" }] },
  { id: "transfers", name: "Transfers", items: [{ id: "transfers_1", text: "Transfer status unknown or appears unsafe i.e. over-reaches, impulsive" }] },
  { id: "behaviours", name: "Behaviours", items: [
    { id: "beh_1", text: "Observed or reported agitation, confusion, disorientation" },
    { id: "beh_2", text: "Difficulty following instructions or non-compliant (observed or known)" },
    { id: "beh_3", text: "Observed risk-taking behaviours, or reported from referrer/previous facility" },
    { id: "beh_4", text: "Observed unsafe use of equipment" },
  ]},
  { id: "adl", name: "Activities of Daily Living", items: [{ id: "adl_1", text: "Unsafe footwear / inappropriate clothing" }] },
  { id: "environment", name: "Environment", items: [{ id: "env_1", text: "Difficulties with orientation to environment i.e. areas between bed / bathroom / dining room" }] },
  { id: "nutrition", name: "Nutrition", items: [{ id: "nut_1", text: "Underweight / low appetite" }] },
  { id: "continence", name: "Continence", items: [{ id: "cont_1", text: "Reported or known urgency / nocturia / accidents" }] },
];

function getRiskLevel(score: number) {
  if (score >= 16) return { level: "HIGH", className: "bg-red-600" };
  if (score >= 12) return { level: "MEDIUM", className: "bg-yellow-600" };
  return { level: "LOW", className: "bg-green-600" };
}

export function FRATScoring({ scores, onUpdateScores }: FRATScoringProps) {
  const [showAMTS, setShowAMTS] = useState(false);
  const [collapsedPart2, setCollapsedPart2] = useState(true);

  // Parse stored scores back into component state
  const part1 = useMemo(() => {
    const result: Record<string, number> = {};
    PART1_ITEMS.forEach(item => {
      const val = scores[`part1_${item.id}`];
      if (val !== undefined && val !== "") result[item.id] = parseInt(val);
    });
    return result;
  }, [scores]);

  const autoHigh = useMemo(() => {
    const result: Record<string, boolean> = {};
    AUTO_HIGH_RISK.forEach(item => {
      result[item.id] = scores[`auto_${item.id}`] === "true";
    });
    return result;
  }, [scores]);

  const part2 = useMemo(() => {
    const result: Record<string, boolean> = {};
    PART2_SECTIONS.forEach(section => {
      section.items.forEach(item => {
        result[item.id] = scores[`part2_${item.id}`] === "true";
      });
    });
    return result;
  }, [scores]);

  const amtsResponses = useMemo(() => {
    const result: Record<number, number> = {};
    AMTS_QUESTIONS.forEach(q => {
      const val = scores[`amts_${q.num}`];
      if (val !== undefined && val !== "") result[q.num] = parseInt(val);
    });
    return result;
  }, [scores]);

  const update = (key: string, value: string) => {
    onUpdateScores({ ...scores, [key]: value });
  };

  const setPart1Score = (itemId: string, optIdx: number) => update(`part1_${itemId}`, String(optIdx));
  const toggleAutoHigh = (id: string) => update(`auto_${id}`, autoHigh[id] ? "false" : "true");
  const togglePart2 = (id: string) => update(`part2_${id}`, part2[id] ? "false" : "true");
  const setAmtsResponse = (qNum: number, value: number) => update(`amts_${qNum}`, String(value));

  const amtsScore = useMemo(() => Object.values(amtsResponses).reduce((acc, v) => acc + v, 0), [amtsResponses]);
  const amtsAnswered = Object.keys(amtsResponses).length;
  const amtsSuggestedIdx = amtsAnswered === 10 ? amtsToFratIndex(amtsScore) : null;

  const applyAMTS = () => {
    if (amtsSuggestedIdx !== null) setPart1Score("cognitive", amtsSuggestedIdx);
  };

  const part1Results = useMemo(() => {
    let total = 0;
    let answered = 0;
    const itemScores: Record<string, number> = {};
    for (const item of PART1_ITEMS) {
      if (part1[item.id] !== undefined) {
        const score = item.options[part1[item.id]].score;
        itemScores[item.id] = score;
        total += score;
        answered++;
      }
    }
    return { scores: itemScores, total, answered };
  }, [part1]);

  const anyAutoHigh = Object.values(autoHigh).some(v => v);
  const allPart1Answered = part1Results.answered === 4;

  const riskResult = useMemo(() => {
    if (anyAutoHigh) return { level: "HIGH", className: "bg-red-600", reason: "Automatic high risk trigger" };
    if (!allPart1Answered) return null;
    return getRiskLevel(part1Results.total);
  }, [part1Results, allPart1Answered, anyAutoHigh]);

  const part2Count = Object.values(part2).filter(Boolean).length;
  const totalPart2Items = PART2_SECTIONS.reduce((acc, s) => acc + s.items.length, 0);

  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Part 1 — Fall Risk Status ({part1Results.answered}/4 scored)
      </div>

      {PART1_ITEMS.map((item) => {
        const selectedIdx = part1[item.id];
        const score = part1Results.scores[item.id];
        const isCognitive = item.hasAMTS;

        return (
          <div key={item.id} className="border border-border/50 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/20 border-b border-border/30 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{item.name}</span>
                  {isCognitive && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-5 text-[10px] px-2"
                      onClick={() => setShowAMTS(!showAMTS)}
                    >
                      {showAMTS ? "Hide AMTS" : "Administer AMTS"}
                    </Button>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{item.instruction}</div>
              </div>
              {score !== undefined && (
                <span className="font-mono text-lg font-bold text-accent">{score}</span>
              )}
            </div>

            {isCognitive && showAMTS && (
              <div className="mx-3 my-2 border border-border/40 rounded-lg overflow-hidden bg-muted/10">
                <div className="px-3 py-2 border-b border-border/30 flex justify-between items-center">
                  <div>
                    <div className="text-xs font-bold text-foreground">AMTS — Abbreviated Mental Test Score</div>
                    <div className="text-[10px] text-muted-foreground">Hodkinson (1972) · 10 questions · 1 point per correct answer</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{amtsAnswered}/10</span>
                    {amtsAnswered === 10 && (
                      <span className={`font-mono text-lg font-bold ${amtsClassification(amtsScore).color}`}>
                        {amtsScore}/10
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  {AMTS_QUESTIONS.map((q, idx) => {
                    const val = amtsResponses[q.num];
                    return (
                      <div key={q.num} className={`px-3 py-2 ${idx % 2 === 0 ? 'bg-muted/5' : 'bg-muted/10'} border-b border-border/10 last:border-b-0`}>
                        <div className="flex items-start gap-2">
                          <span className="font-mono text-[11px] text-muted-foreground min-w-[20px] text-right mt-0.5">{q.num}.</span>
                          <div className="flex-1">
                            <div className="text-xs text-foreground font-medium">{q.text}</div>
                            <div className="text-[10px] text-muted-foreground">{q.hint}</div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => setAmtsResponse(q.num, 1)}
                              className={`px-2 py-1 rounded text-[10px] font-bold border ${val === 1 ? 'bg-green-600 text-white border-green-600' : 'bg-background border-border/50 text-muted-foreground'}`}
                            >Correct</button>
                            <button
                              onClick={() => setAmtsResponse(q.num, 0)}
                              className={`px-2 py-1 rounded text-[10px] font-bold border ${val === 0 ? 'bg-red-600 text-white border-red-600' : 'bg-background border-border/50 text-muted-foreground'}`}
                            >Incorrect</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {amtsAnswered === 10 && (
                  <div className="px-3 py-2 border-t border-border/30 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-xl font-bold ${amtsClassification(amtsScore).color}`}>{amtsScore}/10</span>
                      <span className={`text-[11px] font-bold ${amtsClassification(amtsScore).color}`}>{amtsClassification(amtsScore).label}</span>
                    </div>
                    <Button size="sm" className="text-xs h-7" onClick={applyAMTS}>
                      Apply AMTS {amtsScore}/10 → FRAT Cognitive
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div>
              {item.options.map((opt, idx) => {
                const isSelected = selectedIdx === idx;
                const isHighlighted = isCognitive && amtsSuggestedIdx === idx && selectedIdx !== idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setPart1Score(item.id, idx)}
                    className={`w-full flex items-center gap-2 px-4 py-1.5 text-left border-l-[3px] transition-colors ${
                      isSelected ? 'border-l-accent bg-accent/5' : isHighlighted ? 'border-l-yellow-400 bg-yellow-50' : 'border-l-transparent hover:bg-muted/30'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                      isSelected ? 'border-accent bg-accent' : 'border-border'
                    }`}>
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    <span className={`flex-1 text-xs ${isSelected ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{opt.text}</span>
                    <span className={`font-mono text-sm font-bold ${isSelected ? 'text-accent' : 'text-muted-foreground/30'}`}>{opt.score}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Automatic High Risk */}
      <div className="border-2 border-red-500/50 rounded-lg overflow-hidden bg-red-50/30">
        <div className="px-4 py-2 border-b border-red-200/50">
          <span className="text-xs font-bold text-red-600">Automatic High Risk Status</span>
          <span className="text-[10px] text-muted-foreground ml-2">If ticked → circle HIGH risk regardless of score</span>
        </div>
        <div className="px-4 py-2 space-y-1">
          {AUTO_HIGH_RISK.map(item => (
            <label key={item.id} className="flex items-center gap-2 cursor-pointer text-xs text-foreground">
              <input type="checkbox" checked={autoHigh[item.id] || false} onChange={() => toggleAutoHigh(item.id)} className="accent-red-600" />
              {item.text}
            </label>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="border-2 border-foreground/20 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-foreground text-background">
          <h3 className="text-sm font-bold">Part 1 — Risk Score Summary</h3>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Risk Factor</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground w-20">Score</th>
            </tr>
          </thead>
          <tbody>
            {PART1_ITEMS.map((item, idx) => (
              <tr key={item.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>
                <td className="px-3 py-2 text-foreground/80 border-t border-border/20">{item.name}</td>
                <td className="px-3 py-2 text-center font-mono font-bold text-accent border-t border-border/20">
                  {part1Results.scores[item.id] !== undefined ? part1Results.scores[item.id] : "—"}
                </td>
              </tr>
            ))}
            <tr className="bg-foreground text-background">
              <td className="px-3 py-2 font-bold">Total Risk Score</td>
              <td className="px-3 py-2 text-center font-mono font-bold text-lg">
                {allPart1Answered ? part1Results.total : "—"}<span className="text-xs opacity-60">/20</span>
              </td>
            </tr>
          </tbody>
        </table>

        {riskResult && (
          <div className="p-4 text-center border-t border-border/20">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Fall Risk Status</div>
            <span className={`inline-block px-6 py-2 rounded-lg text-white font-mono text-2xl font-bold ${riskResult.className}`}>
              {riskResult.level}
            </span>
            {anyAutoHigh && <div className="text-[11px] text-red-600 font-semibold mt-2">Automatic high risk trigger activated</div>}
          </div>
        )}

        <div className="px-4 py-2 border-t border-border/20 flex gap-4 justify-center text-[11px] text-muted-foreground">
          <span><strong>Low</strong>: 5–11</span>
          <span><strong>Medium</strong>: 12–15</span>
          <span><strong>High</strong>: 16–20</span>
        </div>
      </div>

      {/* Part 2 */}
      <div className="border border-border/50 rounded-lg overflow-hidden">
        <button
          onClick={() => setCollapsedPart2(!collapsedPart2)}
          className="w-full px-4 py-2.5 bg-muted/20 flex justify-between items-center text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">Part 2 — Risk Factor Checklist</span>
            <span className="text-[11px] text-muted-foreground">({part2Count}/{totalPart2Items} identified)</span>
          </div>
          <span className={`text-muted-foreground transition-transform ${collapsedPart2 ? '-rotate-90' : ''}`}>▾</span>
        </button>
        {!collapsedPart2 && (
          <div className="px-4 py-2 space-y-3">
            {PART2_SECTIONS.map(section => (
              <div key={section.id}>
                <div className="text-xs font-bold text-foreground/80 border-b border-border/20 pb-1 mb-1">{section.name}</div>
                {section.items.map(item => (
                  <label key={item.id} className="flex items-center gap-2 py-1 cursor-pointer text-xs text-foreground/80">
                    <input type="checkbox" checked={part2[item.id] || false} onChange={() => togglePart2(item.id)} className="accent-red-600" />
                    {item.text}
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function getFRATSummary(scores: Record<string, string>) {
  let total = 0;
  let answered = 0;
  for (const item of PART1_ITEMS) {
    const val = scores[`part1_${item.id}`];
    if (val !== undefined && val !== "") {
      total += item.options[parseInt(val)].score;
      answered++;
    }
  }
  const anyAutoHigh = AUTO_HIGH_RISK.some(item => scores[`auto_${item.id}`] === "true");
  let riskLevel = "Incomplete";
  if (anyAutoHigh) riskLevel = "HIGH (auto-trigger)";
  else if (answered === 4) {
    if (total >= 16) riskLevel = "HIGH";
    else if (total >= 12) riskLevel = "MEDIUM";
    else riskLevel = "LOW";
  }
  return { total, answered, riskLevel };
}
