import { useMemo } from "react";

interface ZaritScoringProps {
  scores: Record<string, string>;
  onUpdateScores: (scores: Record<string, string>) => void;
}

const ITEMS = [
  { num: 1, text: "Do you feel stressed between caring for your relative and trying to meet other responsibilities for your family or work?" },
  { num: 2, text: "Do you feel embarrassed by your relative's behavior?" },
  { num: 3, text: "Do you feel angry when you are around your relative?" },
  { num: 4, text: "Do you feel that your relative currently affects your relationship with other family members or friends in a negative way?" },
  { num: 5, text: "Are you afraid what the future holds for your relative?" },
  { num: 6, text: "Do you feel strained when you are around your relative?" },
  { num: 7, text: "Do you feel that you do not have as much privacy as you would like because of your relative?" },
  { num: 8, text: "Do you feel that your social life has suffered because you are caring for your relative?" },
  { num: 9, text: "Do you feel uncomfortable about having friends over because of your relative?" },
  { num: 10, text: "Do you feel that you have lost control of your life since your relative's illness?" },
  { num: 11, text: "Do you wish you could just leave the care of your relative to someone else?" },
  { num: 12, text: "Do you feel uncertain about what to do about your relative?" },
  { num: 13, text: "Do you feel that you should be doing more for your relative?" },
  { num: 14, text: "Do you feel you could do a better job in caring for your relative?" },
  { num: 15, text: "Overall, how burdened do you feel in caring for your relative?" },
  { num: 16, text: "Do you feel that your relative asks for more help than he/she needs?" },
  { num: 17, text: "Do you feel that because of the time you spend with your relative that you do not have enough time for yourself?" },
  { num: 18, text: "Do you feel your relative is dependent upon you?" },
  { num: 19, text: "Do you feel your health has suffered because of your involvement with your relative?" },
  { num: 20, text: "Do you feel that your relative seems to expect you to take care of him/her as if you were the only one he/she could depend on?" },
  { num: 21, text: "Do you feel that you will be unable to take care of your relative much longer?" },
  { num: 22, text: "Do you feel that you do not have enough money to care for your relative in addition to the rest of your expenses?" },
];

const SCORE_LABELS = [
  { value: 0, label: "Never" },
  { value: 1, label: "Rarely" },
  { value: 2, label: "Sometimes" },
  { value: 3, label: "Frequently" },
  { value: 4, label: "Nearly Always" },
];

function getBurdenLevel(score: number) {
  if (score <= 20) return { label: "No to Mild Burden", className: "text-green-600" };
  if (score <= 40) return { label: "Mild to Moderate Burden", className: "text-yellow-600" };
  if (score <= 60) return { label: "Moderate to Severe Burden", className: "text-orange-600" };
  return { label: "Severe Burden", className: "text-red-600" };
}

