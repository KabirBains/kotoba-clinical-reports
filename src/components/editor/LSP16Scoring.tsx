import { useState, useMemo } from "react";

/*
  Abbreviated Life Skills Profile (LSP-16)
  Scoring: 0–3 per item (higher = greater disability)
  Total: 0–48
  4 Subscales: Withdrawal (0–12), Self-care (0–15), Compliance (0–9), Anti-social (0–12)
  
  CRITICAL SCORING DIRECTION: ALL subscales — higher score = WORSE functioning.
*/

interface LSP16ScoringProps {
  scores: Record<string, string>;
  onUpdateScores: (scores: Record<string, string>) => void;
}

const SUBSCALES: Record<string, { name: string; color: string; max: number; items: number[]; interpretHigh: string; interpretLow: string; domain: string }> = {
  withdrawal: {
    name: "A. Withdrawal", color: "#7c3aed", max: 12, items: [1, 2, 3, 8],
    interpretHigh: "severe social withdrawal, disengagement from relationships, and isolation",
    interpretLow: "adequate social engagement and interpersonal functioning",
    domain: "social engagement and interpersonal interaction",
  },
  selfcare: {
    name: "B. Self-Care", color: "#0891b2", max: 15, items: [4, 5, 6, 9, 16],
    interpretHigh: "severe self-care deficits including poor grooming, hygiene neglect, inadequate diet, and inability to maintain employment",
    interpretLow: "adequate personal maintenance, grooming, dietary management, and work capacity",
    domain: "personal maintenance, grooming, diet, and work capacity",
  },
  compliance: {
    name: "C. Compliance", color: "#059669", max: 9, items: [10, 11, 12],
    interpretHigh: "extreme non-compliance with medication, treatment refusal, and poor cooperation with health services",
    interpretLow: "reliable medication management and good cooperation with health services",
    domain: "medication management and health service cooperation",
  },
  antisocial: {
    name: "D. Anti-Social", color: "#dc2626", max: 12, items: [7, 13, 14, 15],
    interpretHigh: "frequent violence, offensive behaviour, irresponsibility, and extreme friction with others",
    interpretLow: "no significant behavioural concerns, appropriate social conduct",
    domain: "behavioural regulation, violence, offensiveness, and responsibility",
  },
};

const ITEMS = [
  { num: 1, subscale: "withdrawal", text: "Does this person generally have any difficulty with initiating and responding to conversation?", anchors: ["No difficulty", "Slight difficulty", "Moderate difficulty", "Extreme difficulty"] },
  { num: 2, subscale: "withdrawal", text: "Does this person generally withdraw from social contact?", anchors: ["Does not withdraw at all", "Withdraws slightly", "Withdraws moderately", "Withdraws totally or near totally"] },
  { num: 3, subscale: "withdrawal", text: "Does this person generally show warmth to others?", anchors: ["Considerable warmth", "Moderate warmth", "Slight warmth", "No warmth at all"] },
  { num: 4, subscale: "selfcare", text: "Is this person generally well groomed (e.g. neatly dressed, hair combed)?", anchors: ["Well groomed", "Moderately well groomed", "Poorly groomed", "Extremely poorly groomed"] },
  { num: 5, subscale: "selfcare", text: "Does this person wear clean clothes generally, or ensure that they are cleaned if dirty?", anchors: ["Maintains cleanliness of clothes", "Moderate cleanliness of clothes", "Poor cleanliness of clothes", "Very poor cleanliness of clothes"] },
  { num: 6, subscale: "selfcare", text: "Does this person generally neglect her or his physical health?", anchors: ["No neglect", "Slight neglect of physical problems", "Moderate neglect of physical problems", "Extreme neglect of physical problems"] },
  { num: 7, subscale: "antisocial", text: "Is this person violent to others?", anchors: ["Not at all", "Rarely", "Occasionally", "Often"] },
  { num: 8, subscale: "withdrawal", text: "Does this person generally make and/or keep up friendships?", anchors: ["Friendships made or kept up well", "Friendships made or kept up with slight difficulty", "Friendships made or kept up with considerable difficulty", "No friendships made or none kept"] },
  { num: 9, subscale: "selfcare", text: "Does this person generally maintain an adequate diet?", anchors: ["No problem", "Slight problem", "Moderate problem", "Extreme problem"] },
  { num: 10, subscale: "compliance", text: "Does this person generally look after and take her or his own prescribed medication (or attend for prescribed injections on time) without reminding?", anchors: ["Reliable with medication", "Slightly unreliable", "Moderately unreliable", "Extremely unreliable"] },
  { num: 11, subscale: "compliance", text: "Is this person willing to take psychiatric medication when prescribed by a doctor?", anchors: ["Always", "Usually", "Rarely", "Never"] },
  { num: 12, subscale: "compliance", text: "Does this person co-operate with health services (e.g. doctors and/or other health workers)?", anchors: ["Always", "Usually", "Rarely", "Never"] },
  { num: 13, subscale: "antisocial", text: "Does this person generally have problems (e.g. friction, avoidance) living with others in the household?", anchors: ["No obvious problem", "Slight problems", "Moderate problems", "Extreme problems"] },
  { num: 14, subscale: "antisocial", text: "Does this person behave offensively (includes sexual behaviour)?", anchors: ["Not at all", "Rarely", "Occasionally", "Often"] },
  { num: 15, subscale: "antisocial", text: "Does this person behave irresponsibly?", anchors: ["Not at all", "Rarely", "Occasionally", "Often"] },
  { num: 16, subscale: "selfcare", text: "What sort of work is this person generally capable of (even if unemployed, retired or doing unpaid domestic duties)?", anchors: ["Capable of full time work", "Capable of part time work", "Capable only of sheltered work", "Totally incapable of work"] },
];

