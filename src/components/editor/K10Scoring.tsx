import { useMemo } from "react";
import type { AssessmentScoreSummary } from "@/lib/assessment-library";

interface K10ScoringProps {
  scores: Record<string, string>;
  onUpdateScores: (scores: Record<string, string>) => void;
}

/*
 * Kessler Psychological Distress Scale (K10)
 * Kessler et al., 2002. 10 items, self-report, past 4 weeks.
 * Each item scored 1 (None of the time) to 5 (All of the time). Total /50.
 * Australian classification bands per ABS / clinical convention.
 */

const K10_ITEMS = [
  { num: 1, text: "About how often did you feel tired out for no good reason?", short: "Tired for no reason" },
  { num: 2, text: "About how often did you feel nervous?", short: "Nervous" },
  { num: 3, text: "About how often did you feel so nervous that nothing could calm you down?", short: "Nervous, uncalmable" },
  { num: 4, text: "About how often did you feel hopeless?", short: "Hopeless" },
  { num: 5, text: "About how often did you feel restless or fidgety?", short: "Restless / fidgety" },
  { num: 6, text: "About how often did you feel so restless you could not sit still?", short: "Restless, can't sit still" },
  { num: 7, text: "About how often did you feel depressed?", short: "Depressed" },
  { num: 8, text: "About how often did you feel that everything was an effort?", short: "Everything an effort" },
  { num: 9, text: "About how often did you feel so sad that nothing could cheer you up?", short: "Sad, uncheerable" },
  { num: 10, text: "About how often did you feel worthless?", short: "Worthless" },
];

const RESPONSE_OPTIONS = [
  { score: 1, label: "None of the time" },
  { score: 2, label: "A little of the time" },
  { score: 3, label: "Some of the time" },
  { score: 4, label: "Most of the time" },
  { score: 5, label: "All of the time" },
];

function classifyK10(total: number) {
  if (total < 20) return "Likely to be well";
  if (total < 25) return "Mild psychological distress";
  if (total < 30) return "Moderate psychological distress";
  return "Severe psychological distress";
}

/**
 * Unified score summary for the AI prompt builder.
 */
export function getK10ScoreSummary(scores: Record<string, string>): AssessmentScoreSummary {
  let sum = 0;
  let answered = 0;
  for (let i = 1; i <= 10; i++) {
    const val = scores[String(i)];
    if (val !== undefined && val !== "") {
      sum += parseInt(val);
      answered++;
    }
  }

  const itemsTotal = 10;
  const isComplete = answered === itemsTotal;
  const total = answered > 0 ? `${sum}/50` : "";
  let classification = "";

  if (isComplete) {
    classification = classifyK10(sum);
  } else if (answered > 0) {
    classification = `Incomplete (${answered}/${itemsTotal})`;
  }

  return {
    rows: [],
    total,
    classification,
    isComplete,
    itemsAnswered: answered,
    itemsTotal,
    scoringDirection:
      "K10: HIGHER scores = GREATER psychological distress. <20 = likely well, 20–24 = mild, 25–29 = moderate, 30–50 = severe distress (past 4 weeks).",
  };
}

