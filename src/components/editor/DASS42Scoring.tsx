import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

const ITEM_MAP: Record<number, string> = {
  1: "S", 2: "A", 3: "D", 4: "A", 5: "D", 6: "S", 7: "A",
  8: "S", 9: "A", 10: "D", 11: "S", 12: "S", 13: "D", 14: "S",
  15: "A", 16: "D", 17: "D", 18: "S", 19: "A", 20: "A", 21: "D",
  22: "S", 23: "A", 24: "D", 25: "A", 26: "D", 27: "S", 28: "A",
  29: "S", 30: "A", 31: "D", 32: "S", 33: "S", 34: "D", 35: "S",
  36: "A", 37: "D", 38: "D", 39: "S", 40: "A", 41: "A", 42: "D",
};

export const DASS42_SUBSCALES = [
  {
    id: "depression", name: "Depression", short: "D",
    items: [3, 5, 10, 13, 16, 17, 21, 24, 26, 31, 34, 37, 38, 42],
    thresholds: [
      { max: 9, label: "Normal" }, { max: 13, label: "Mild" },
      { max: 20, label: "Moderate" }, { max: 27, label: "Severe" },
      { max: 999, label: "Extremely Severe" },
    ],
  },
  {
    id: "anxiety", name: "Anxiety", short: "A",
    items: [2, 4, 7, 9, 15, 19, 20, 23, 25, 28, 30, 36, 40, 41],
    thresholds: [
      { max: 7, label: "Normal" }, { max: 9, label: "Mild" },
      { max: 14, label: "Moderate" }, { max: 19, label: "Severe" },
      { max: 999, label: "Extremely Severe" },
    ],
  },
  {
    id: "stress", name: "Stress", short: "S",
    items: [1, 6, 8, 11, 12, 14, 18, 22, 27, 29, 32, 33, 35, 39],
    thresholds: [
      { max: 14, label: "Normal" }, { max: 18, label: "Mild" },
      { max: 25, label: "Moderate" }, { max: 33, label: "Severe" },
      { max: 999, label: "Extremely Severe" },
    ],
  },
];

const ITEMS = [
  { num: 1, text: "I found myself getting upset by quite trivial things" },
  { num: 2, text: "I was aware of dryness of my mouth" },
  { num: 3, text: "I couldn't seem to experience any positive feeling at all" },
  { num: 4, text: "I experienced breathing difficulty" },
  { num: 5, text: "I just couldn't seem to get going" },
  { num: 6, text: "I tended to over-react to situations" },
  { num: 7, text: "I had a feeling of shakiness (e.g., legs going to give way)" },
  { num: 8, text: "I found it difficult to relax" },
  { num: 9, text: "I found myself in situations that made me so anxious I was most relieved when they ended" },
  { num: 10, text: "I felt that I had nothing to look forward to" },
  { num: 11, text: "I found myself getting upset rather easily" },
  { num: 12, text: "I felt that I was using a lot of nervous energy" },
  { num: 13, text: "I felt sad and depressed" },
  { num: 14, text: "I found myself getting impatient when I was delayed in any way" },
  { num: 15, text: "I had a feeling of faintness" },
  { num: 16, text: "I felt that I had lost interest in just about everything" },
  { num: 17, text: "I felt I wasn't worth much as a person" },
  { num: 18, text: "I felt that I was rather touchy" },
  { num: 19, text: "I perspired noticeably in the absence of high temperatures or physical exertion" },
  { num: 20, text: "I felt scared without any good reason" },
  { num: 21, text: "I felt that life wasn't worthwhile" },
  { num: 22, text: "I found it hard to wind down" },
  { num: 23, text: "I had difficulty in swallowing" },
  { num: 24, text: "I couldn't seem to get any enjoyment out of the things I did" },
  { num: 25, text: "I was aware of the action of my heart in the absence of physical exertion" },
  { num: 26, text: "I felt down-hearted and blue" },
  { num: 27, text: "I found that I was very irritable" },
  { num: 28, text: "I felt I was close to panic" },
  { num: 29, text: "I found it hard to calm down after something upset me" },
  { num: 30, text: "I feared that I would be 'thrown' by some trivial but unfamiliar task" },
  { num: 31, text: "I was unable to become enthusiastic about anything" },
  { num: 32, text: "I found it difficult to tolerate interruptions to what I was doing" },
  { num: 33, text: "I was in a state of nervous tension" },
  { num: 34, text: "I felt I was pretty worthless" },
  { num: 35, text: "I was intolerant of anything that kept me from getting on with what I was doing" },
  { num: 36, text: "I felt terrified" },
  { num: 37, text: "I could see nothing in the future to be hopeful about" },
  { num: 38, text: "I felt that life was meaningless" },
  { num: 39, text: "I found myself getting agitated" },
  { num: 40, text: "I was worried about situations in which I might panic and make a fool of myself" },
  { num: 41, text: "I experienced trembling (e.g., in the hands)" },
  { num: 42, text: "I found it difficult to work up the initiative to do things" },
];