const SUBSCALE_ORDER = ["withdrawal", "selfcare", "compliance", "antisocial"];

function getSeverityLabel(percent: number): { label: string; color: string } {
  if (percent === 0) return { label: "No disability", color: "#16a34a" };
  if (percent <= 25) return { label: "Mild", color: "#65a30d" };
  if (percent <= 50) return { label: "Moderate", color: "#d97706" };
  if (percent <= 75) return { label: "Severe", color: "#ea580c" };
  return { label: "Extreme", color: "#dc2626" };
}

function getSubscaleInterpretation(subKey: string, score: number, max: number) {
  const sub = SUBSCALES[subKey];
  const percent = (score / max) * 100;
  const severity = getSeverityLabel(percent);
  const direction = `SCORING DIRECTION: Higher = worse functioning. ${score}/${max} = ${severity.label.toLowerCase()} disability in ${sub.domain}.`;

  let meaning: string;
  if (percent === 0) {
    meaning = `A score of ${score}/${max} indicates ${sub.interpretLow}. No disability identified in this domain.`;
  } else if (percent <= 25) {
    meaning = `A score of ${score}/${max} indicates mild impairment in ${sub.domain}. The participant shows slight difficulties but retains most functional capacity in this area.`;
  } else if (percent <= 50) {
    meaning = `A score of ${score}/${max} indicates moderate impairment in ${sub.domain}. The participant demonstrates notable difficulties that impact daily functioning.`;
  } else if (percent <= 75) {
    meaning = `A score of ${score}/${max} indicates severe impairment in ${sub.domain}. The participant demonstrates ${sub.interpretHigh.split(",")[0]}, with substantial impact on daily functioning.`;
  } else {
    meaning = `A score of ${score}/${max} indicates extreme impairment in ${sub.domain}. The participant demonstrates ${sub.interpretHigh}.`;
  }

  return { direction, meaning, severity: severity.label, percent };
}

