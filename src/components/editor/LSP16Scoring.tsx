import { useState, useMemo } from "react";

interface LSP16ScoringProps {
  scores: Record<string, string>;
  onUpdateScores: (scores: Record<string, string>) => void;
}

const SUBSCALES: Record<string, { name: string; max: number; items: number[] }> = {
  withdrawal: { name: "A. Withdrawal", max: 12, items: [1, 2, 3, 8] },
  selfcare: { name: "B. Self-Care", max: 15, items: [4, 5, 6, 9, 16] },
  compliance: { name: "C. Compliance", max: 9, items: [10, 11, 12] },
  antisocial: { name: "D. Anti-Social", max: 12, items: [7, 13, 14, 15] },
};

const ITEMS = [
  { num: 1, subscale: "withdrawal", text: "Does this person generally have any difficulty with initiating and responding to conversation?", anchors: ["No difficulty", "Slight difficulty", "Moderate difficulty", "Extreme difficulty"] },
  { num: 2, subscale: "withdrawal", text: "Does this person generally withdraw from social contact?", anchors: ["Does not withdraw at all", "Withdraws slightly", "Withdraws moderately", "Withdraws totally or near totally"] },
  { num: 3, subscale: "withdrawal", text: "Does this person generally show warmth to others?", anchors: ["Considerable warmth", "Moderate warmth", "Slight warmth", "No warmth at all"] },
  { num: 4, subscale: "selfcare", text: "Is this person generally well groomed (e.g. neatly dressed, hair combed)?", anchors: ["Well groomed", "Moderately well groomed", "Poorly groomed", "Extremely poorly groomed"] },
  { num: 5, subscale: "selfcare", text: "Does this person wear clean clothes generally, or ensure that they are cleaned if dirty?", anchors: ["Maintains cleanliness", "Moderate cleanliness", "Poor cleanliness", "Very poor cleanliness"] },
  { num: 6, subscale: "selfcare", text: "Does this person generally neglect her or his physical health?", anchors: ["No neglect", "Slight neglect", "Moderate neglect", "Extreme neglect"] },
  { num: 7, subscale: "antisocial", text: "Is this person violent to others?", anchors: ["Not at all", "Rarely", "Occasionally", "Often"] },
  { num: 8, subscale: "withdrawal", text: "Does this person generally make and/or keep up friendships?", anchors: ["Well", "With slight difficulty", "With considerable difficulty", "No friendships"] },
  { num: 9, subscale: "selfcare", text: "Does this person generally maintain an adequate diet?", anchors: ["No problem", "Slight problem", "Moderate problem", "Extreme problem"] },
  { num: 10, subscale: "compliance", text: "Does this person generally look after and take prescribed medication without reminding?", anchors: ["Reliable", "Slightly unreliable", "Moderately unreliable", "Extremely unreliable"] },
  { num: 11, subscale: "compliance", text: "Is this person willing to take psychiatric medication when prescribed?", anchors: ["Always", "Usually", "Rarely", "Never"] },
  { num: 12, subscale: "compliance", text: "Does this person co-operate with health services?", anchors: ["Always", "Usually", "Rarely", "Never"] },
  { num: 13, subscale: "antisocial", text: "Does this person generally have problems living with others in the household?", anchors: ["No obvious problem", "Slight problems", "Moderate problems", "Extreme problems"] },
  { num: 14, subscale: "antisocial", text: "Does this person behave offensively (includes sexual behaviour)?", anchors: ["Not at all", "Rarely", "Occasionally", "Often"] },
  { num: 15, subscale: "antisocial", text: "Does this person behave irresponsibly?", anchors: ["Not at all", "Rarely", "Occasionally", "Often"] },
  { num: 16, subscale: "selfcare", text: "What sort of work is this person generally capable of?", anchors: ["Full time work", "Part time work", "Sheltered work only", "Totally incapable"] },
];

const SUBSCALE_ORDER = ["withdrawal", "selfcare", "compliance", "antisocial"];

