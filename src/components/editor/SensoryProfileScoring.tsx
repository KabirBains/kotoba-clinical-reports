import { useState, useMemo } from "react";

interface SensoryProfileScoringProps {
  scores: Record<string, string>;
  onUpdateScores: (scores: Record<string, string>) => void;
}

const SECTIONS = [
  {
    id: "A", name: "A. Taste/Smell Processing", items: [
      { num: 1, text: "I leave or move when I smell a strong odor in a store.", quadrant: "avoiding" },
      { num: 2, text: "I add spice to my food.", quadrant: "seeking" },
      { num: 3, text: "I don't smell things that other people say they smell.", quadrant: "registration" },
      { num: 4, text: "I enjoy being close to people who wear perfume or cologne.", quadrant: "seeking" },
      { num: 5, text: "I only eat familiar foods.", quadrant: "avoiding" },
      { num: 6, text: "Many foods taste bland to me.", quadrant: "registration" },
      { num: 7, text: "I don't like strong tasting mints or candies.", quadrant: "sensitivity" },
      { num: 8, text: "I go over to smell fresh flowers when I see them.", quadrant: "seeking" },
    ],
  },
  {
    id: "B", name: "B. Movement Processing", items: [
      { num: 9, text: "I'm afraid of heights.", quadrant: "sensitivity" },
      { num: 10, text: "I enjoy how it feels to move about.", quadrant: "seeking" },
      { num: 11, text: "I avoid elevators/escalators because I dislike the movement.", quadrant: "avoiding" },
      { num: 12, text: "I trip or bump into things.", quadrant: "registration" },
      { num: 13, text: "I dislike the movement of riding in a car.", quadrant: "sensitivity" },
      { num: 14, text: "I choose to engage in physical activities.", quadrant: "seeking" },
      { num: 15, text: "I am unsure of footing when walking on stairs.", quadrant: "registration" },
      { num: 16, text: "I become dizzy easily.", quadrant: "sensitivity" },
    ],
  },
  {
    id: "C", name: "C. Visual Processing", items: [
      { num: 17, text: "I like to go to places that have bright lights and are colorful.", quadrant: "seeking" },
      { num: 18, text: "I keep the shades down during the day.", quadrant: "avoiding" },
      { num: 19, text: "I like to wear colorful clothing.", quadrant: "seeking" },
      { num: 20, text: "I become frustrated when trying to find something in a crowded drawer.", quadrant: "sensitivity" },
      { num: 21, text: "I miss street/building/room signs when going somewhere new.", quadrant: "registration" },
      { num: 22, text: "I am bothered by unsteady or fast moving visual images.", quadrant: "sensitivity" },
      { num: 23, text: "I don't notice when people come into the room.", quadrant: "registration" },
      { num: 24, text: "I choose to shop in smaller stores because I'm overwhelmed in large stores.", quadrant: "avoiding" },
      { num: 25, text: "I become bothered when I see lots of movement around me.", quadrant: "sensitivity" },
      { num: 26, text: "I limit distractions when working.", quadrant: "avoiding" },
    ],
  },
  {
    id: "D", name: "D. Touch Processing", items: [
      { num: 27, text: "I dislike having my back rubbed.", quadrant: "sensitivity" },
      { num: 28, text: "I like how it feels to get my hair cut.", quadrant: "seeking" },
      { num: 29, text: "I avoid or wear gloves during activities that will make my hands messy.", quadrant: "avoiding" },
      { num: 30, text: "I touch others when talking.", quadrant: "seeking" },
      { num: 31, text: "I am bothered by the feeling in my mouth when I wake up.", quadrant: "sensitivity" },
      { num: 32, text: "I like to go barefoot.", quadrant: "seeking" },
      { num: 33, text: "I'm uncomfortable wearing certain fabrics.", quadrant: "sensitivity" },
      { num: 34, text: "I don't like particular food textures.", quadrant: "sensitivity" },
      { num: 35, text: "I move away when others get too close.", quadrant: "avoiding" },
      { num: 36, text: "I don't seem to notice when my face or hands are dirty.", quadrant: "registration" },
      { num: 37, text: "I get scrapes or bruises but don't remember how.", quadrant: "registration" },
      { num: 38, text: "I avoid standing in lines or close to other people.", quadrant: "avoiding" },
      { num: 39, text: "I don't notice when someone touches my arm or back.", quadrant: "registration" },
    ],
  },
  {
    id: "E", name: "E. Activity Level", items: [
      { num: 40, text: "I work on two or more tasks at the same time.", quadrant: "seeking" },
      { num: 41, text: "It takes me more time to wake up in the morning.", quadrant: "registration" },
      { num: 42, text: "I do things on the spur of the moment.", quadrant: "seeking" },
      { num: 43, text: "I find time to get away from my busy life.", quadrant: "avoiding" },
      { num: 44, text: "I seem slower than others when following an activity.", quadrant: "registration" },
      { num: 45, text: "I don't get jokes as quickly as others.", quadrant: "registration" },
      { num: 46, text: "I stay away from crowds.", quadrant: "avoiding" },
      { num: 47, text: "I find activities to perform in front of others.", quadrant: "seeking" },
      { num: 48, text: "I find it hard to concentrate for the whole time in a long meeting.", quadrant: "sensitivity" },
      { num: 49, text: "I avoid situations where unexpected things might happen.", quadrant: "avoiding" },
    ],
  },
  {
    id: "F", name: "F. Auditory Processing", items: [
      { num: 50, text: "I hum, whistle, sing, or make other noises.", quadrant: "seeking" },
      { num: 51, text: "I startle easily at unexpected or loud noises.", quadrant: "sensitivity" },
      { num: 52, text: "I have trouble following what people are saying when they talk fast.", quadrant: "registration" },
      { num: 53, text: "I leave the room when others are watching TV, or ask them to turn it down.", quadrant: "avoiding" },
      { num: 54, text: "I am distracted if there is a lot of noise around.", quadrant: "sensitivity" },
      { num: 55, text: "I don't notice when my name is called.", quadrant: "registration" },
      { num: 56, text: "I use strategies to drown out sound.", quadrant: "avoiding" },
      { num: 57, text: "I stay away from noisy settings.", quadrant: "avoiding" },
      { num: 58, text: "I like to attend events with a lot of music.", quadrant: "seeking" },
      { num: 59, text: "I have to ask people to repeat things.", quadrant: "registration" },
      { num: 60, text: "I find it difficult to work with background noise.", quadrant: "sensitivity" },
    ],
  },
];