// Export structured data with embedded interpretation for AI consumption
export function getLSP16ExportData(scores: Record<string, string>) {
  const subscaleResults: Record<string, { sum: number; answered: number; max: number; percent: number | null }> = {};
  for (const [key, sub] of Object.entries(SUBSCALES)) {
    const answered = sub.items.filter(n => scores[String(n)] !== undefined && scores[String(n)] !== "").length;
    const sum = sub.items.reduce((acc, n) => { const v = scores[String(n)]; return acc + (v !== undefined && v !== "" ? parseInt(v) : 0); }, 0);
    const percent = answered > 0 ? (sum / sub.max) * 100 : null;
    subscaleResults[key] = { sum, answered, max: sub.max, percent };
  }

  let totalSum = 0; let totalAnswered = 0;
  for (let i = 1; i <= 16; i++) {
    const val = scores[String(i)];
    if (val !== undefined && val !== "") { totalSum += parseInt(val); totalAnswered++; }
  }
  const totalPercent = totalAnswered > 0 ? (totalSum / 48) * 100 : null;
  const totalSeverity = totalPercent !== null ? getSeverityLabel(totalPercent) : null;

  const exportData: Record<string, any> = {
    tool: "LSP-16",
    toolFullName: "Abbreviated Life Skills Profile — 16 Items",
    scoringDirection: "ALL SUBSCALES: Higher scores = GREATER disability = WORSE functioning. A score of 0 = no disability. A score at maximum = extreme disability. Do NOT interpret high scores as strengths.",
    total: totalSeverity ? {
      score: totalSum, max: 48, percent: totalPercent!.toFixed(1), severity: totalSeverity.label,
      interpretation: `Total score ${totalSum}/48 (${totalPercent!.toFixed(1)}%) indicates ${totalSeverity.label.toLowerCase()} overall disability. Higher total = worse overall functioning.`,
    } : null,
    subscales: {} as Record<string, any>,
    itemScores: scores,
  };

  for (const [key, sub] of Object.entries(SUBSCALES)) {
    const r = subscaleResults[key];
    if (r && r.answered > 0) {
      const interp = getSubscaleInterpretation(key, r.sum, r.max);
      exportData.subscales[key] = {
        name: sub.name.replace(/^[A-D]\.\s*/, ""),
        score: r.sum, max: r.max, percent: r.percent!.toFixed(1),
        severity: interp.severity, scoringDirection: interp.direction,
        interpretation: interp.meaning, domain: sub.domain,
      };
    }
  }
  return exportData;
}

export function getLSP16Summary(scores: Record<string, string>) {
  let sum = 0; let answered = 0;
  for (let i = 1; i <= 16; i++) {
    const val = scores[String(i)];
    if (val !== undefined && val !== "") { sum += parseInt(val); answered++; }
  }
  const percent = answered > 0 ? (sum / 48) * 100 : 0;
  let severity = "Incomplete";
  if (answered === 16) {
    if (percent === 0) severity = "No disability";
    else if (percent <= 25) severity = "Mild";
    else if (percent <= 50) severity = "Moderate";
    else if (percent <= 75) severity = "Severe";
    else severity = "Extreme";
  }
  return { sum, answered, percent, severity };
}