function getSeverityLabel(percent: number) {
  if (percent === 0) return { label: "No disability", className: "text-green-600" };
  if (percent <= 25) return { label: "Mild", className: "text-lime-600" };
  if (percent <= 50) return { label: "Moderate", className: "text-yellow-600" };
  if (percent <= 75) return { label: "Severe", className: "text-orange-600" };
  return { label: "Extreme", className: "text-red-600" };
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-foreground">{answeredCount}/16 items scored</span>
        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${(answeredCount / 16) * 100}%` }} />
        </div>
      </div>

      <div className="flex gap-4 text-[11px] text-muted-foreground flex-wrap">
        <span><span className="font-mono font-semibold">0</span> = Good functioning</span>
        <span><span className="font-mono font-semibold">1</span> = Slight difficulty</span>
        <span><span className="font-mono font-semibold">2</span> = Moderate difficulty</span>
        <span><span className="font-mono font-semibold">3</span> = Extreme difficulty</span>
      </div>

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
                <span className="text-sm font-bold text-foreground">{sub.name}</span>
                <span className="text-[11px] text-muted-foreground">({r.answered}/{r.total})</span>
              </div>
              <div className="flex items-center gap-2">
                {r.percent !== null && (
                  <>
                    <span className="font-mono text-sm font-bold text-accent">{r.sum}/{r.max}</span>
                    {r.severity && <span className={`text-[10px] font-bold uppercase ${r.severity.className}`}>{r.severity.label}</span>}
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
                        {item.anchors.map((anchor, i) => {
                          const isSelected = selected === i;
                          const colorClasses = [
                            'border-green-300 bg-green-50', 'border-yellow-300 bg-yellow-50',
                            'border-orange-300 bg-orange-50', 'border-red-300 bg-red-50',
                          ];
                          const activeClasses = [
                            'bg-green-600 border-green-600', 'bg-yellow-600 border-yellow-600',
                            'bg-orange-600 border-orange-600', 'bg-red-600 border-red-600',
                          ];
                          return (
                            <button
                              key={i}
                              onClick={() => setScore(item.num, i)}
                              className={`flex-1 min-w-0 px-1 py-1.5 rounded-md border-[1.5px] text-center transition-colors ${
                                isSelected ? `${activeClasses[i]} text-white font-bold` : `${colorClasses[i]} text-foreground/70`
                              }`}
                            >
                              <div className="font-mono text-xs font-bold">{i}</div>
                              <div className="text-[10px] leading-tight">{anchor}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
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
          <span className="text-[11px] opacity-70">Higher scores = greater disability</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Subscale</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground w-16">Items</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground w-20">Score</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground w-16">%</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground w-24">Severity</th>
            </tr>
          </thead>
          <tbody>
            {SUBSCALE_ORDER.map((key, idx) => {
              const sub = SUBSCALES[key];
              const r = subscaleResults[key];
              return (
                <tr key={key} className={idx % 2 === 0 ? '' : 'bg-muted/10'}>
                  <td className="px-3 py-2 border-t border-border/20 font-medium text-foreground/80">{sub.name}</td>
                  <td className="px-3 py-2 border-t border-border/20 text-center font-mono text-muted-foreground">{r.answered}/{r.total}</td>
                  <td className="px-3 py-2 border-t border-border/20 text-center font-mono font-bold text-accent">{r.answered > 0 ? r.sum : "—"}<span className="text-muted-foreground font-normal">/{r.max}</span></td>
                  <td className="px-3 py-2 border-t border-border/20 text-center font-mono">{r.percent !== null ? `${r.percent.toFixed(0)}%` : "—"}</td>
                  <td className="px-3 py-2 border-t border-border/20 text-center">
                    {r.severity ? <span className={`text-[10px] font-bold uppercase ${r.severity.className}`}>{r.severity.label}</span> : "—"}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-foreground text-background">
              <td className="px-3 py-2 font-bold">Total</td>
              <td className="px-3 py-2 text-center font-mono">{answeredCount}/16</td>
              <td className="px-3 py-2 text-center font-mono font-bold text-lg">{totalResult ? totalResult.sum : "—"}<span className="text-xs opacity-60">/48</span></td>
              <td className="px-3 py-2 text-center font-mono font-bold">{totalResult ? `${totalResult.percent.toFixed(0)}%` : "—"}</td>
              <td className="px-3 py-2 text-center">
                {totalResult ? <span className="text-[10px] font-bold uppercase">{totalResult.severity.label}</span> : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
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