export function ZaritScoring({ scores, onUpdateScores }: ZaritScoringProps) {
  const setScore = (itemNum: number, value: number) => {
    onUpdateScores({ ...scores, [String(itemNum)]: String(value) });
  };

  const getItemScore = (num: number): number | undefined => {
    const val = scores[String(num)];
    return val !== undefined && val !== "" ? parseInt(val) : undefined;
  };

  const answeredCount = ITEMS.filter(i => getItemScore(i.num) !== undefined).length;

  const results = useMemo(() => {
    const totalSum = ITEMS.reduce((acc, i) => {
      const s = getItemScore(i.num);
      return acc + (s !== undefined ? s : 0);
    }, 0);
    const burden = answeredCount === 22 ? getBurdenLevel(totalSum) : null;
    return { totalSum, burden };
  }, [scores, answeredCount]);

  const renderGroup = (items: typeof ITEMS, label: string) => (
    <div className="border border-border/50 rounded-lg overflow-hidden mb-3">
      <div className="px-4 py-2.5 bg-muted/20 border-b border-border/30 flex justify-between items-center">
        <span className="text-sm font-bold text-foreground">{label}</span>
        <span className="text-[11px] text-muted-foreground">{items.filter(i => getItemScore(i.num) !== undefined).length}/{items.length}</span>
      </div>
      <div>
        {items.map((item, idx) => {
          const selected = getItemScore(item.num);
          return (
            <div key={item.num} className={`px-4 py-2.5 ${idx % 2 === 0 ? '' : 'bg-muted/10'} border-b border-border/10 last:border-b-0`}>
              <div className="flex items-start gap-2 mb-2">
                <span className="font-mono text-[11px] text-muted-foreground min-w-[22px] text-right mt-0.5">{item.num}.</span>
                <span className="text-xs text-foreground leading-relaxed">{item.text}</span>
              </div>
              <div className="flex gap-1 ml-6">
                {SCORE_LABELS.map(s => {
                  const isSelected = selected === s.value;
                  const colorClasses = [
                    'border-green-300 bg-green-50', 'border-emerald-300 bg-emerald-50',
                    'border-yellow-300 bg-yellow-50', 'border-orange-300 bg-orange-50',
                    'border-red-300 bg-red-50',
                  ];
                  const activeClasses = [
                    'bg-green-600 border-green-600', 'bg-emerald-600 border-emerald-600',
                    'bg-yellow-600 border-yellow-600', 'bg-orange-600 border-orange-600',
                    'bg-red-600 border-red-600',
                  ];
                  return (
                    <button
                      key={s.value}
                      onClick={() => setScore(item.num, s.value)}
                      title={s.label}
                      className={`flex flex-col items-center min-w-[52px] px-1 py-1 rounded-md border-[1.5px] text-[10px] transition-colors ${
                        isSelected
                          ? `${activeClasses[s.value]} text-white font-bold`
                          : `${colorClasses[s.value]} text-foreground/70`
                      }`}
                    >
                      <span className="font-mono text-sm font-bold">{s.value}</span>
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
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-foreground">{answeredCount}/22 items scored</span>
        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${(answeredCount / 22) * 100}%` }} />
        </div>
      </div>

      <div className="flex gap-3 text-[11px] text-muted-foreground flex-wrap">
        {SCORE_LABELS.map(s => (
          <span key={s.value}><span className="font-mono font-semibold text-foreground/60">{s.value}</span> = {s.label}</span>
        ))}
      </div>

      {renderGroup(ITEMS.filter(i => i.num <= 12), "Items 1–12")}
      {renderGroup(ITEMS.filter(i => i.num >= 13 && i.num <= 21), "Items 13–21")}
      {renderGroup(ITEMS.filter(i => i.num === 22), "Item 22 (Financial)")}

      {/* Summary */}
      <div className="border-2 border-foreground/20 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-foreground text-background">
          <h3 className="text-sm font-bold">Scoring Summary</h3>
          <span className="text-[11px] opacity-70">0 = Never · 4 = Nearly Always · Higher = greater burden</span>
        </div>
        <div className="p-4 text-center">
          <span className="font-mono text-3xl font-bold text-foreground">{results.totalSum}</span>
          <span className="text-sm text-muted-foreground">/88</span>
          <div className="text-xs text-muted-foreground mt-1">{answeredCount}/22 items scored</div>
        </div>
        {results.burden && (
          <div className="p-3 text-center border-t border-border/20">
            <span className={`text-xs font-bold uppercase ${results.burden.className}`}>{results.burden.label}</span>
          </div>
        )}
        <div className="px-4 py-2 border-t border-border/20 flex gap-4 justify-center text-[10px] text-muted-foreground flex-wrap">
          <span><strong>No to Mild</strong>: 0–20</span>
          <span><strong>Mild to Moderate</strong>: 21–40</span>
          <span><strong>Moderate to Severe</strong>: 41–60</span>
          <span><strong>Severe</strong>: 61–88</span>
        </div>
      </div>
    </div>
  );
}

export function getZaritSummary(scores: Record<string, string>) {
  let sum = 0; let answered = 0;
  for (let i = 1; i <= 22; i++) {
    const val = scores[String(i)];
    if (val !== undefined && val !== "") { sum += parseInt(val); answered++; }
  }
  let level = "Incomplete";
  if (answered === 22) {
    if (sum <= 20) level = "No to Mild Burden";
    else if (sum <= 40) level = "Mild to Moderate Burden";
    else if (sum <= 60) level = "Moderate to Severe Burden";
    else level = "Severe Burden";
  }
  return { sum, answered, level };
}