const QUADRANTS: Record<string, { name: string; description: string; items: number[] }> = {
  registration: { name: "Low Registration", description: "Misses sensory input; slow to respond", items: [3,6,12,15,21,23,36,37,39,41,44,45,52,55,59] },
  seeking: { name: "Sensation Seeking", description: "Actively seeks sensory experiences", items: [2,4,8,10,14,17,19,28,30,32,40,42,47,50,58] },
  sensitivity: { name: "Sensory Sensitivity", description: "Detects sensory input easily; distracted", items: [7,9,13,16,20,22,25,27,31,33,34,48,51,54,60] },
  avoiding: { name: "Sensation Avoiding", description: "Limits sensory exposure; creates routines", items: [1,5,11,18,24,26,29,35,38,43,46,49,53,56,57] },
};

const NORMS: Record<string, Record<string, Record<string, [number, number]>>> = {
  "18-64": {
    registration: { muchLess: [15,18], less: [19,23], similar: [24,35], more: [36,44], muchMore: [45,75] },
    seeking: { muchLess: [15,35], less: [36,42], similar: [43,56], more: [57,62], muchMore: [63,75] },
    sensitivity: { muchLess: [15,18], less: [19,25], similar: [26,41], more: [42,48], muchMore: [49,75] },
    avoiding: { muchLess: [15,19], less: [20,26], similar: [27,41], more: [42,49], muchMore: [50,75] },
  },
  "11-17": {
    registration: { muchLess: [15,18], less: [19,26], similar: [27,40], more: [41,51], muchMore: [52,75] },
    seeking: { muchLess: [15,27], less: [28,41], similar: [42,58], more: [59,65], muchMore: [66,75] },
    sensitivity: { muchLess: [15,19], less: [20,25], similar: [26,40], more: [41,48], muchMore: [49,75] },
    avoiding: { muchLess: [15,18], less: [19,25], similar: [26,40], more: [41,48], muchMore: [49,75] },
  },
  "65+": {
    registration: { muchLess: [15,19], less: [20,26], similar: [27,40], more: [41,51], muchMore: [52,75] },
    seeking: { muchLess: [15,28], less: [29,39], similar: [40,52], more: [53,63], muchMore: [64,75] },
    sensitivity: { muchLess: [15,18], less: [19,25], similar: [26,41], more: [42,48], muchMore: [49,75] },
    avoiding: { muchLess: [15,18], less: [19,25], similar: [26,42], more: [43,49], muchMore: [50,75] },
  },
};