const SCORE_LABELS = [
  { value: 0, label: "Did not apply" },
  { value: 1, label: "Some degree" },
  { value: 2, label: "Considerable" },
  { value: 3, label: "Very much" },
];

function getClassification(thresholds: { max: number; label: string }[], score: number) {
  for (const t of thresholds) {
    if (score <= t.max) return t.label;
  }
  return thresholds[thresholds.length - 1]?.label || "Unknown";
}

interface DASS42ScoringProps {
  scores: Record<string, string>;
  onUpdateScores: (scores: Record<string, string>) => void;
}

export function DASS42Scoring({ scores, onUpdateScores }: DASS42ScoringProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const setScore = (itemNum: number, value: number) => {
    onUpdateScores({ ...scores, [String(itemNum)]: String(value) });
  };

  const subscaleResults = useMemo(() => {
    return DASS42_SUBSCALES.map((sub) => {
      const answered = sub.items.filter((i) => scores[String(i)] !== undefined && scores[String(i)] !== "");
      const sum = answered.reduce((acc, i) => acc + (parseInt(scores[String(i)]) || 0), 0);
      const max = sub.items.length * 3;
      const classification = answered.length > 0 ? getClassification(sub.thresholds, sum) : null;
      return { ...sub, sum, max, answered: answered.length, total: sub.items.length, classification };
    });
  }, [scores]);

  const answeredCount = Object.keys(scores).filter(k => !k.startsWith("__") && scores[k] !== "").length;

  const subscaleGroups = DASS42_SUBSCALES.map((sub) => ({
    ...sub,
    items: sub.items.map((num) => ITEMS.find((i) => i.num === num)!),
  }));

  const subscaleColors: Record<string, string> = {
    depression: "bg-blue-500",
    anxiety: "bg-red-500",
    stress: "bg-violet-500",
  };

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">{answeredCount}/42 items scored</span>
        <button
          onClick={() => onUpdateScores({})}
          className="text-xs px-2 py-1 rounded border border-border/50 hover:bg-muted/50 transition-colors"
        >
          Clear all
        </button>
      </div>

      {/* Score legend */}
      <div className="flex gap-3 p-2.5 bg-muted/30 rounded-md flex-wrap">
        {SCORE_LABELS.map((s) => (
          <div key={s.value} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-bold font-mono text-foreground">{s.value}</span>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Subscale sections */}
      {subscaleGroups.map((sub) => {
        const isCollapsed = collapsed[sub.id];
        const result = subscaleResults.find((r) => r.id === sub.id)!;
        return (
          <div key={sub.id} className="border border-border/50 rounded-lg overflow-hidden">
            <button
              onClick={() => setCollapsed(prev => ({ ...prev, [sub.id]: !prev[sub.id] }))}
              className="w-full px-4 py-2.5 bg-muted/30 flex justify-between items-center text-left hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className={cn("w-1 h-5 rounded-sm", subscaleColors[sub.id])} />
                <span className="text-sm font-semibold text-foreground">{sub.name}</span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  ({sub.short}) — {result.answered}/{result.total} items
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                {result.classification && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent/10 text-accent uppercase tracking-wider">
                    {result.classification}
                  </span>
                )}
                {result.answered > 0 && (
                  <span className="text-xs font-bold font-mono text-foreground">
                    {result.sum}/{result.max}
                  </span>
                )}
                <span className={cn("text-muted-foreground transition-transform text-xs", isCollapsed && "-rotate-90")}>
                  ▼
                </span>
              </div>
            </button>

            {!isCollapsed && (
              <div>
                {sub.items.map((item, idx) => (
                  <div
                    key={item.num}
                    className={cn(
                      "flex justify-between items-center px-4 py-2 gap-3",
                      idx % 2 === 0 ? "bg-background" : "bg-muted/10",
                      idx < sub.items.length - 1 && "border-b border-border/20"
                    )}
                  >
                    <div className="flex items-start gap-2.5 flex-1">
                      <span className="text-[11px] font-mono text-muted-foreground min-w-[24px] pt-0.5">
                        {item.num}
                      </span>
                      <span className="text-xs text-foreground/80 leading-relaxed">{item.text}</span>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {SCORE_LABELS.map((sl) => {
                        const selected = scores[String(item.num)] === String(sl.value);
                        return (
                          <button
                            key={sl.value}
                            onClick={() => setScore(item.num, sl.value)}
                            title={sl.label}
                            className={cn(
                              "w-9 h-8 rounded-md text-xs font-medium transition-all border",
                              selected
                                ? "bg-accent text-accent-foreground border-accent font-bold"
                                : "bg-background border-border/50 text-muted-foreground hover:bg-muted/50"
                            )}
                          >
                            {sl.value}
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

      {/* Summary table */}
      <div className="border border-border/50 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-foreground text-background">
          <h3 className="text-sm font-bold">Scoring Summary</h3>
          <span className="text-[10px] opacity-70">DASS-42 — Lovibond & Lovibond (1995)</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Subscale</th>
              <th className="text-center px-3 py-2 font-semibold text-muted-foreground w-14">Items</th>
              <th className="text-center px-3 py-2 font-semibold text-muted-foreground w-16">Score</th>
              <th className="text-center px-3 py-2 font-semibold text-muted-foreground w-14">Max</th>
              <th className="text-center px-3 py-2 font-semibold text-muted-foreground w-28">Classification</th>
            </tr>
          </thead>
          <tbody>
            {subscaleResults.map((sub, idx) => (
              <tr key={sub.id} className={idx % 2 === 0 ? "bg-background" : "bg-muted/10"}>
                <td className="px-3 py-2 border-t border-border/20">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-0.5 h-4 rounded-sm", subscaleColors[sub.id])} />
                    <span className="font-medium text-foreground">{sub.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">({sub.short})</span>
                  </div>
                </td>
                <td className="text-center px-3 py-2 border-t border-border/20 font-mono text-muted-foreground">
                  {sub.answered}/{sub.total}
                </td>
                <td className="text-center px-3 py-2 border-t border-border/20 font-mono font-bold">
                  {sub.answered > 0 ? sub.sum : "—"}
                </td>
                <td className="text-center px-3 py-2 border-t border-border/20 font-mono text-muted-foreground">
                  {sub.max}
                </td>
                <td className="text-center px-3 py-2 border-t border-border/20">
                  {sub.classification ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent/10 text-accent uppercase tracking-wider">
                      {sub.classification}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Extracts DASS-42 summary data from scores for report generation.
 */
export function getDASS42Summary(scores: Record<string, string>) {
  return DASS42_SUBSCALES.map((sub) => {
    const answered = sub.items.filter((i) => scores[String(i)] !== undefined && scores[String(i)] !== "");
    const sum = answered.reduce((acc, i) => acc + (parseInt(scores[String(i)]) || 0), 0);
    const max = sub.items.length * 3;
    const classification = answered.length > 0 ? getClassification(sub.thresholds, sum) : "Not assessed";
    return { name: sub.name, short: sub.short, sum, max, answered: answered.length, total: sub.items.length, classification };
  });
}