export function K10Scoring({ scores, onUpdateScores }: K10ScoringProps) {
  const setScore = (itemNum: number, value: number) => {
    onUpdateScores({ ...scores, [String(itemNum)]: String(value) });
  };

  const getItemScore = (num: number): number | undefined => {
    const val = scores[String(num)];
    return val !== undefined && val !== "" ? parseInt(val) : undefined;
  };

  const answeredCount = K10_ITEMS.filter((i) => getItemScore(i.num) !== undefined).length;

  const { totalSum, classificationLabel } = useMemo(() => {
    const sum = K10_ITEMS.reduce((acc, i) => {
      const s = getItemScore(i.num);
      return acc + (s !== undefined ? s : 0);
    }, 0);
    const label = answeredCount === 10 ? classifyK10(sum) : null;
    return { totalSum: sum, classificationLabel: label };
  }, [scores, answeredCount]);

  const classColor = (() => {
    if (!classificationLabel) return "text-muted-foreground";
    if (classificationLabel.startsWith("Likely")) return "text-green-600";
    if (classificationLabel.startsWith("Mild")) return "text-yellow-600";
    if (classificationLabel.startsWith("Moderate")) return "text-orange-600";
    return "text-red-600";
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-foreground">{answeredCount}/10 items scored</span>
        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all"
            style={{ width: `${(answeredCount / 10) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex gap-3 text-[11px] text-muted-foreground flex-wrap">
        {RESPONSE_OPTIONS.map((s) => (
          <span key={s.score}>
            <span className="font-mono font-semibold text-foreground/60">{s.score}</span> = {s.label}
          </span>
        ))}
      </div>

      <div className="border border-border/50 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/20 border-b border-border/30 flex justify-between items-center">
          <span className="text-sm font-bold text-foreground">K10 Items (past 4 weeks)</span>
          <span className="text-[11px] text-muted-foreground">{answeredCount}/10</span>
        </div>
        <div>
          {K10_ITEMS.map((item, idx) => {
            const selected = getItemScore(item.num);
            return (
              <div
                key={item.num}
                className={`px-4 py-2.5 ${idx % 2 === 0 ? "" : "bg-muted/10"} border-b border-border/10 last:border-b-0`}
              >
                <div className="flex items-start gap-2 mb-2">
                  <span className="font-mono text-[11px] text-muted-foreground min-w-[22px] text-right mt-0.5">
                    {item.num}.
                  </span>
                  <span className="text-xs text-foreground leading-relaxed">{item.text}</span>
                </div>
                <div className="flex gap-1 ml-6 flex-wrap">
                  {RESPONSE_OPTIONS.map((s) => {
                    const isSelected = selected === s.score;
                    const colorClasses = [
                      "border-green-300 bg-green-50",
                      "border-emerald-300 bg-emerald-50",
                      "border-yellow-300 bg-yellow-50",
                      "border-orange-300 bg-orange-50",
                      "border-red-300 bg-red-50",
                    ];
                    const activeClasses = [
                      "bg-green-600 border-green-600",
                      "bg-emerald-600 border-emerald-600",
                      "bg-yellow-600 border-yellow-600",
                      "bg-orange-600 border-orange-600",
                      "bg-red-600 border-red-600",
                    ];
                    const idx2 = s.score - 1;
                    return (
                      <button
                        key={s.score}
                        onClick={() => setScore(item.num, s.score)}
                        title={s.label}
                        className={`flex flex-col items-center min-w-[88px] flex-1 px-1 py-1 rounded-md border-[1.5px] text-[10px] transition-colors ${
                          isSelected
                            ? `${activeClasses[idx2]} text-white font-bold`
                            : `${colorClasses[idx2]} text-foreground/70`
                        }`}
                      >
                        <span className="font-mono text-sm font-bold">{s.score}</span>
                        <span className="leading-tight">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="border-2 border-foreground/20 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-foreground text-background">
          <h3 className="text-sm font-bold">Scoring Summary</h3>
          <span className="text-[11px] opacity-70">
            1 = None of the time · 5 = All of the time · Higher = greater distress
          </span>
        </div>
        <div className="p-4 text-center">
          <span className="font-mono text-3xl font-bold text-foreground">{totalSum}</span>
          <span className="text-sm text-muted-foreground">/50</span>
          <div className="text-xs text-muted-foreground mt-1">{answeredCount}/10 items scored</div>
        </div>
        {classificationLabel && (
          <div className="p-3 text-center border-t border-border/20">
            <span className={`text-xs font-bold uppercase ${classColor}`}>{classificationLabel}</span>
          </div>
        )}
        <div className="px-4 py-2 border-t border-border/20 flex gap-4 justify-center text-[10px] text-muted-foreground flex-wrap">
          <span><strong>Likely well</strong>: 10–19</span>
          <span><strong>Mild</strong>: 20–24</span>
          <span><strong>Moderate</strong>: 25–29</span>
          <span><strong>Severe</strong>: 30–50</span>
        </div>
      </div>
    </div>
  );
}