const CLASS_LABELS = [
  { key: "muchLess", label: "Much Less Than Most People", short: "− −" },
  { key: "less", label: "Less Than Most People", short: "−" },
  { key: "similar", label: "Similar To Most People", short: "=" },
  { key: "more", label: "More Than Most People", short: "+" },
  { key: "muchMore", label: "Much More Than Most People", short: "+ +" },
];

function getClassification(score: number, quadrantKey: string, ageGroup: string) {
  const norms = NORMS[ageGroup]?.[quadrantKey];
  if (!norms) return null;
  for (const cl of CLASS_LABELS) {
    const range = norms[cl.key];
    if (range && score >= range[0] && score <= range[1]) return cl;
  }
  return null;
}

const SCORE_OPTIONS = [
  { value: 1, label: "Almost Never" },
  { value: 2, label: "Seldom" },
  { value: 3, label: "Occasionally" },
  { value: 4, label: "Frequently" },
  { value: 5, label: "Almost Always" },
];

export function SensoryProfileScoring({ scores, onUpdateScores }: SensoryProfileScoringProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const ageGroup = scores["__age_group"] || "18-64";

  const getItemScore = (num: number): number | undefined => {
    const val = scores[String(num)];
    return val !== undefined && val !== "" ? parseInt(val) : undefined;
  };

  const setScore = (num: number, value: number) => {
    onUpdateScores({ ...scores, [String(num)]: String(value) });
  };

  const answeredCount = useMemo(() => {
    let count = 0;
    for (const section of SECTIONS) {
      for (const item of section.items) {
        if (getItemScore(item.num) !== undefined) count++;
      }
    }
    return count;
  }, [scores]);

  const quadrantResults = useMemo(() => {
    const results: Record<string, { sum: number; answered: number; total: number; classification: ReturnType<typeof getClassification> }> = {};
    for (const [key, q] of Object.entries(QUADRANTS)) {
      const answered = q.items.filter(n => getItemScore(n) !== undefined).length;
      const sum = q.items.reduce((acc, n) => acc + (getItemScore(n) || 0), 0);
      const classification = answered === q.items.length ? getClassification(sum, key, ageGroup) : null;
      results[key] = { sum, answered, total: q.items.length, classification };
    }
    return results;
  }, [scores, ageGroup]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-foreground">{answeredCount}/60 items scored</span>
          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${(answeredCount / 60) * 100}%` }} />
          </div>
        </div>
        <div className="flex gap-1.5 items-center">
          <label className="text-[11px] text-muted-foreground font-medium">Age group:</label>
          {["11-17", "18-64", "65+"].map(ag => (
            <button
              key={ag}
              onClick={() => onUpdateScores({ ...scores, __age_group: ag })}
              className={`text-[11px] px-2.5 py-1 rounded-md font-semibold border transition-colors ${
                ageGroup === ag ? 'bg-foreground text-background border-foreground' : 'bg-background text-muted-foreground border-border'
              }`}
            >{ag}</button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 text-[10px] text-muted-foreground flex-wrap">
        {SCORE_OPTIONS.map(s => (
          <span key={s.value}><span className="font-mono font-semibold text-foreground/60">{s.value}</span> = {s.label}</span>
        ))}
      </div>

      {SECTIONS.map(section => {
        const isCollapsed = collapsed[section.id];
        const sectionAnswered = section.items.filter(i => getItemScore(i.num) !== undefined).length;
        return (
          <div key={section.id} className="border border-border/50 rounded-lg overflow-hidden">
            <button
              onClick={() => setCollapsed(p => ({ ...p, [section.id]: !p[section.id] }))}
              className="w-full px-4 py-2.5 bg-muted/20 border-b border-border/30 flex justify-between items-center text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">{section.name}</span>
                <span className="text-[11px] text-muted-foreground">({sectionAnswered}/{section.items.length})</span>
              </div>
              <span className={`text-muted-foreground transition-transform ${isCollapsed ? '-rotate-90' : ''}`}>▾</span>
            </button>
            {!isCollapsed && (
              <div>
                {section.items.map((item, idx) => {
                  const selected = getItemScore(item.num);
                  const qKey = item.quadrant as string;
                  const qName = QUADRANTS[qKey]?.name || "";
                  return (
                    <div key={item.num} className={`flex items-center px-4 py-1.5 gap-2 ${idx % 2 === 0 ? 'bg-muted/5' : ''}`}>
                      <span className="font-mono text-[11px] text-muted-foreground min-w-[22px] text-right">{item.num}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground flex-shrink-0 w-8 text-center" title={qName}>
                        {qKey.charAt(0).toUpperCase()}
                      </span>
                      <span className="flex-1 text-xs text-foreground/80 leading-snug">{item.text}</span>
                      <div className="flex gap-0.5 flex-shrink-0">
                        {SCORE_OPTIONS.map(s => (
                          <button
                            key={s.value}
                            onClick={() => setScore(item.num, s.value)}
                            title={s.label}
                            className={`w-8 h-7 rounded text-xs font-bold border transition-colors ${
                              selected === s.value
                                ? 'bg-accent text-accent-foreground border-accent'
                                : 'bg-background border-border/50 text-muted-foreground/50 hover:border-accent/30'
                            }`}
                          >{s.value}</button>
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

      {/* Quadrant Summary */}
      <div className="border-2 border-foreground/20 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-foreground text-background">
          <h3 className="text-sm font-bold">Quadrant Scoring Summary</h3>
          <span className="text-[11px] opacity-70">15 items per quadrant · Max 75 · Norms: {ageGroup} years</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Quadrant</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground w-16">Items</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground w-20">Score</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground w-40">Classification</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(QUADRANTS).map(([key, q], idx) => {
              const r = quadrantResults[key];
              return (
                <tr key={key} className={idx % 2 === 0 ? '' : 'bg-muted/10'}>
                  <td className="px-3 py-2 border-t border-border/20">
                    <div className="font-medium text-foreground">{q.name}</div>
                    <div className="text-[10px] text-muted-foreground">{q.description}</div>
                  </td>
                  <td className="px-3 py-2 border-t border-border/20 text-center font-mono text-muted-foreground">{r.answered}/{r.total}</td>
                  <td className="px-3 py-2 border-t border-border/20 text-center font-mono font-bold text-accent">
                    {r.answered > 0 ? r.sum : "—"}<span className="text-muted-foreground font-normal">/75</span>
                  </td>
                  <td className="px-3 py-2 border-t border-border/20 text-center">
                    {r.classification ? (
                      <span className="text-[10px] font-bold text-accent">{r.classification.short} {r.classification.label}</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">{r.answered > 0 ? "Complete all 15" : "—"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-muted-foreground text-center flex gap-3 justify-center flex-wrap">
        {CLASS_LABELS.map(cl => (
          <span key={cl.key}><strong>{cl.short}</strong> {cl.label}</span>
        ))}
      </div>
    </div>
  );
}

export function getSensoryProfileSummary(scores: Record<string, string>) {
  const ageGroup = scores["__age_group"] || "18-64";
  const results: Record<string, { sum: number; classification: string }> = {};
  for (const [key, q] of Object.entries(QUADRANTS)) {
    const answered = q.items.filter(n => {
      const val = scores[String(n)];
      return val !== undefined && val !== "";
    }).length;
    const sum = q.items.reduce((acc, n) => {
      const val = scores[String(n)];
      return acc + (val ? parseInt(val) : 0);
    }, 0);
    const cl = answered === q.items.length ? getClassification(sum, key, ageGroup) : null;
    results[key] = { sum, classification: cl?.label || "Incomplete" };
  }
  return results;
}