function AnchorButton({ value, label, selected, onClick }: { value: number; label: string; selected: boolean; onClick: () => void }) {
  const colorClasses = [
    { base: "border-green-300 bg-green-50", active: "bg-green-600 border-green-600" },
    { base: "border-yellow-300 bg-yellow-50", active: "bg-yellow-600 border-yellow-600" },
    { base: "border-orange-300 bg-orange-50", active: "bg-orange-600 border-orange-600" },
    { base: "border-red-300 bg-red-50", active: "bg-red-600 border-red-600" },
  ];
  const c = colorClasses[value];
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-0 px-1 py-1.5 rounded-md border-[1.5px] text-center transition-colors ${
        selected ? `${c.active} text-white font-bold` : `${c.base} text-foreground/70`
      }`}
    >
      <div className="font-mono text-xs font-bold">{value}</div>
      <div className="text-[10px] leading-tight">{label}</div>
    </button>
  );
}

export function LSP16Scoring({ scores, onUpdateScores }: LSP16ScoringProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const getItemScore = (num: number): number | undefined => {
    const val = scores[String(num)];
    return val !== undefined && val !== "" ? parseInt(val) : undefined;
  };

  const setScore = (num: number, value: number) => {
    onUpdateScores({ ...scores, [String(num)]: String(value) });
  };

  const subscaleResults = useMemo(() => {
    const results: Record<string, { sum: number; answered: number; total: number; max: number; percent: number | null; severity: ReturnType<typeof getSeverityLabel> | null }> = {};
    for (const [key, sub] of Object.entries(SUBSCALES)) {
      const answered = sub.items.filter(n => getItemScore(n) !== undefined).length;
      const sum = sub.items.reduce((acc, n) => acc + (getItemScore(n) ?? 0), 0);
      const percent = answered > 0 ? (sum / sub.max) * 100 : null;
      results[key] = { sum, answered, total: sub.items.length, max: sub.max, percent, severity: percent !== null ? getSeverityLabel(percent) : null };
    }
    return results;
  }, [scores]);

  const totalResult = useMemo(() => {
    const answeredItems = ITEMS.filter(i => getItemScore(i.num) !== undefined);
    if (answeredItems.length === 0) return null;
    const sum = answeredItems.reduce((acc, i) => acc + (getItemScore(i.num) ?? 0), 0);
    const percent = (sum / 48) * 100;
    return { sum, answered: answeredItems.length, percent, severity: getSeverityLabel(percent) };
  }, [scores]);

  const answeredCount = ITEMS.filter(i => getItemScore(i.num) !== undefined).length;

  const clearAll = () => {
    onUpdateScores({});
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-foreground">{answeredCount}/16 items scored</span>
          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${(answeredCount / 16) * 100}%` }} />
          </div>
        </div>
        <button onClick={clearAll} className="text-xs px-2.5 py-1 rounded-md border border-border bg-background text-muted-foreground hover:bg-muted transition-colors">
          Clear All
        </button>
      </div>

      {/* Score key */}
      <div className="flex gap-4 text-[11px] text-muted-foreground flex-wrap">
        <span><span className="font-mono font-semibold">0</span> = Good functioning</span>
        <span><span className="font-mono font-semibold">1</span> = Slight difficulty</span>
        <span><span className="font-mono font-semibold">2</span> = Moderate difficulty</span>
        <span><span className="font-mono font-semibold">3</span> = Extreme difficulty</span>
      </div>

      {/* Items grouped by subscale */}
      {SUBSCALE_ORDER.map(subKey => {
        const sub = SUBSCALES[subKey];
        const r = subscaleResults[subKey];
        const subItems = ITEMS.filter(i => i.subscale === subKey);
        const isCollapsed = collapsed[subKey];

        return (
          <div key={subKey} className="border border-border/50 rounded-lg overflow-hidden">
            <button
              onClick={() => setCollapsed(p => ({ ...p, [subKey]: !p[subKey] }))}
              className="w-full px-4 py-2.5 bg-muted/20 border-b border-border/30 flex justify-between items-center text-left"
            >
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-sm" style={{ backgroundColor: sub.color }} />
                <span className="text-sm font-bold text-foreground">{sub.name}</span>
                <span className="text-[11px] text-muted-foreground">({r.answered}/{r.total})</span>
              </div>
              <div className="flex items-center gap-2">
                {r.percent !== null && (
                  <>
                    <span className="font-mono text-sm font-bold" style={{ color: sub.color }}>{r.sum}/{r.max}</span>
                    {r.severity && (
                      <span
                        className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                        style={{ backgroundColor: r.severity.color + "15", color: r.severity.color }}
                      >
                        {r.severity.label}
                      </span>
                    )}
                  </>
                )}
                <span className={`text-muted-foreground transition-transform ${isCollapsed ? '-rotate-90' : ''}`}>▾</span>
              </div>
            </button>
            {!isCollapsed && (
              <div>
                {subItems.map((item, idx) => {
                  const selected = getItemScore(item.num);
                  return (
                    <div key={item.num} className={`px-4 py-2.5 ${idx % 2 === 0 ? 'bg-muted/5' : ''} border-b border-border/10 last:border-b-0`}>
                      <div className="flex items-start gap-2 mb-2">
                        <span className="font-mono text-[11px] text-muted-foreground min-w-[22px] text-right mt-0.5">{item.num}</span>
                        <span className="text-xs text-foreground leading-relaxed">{item.text}</span>
                      </div>
                      <div className="flex gap-1 ml-6">
                        {item.anchors.map((anchor, i) => (
                          <AnchorButton key={i} value={i} label={anchor} selected={selected === i} onClick={() => setScore(item.num, i)} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Summary Table */}
      <div className="border-2 border-foreground/20 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-foreground text-background">
          <h3 className="text-sm font-bold">Scoring Summary</h3>
          <span className="text-[11px] opacity-70">Higher scores = greater disability · 0 = good functioning · 3 = extreme difficulty</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Subscale</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground w-16">Items</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground w-20">Score</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground w-16">%</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground w-24">Severity</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Meaning</th>
            </tr>
          </thead>
          <tbody>
            {SUBSCALE_ORDER.map((key, idx) => {
              const sub = SUBSCALES[key];
              const r = subscaleResults[key];
              const interp = r.answered > 0 ? getSubscaleInterpretation(key, r.sum, r.max) : null;
              return (
                <tr key={key} className={idx % 2 === 0 ? '' : 'bg-muted/10'}>
                  <td className="px-3 py-2 border-t border-border/20">
                    <div className="flex items-center gap-2">
                      <div className="w-0.5 h-4 rounded-sm" style={{ backgroundColor: sub.color }} />
                      <div>
                        <div className="font-medium text-foreground/80">{sub.name}</div>
                        <div className="text-[10px] text-muted-foreground">Higher = worse · {sub.domain}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 border-t border-border/20 text-center font-mono text-muted-foreground">{r.answered}/{r.total}</td>
                  <td className="px-3 py-2 border-t border-border/20 text-center font-mono font-bold" style={{ color: sub.color }}>
                    {r.answered > 0 ? r.sum : "—"}<span className="text-muted-foreground font-normal">/{r.max}</span>
                  </td>
                  <td className="px-3 py-2 border-t border-border/20 text-center font-mono font-semibold">
                    {r.percent !== null ? `${r.percent.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 border-t border-border/20 text-center">
                    {r.severity ? (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded" style={{ backgroundColor: r.severity.color + "15", color: r.severity.color }}>
                        {r.severity.label}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 border-t border-border/20 text-[11px] text-muted-foreground leading-snug">
                    {interp ? interp.meaning : "—"}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-foreground text-background">
              <td className="px-3 py-2 font-bold">E. Total Score</td>
              <td className="px-3 py-2 text-center font-mono">{answeredCount}/16</td>
              <td className="px-3 py-2 text-center font-mono font-bold text-lg">
                {totalResult ? totalResult.sum : "—"}<span className="text-xs opacity-60">/48</span>
              </td>
              <td className="px-3 py-2 text-center font-mono font-bold">
                {totalResult ? `${totalResult.percent.toFixed(1)}%` : "—"}
              </td>
              <td className="px-3 py-2 text-center">
                {totalResult ? (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded" style={{ backgroundColor: totalResult.severity.color + "30" }}>
                    {totalResult.severity.label}
                  </span>
                ) : "—"}
              </td>
              <td className="px-3 py-2 text-[11px] opacity-80">
                {totalResult ? `Overall: ${totalResult.severity.label.toLowerCase()} disability across all life skills domains.` : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Scoring direction reminder */}
      <div className="p-3 bg-red-50 border border-red-300 rounded-lg text-xs text-red-900 leading-relaxed">
        <strong>Scoring Direction Reminder:</strong> ALL LSP-16 subscales use the same direction — higher scores = greater disability = worse functioning. A Withdrawal score of 8/12 means substantial social withdrawal (NOT good social engagement). A Self-Care score of 9/15 means moderate-to-severe self-care deficits (NOT a strength). A score of 0 in any subscale means no disability in that domain.
      </div>

      <div className="p-3 bg-muted/30 border border-border rounded-lg text-xs text-muted-foreground leading-relaxed">
        <strong className="text-foreground">Interpretation:</strong> The LSP-16 total score ranges from 0 (good functioning across all domains) to 48 (extreme disability across all domains). Items with missing data are excluded. Subscale scores allow profiling of specific areas: Withdrawal (social engagement), Self-Care (personal maintenance and work capacity), Compliance (medication and health service cooperation), and Anti-Social behaviour (aggression, offensiveness, irresponsibility). Assess over the past 3 months, excluding crisis periods.
      </div>

      <p className="text-[10px] text-muted-foreground/50 text-center">
        LSP-16 — Abbreviated Life Skills Profile. Rosen et al. For clinical use only.
      </p>
    </div>
  );
}
