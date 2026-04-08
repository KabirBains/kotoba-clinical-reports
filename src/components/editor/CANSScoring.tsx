import { useState, useMemo } from "react";
import type { AssessmentScoreSummary } from "@/lib/assessment-library";

interface CANSScoringProps {
  scores: Record<string, string>;
  onUpdateScores: (scores: Record<string, string>) => void;
}

const GROUPS = [
  {
    id: "A", name: "Group A",
    subtitle: "Requires nursing care and/or support or monitoring of severe behavioural/cognitive disabilities and/or assistance with very basic ADLs",
    items: [
      { num: 1, text: "Tracheostomy management" },
      { num: 2, text: "Nasogastric/PEG feeding" },
      { num: 3, text: "Bed mobility (e.g., turning)" },
      { num: 4, text: "Wanders/gets lost" },
      { num: 5, text: "Exhibits behaviours with potential to harm self/others" },
      { num: 6, text: "Difficulty communicating basic needs" },
      { num: 7, text: "Continence" },
      { num: 8, text: "Eating and drinking" },
      { num: 9, text: "Transfers/mobility (incl. stairs and indoor surfaces)" },
      { num: 10, text: "Other (specify)" },
    ],
  },
  {
    id: "B", name: "Group B",
    subtitle: "Requires assistance, supervision, direction and/or cueing for basic ADLs",
    items: [
      { num: 11, text: "Personal hygiene/toileting" },
      { num: 12, text: "Bathing/dressing" },
      { num: 13, text: "Preparation of light meal/snack" },
      { num: 14, text: "Other (specify)" },
    ],
  },
  {
    id: "C", name: "Group C",
    subtitle: "Requires assistance, supervision, direction and/or cueing for instrumental ADLs and/or social participation",
    items: [
      { num: 15, text: "Shopping" }, { num: 16, text: "Domestic incl. preparation of main meal" },
      { num: 17, text: "Medication use" }, { num: 18, text: "Money management" },
      { num: 19, text: "Everyday devices (e.g., telephone, television)" },
      { num: 20, text: "Transport and outdoor surfaces" }, { num: 21, text: "Parenting skills" },
      { num: 22, text: "Interpersonal relationships" }, { num: 23, text: "Leisure and recreation" },
      { num: 24, text: "Employment/study" }, { num: 25, text: "Other (specify)" },
    ],
  },
  {
    id: "D", name: "Group D",
    subtitle: "Requires supports",
    items: [
      { num: 26, text: "Informational supports (e.g., advice)" },
      { num: 27, text: "Emotional supports" },
      { num: 28, text: "Other (specify)" },
    ],
  },
];

const CANS_LEVELS = [
  { level: "7", label: "Cannot be left alone — needs support 24 hours per day" },
  { level: "6", label: "Can be left alone for a few hours — needs support 20–23 hours per day" },
  { level: "5", label: "Can be left alone for part of the day, but not overnight — needs support 12–19 hours per day" },
  { level: "4.3", label: "Can be left alone for part of the day and overnight — up to 11 hours (Group A needs)" },
  { level: "4.2", label: "Can be left alone for part of the day and overnight — up to 11 hours (Group B needs)" },
  { level: "4.1", label: "Can be left alone for part of the day and overnight — up to 11 hours (Group C needs)" },
  { level: "3", label: "Can be left alone for a few days a week — needs support a few days a week" },
  { level: "2", label: "Can be left alone for almost all week — needs support at least once a week" },
  { level: "1", label: "Can live alone, but needs intermittent support (less than weekly)" },
  { level: "0", label: "Does not need support — can live in the community totally independently" },
];

// ─── EXPORTED SCORING FUNCTION ──────────────────────────────────
// Single source of truth for CANS scoring. Replaces duplicated logic in
// ClientEditor.tsx buildScoreSummary.

const CANS_LEVEL_DESCRIPTIONS: Record<string, string> = {
  "7": "Cannot be left alone — 24hr support",
  "6": "Can be left alone a few hours — 20–23hr support",
  "5": "Can be left alone part of day, not overnight — 12–19hr",
  "4.3": "Up to 11hr (Group A)",
  "4.2": "Up to 11hr (Group B)",
  "4.1": "Up to 11hr (Group C)",
  "3": "Needs support a few days a week",
  "2": "Needs support at least once a week",
  "1": "Needs intermittent support (less than weekly)",
  "0": "No support needed",
};

/**
 * Unified score summary for the AI prompt builder.
 */
export function getCansScoreSummary(scores: Record<string, string>): AssessmentScoreSummary {
  const rows: { label: string; value: string }[] = [];
  let totalYes = 0;
  let totalAnswered = 0;
  let highestGroup: string | null = null;

  for (const g of GROUPS) {
    let groupYes = 0;
    let groupAnswered = 0;
    for (const item of g.items) {
      const v = scores[String(item.num)];
      if (v === "true") {
        groupYes++;
        groupAnswered++;
      } else if (v === "false") {
        groupAnswered++;
      }
    }
    totalYes += groupYes;
    totalAnswered += groupAnswered;
    if (groupYes > 0 && !highestGroup) highestGroup = g.id;
    rows.push({ label: g.name, value: `${groupYes} needs identified` });
  }

  const cansLevel = scores["__cans_level"] || null;
  let total = "";
  let classification = "";

  if (cansLevel) {
    total = `Level ${cansLevel}`;
    classification = CANS_LEVEL_DESCRIPTIONS[cansLevel] || `Level ${cansLevel}`;
  } else if (highestGroup) {
    total = `${totalYes} needs identified`;
    classification = `Highest group: ${highestGroup} (level not set)`;
  } else if (totalAnswered === 28) {
    total = "0 needs identified";
    classification = "No support needed (Level 0)";
  }

  const itemsTotal = 28;
  return {
    rows,
    total,
    classification,
    isComplete: totalAnswered === itemsTotal,
    itemsAnswered: totalAnswered,
    itemsTotal,
    scoringDirection: "CANS: HIGHER level (0–7) = MORE care needs. Level is determined by the highest group of need endorsed AND how long the person can be safely left alone. Level must be set explicitly via the level selector.",
  };
}

export function CANSScoring({ scores, onUpdateScores }: CANSScoringProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const getResponse = (num: number): boolean | undefined => {
    const val = scores[String(num)];
    if (val === "true") return true;
    if (val === "false") return false;
    return undefined;
  };

  const setResponse = (num: number, value: boolean) => {
    const newScores = { ...scores, [String(num)]: String(value) };
    // Reset CANS level override when items change
    delete newScores["__cans_level"];
    onUpdateScores(newScores);
  };

  const cansLevelOverride = scores["__cans_level"] || null;

  const groupResults = useMemo(() => {
    const results: Record<string, { answered: number; total: number; yesCount: number; hasYes: boolean }> = {};
    for (const group of GROUPS) {
      const answered = group.items.filter(i => getResponse(i.num) !== undefined).length;
      const yesCount = group.items.filter(i => getResponse(i.num) === true).length;
      results[group.id] = { answered, total: group.items.length, yesCount, hasYes: yesCount > 0 };
    }
    return results;
  }, [scores]);

  const totalAnswered = GROUPS.reduce((acc, g) => acc + groupResults[g.id].answered, 0);
  const totalYes = GROUPS.reduce((acc, g) => acc + groupResults[g.id].yesCount, 0);

  const highestGroup = useMemo(() => {
    if (groupResults["A"].hasYes) return "A";
    if (groupResults["B"].hasYes) return "B";
    if (groupResults["C"].hasYes) return "C";
    if (groupResults["D"].hasYes) return "D";
    if (totalAnswered === 28 && totalYes === 0) return "E";
    return null;
  }, [groupResults, totalAnswered, totalYes]);

  const suggestedMinLevel = useMemo(() => {
    if (highestGroup === "A") return "4.3";
    if (highestGroup === "B") return "4.2";
    if (highestGroup === "C") return "1";
    if (highestGroup === "D") return "1";
    if (highestGroup === "E") return "0";
    return null;
  }, [highestGroup]);

  const activeCansLevel = cansLevelOverride || suggestedMinLevel;
  const activeLevelInfo = CANS_LEVELS.find(l => l.level === activeCansLevel);

  const validLevels = useMemo(() => {
    if (highestGroup === "A") return ["4.3", "5", "6", "7"];
    if (highestGroup === "B") return ["4.2", "4.3", "5", "6", "7"];
    if (highestGroup === "C") return ["1", "2", "3", "4.1", "4.2", "4.3", "5", "6", "7"];
    if (highestGroup === "D") return ["1", "2", "3"];
    if (highestGroup === "E") return ["0"];
    return [];
  }, [highestGroup]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-foreground">{totalAnswered}/28 items answered</span>
        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${(totalAnswered / 28) * 100}%` }} />
        </div>
        <span className="text-xs text-muted-foreground">{totalYes} needs identified</span>
      </div>

      {GROUPS.map(group => {
        const r = groupResults[group.id];
        const isCollapsed = collapsed[group.id];
        return (
          <div key={group.id} className="border border-border/50 rounded-lg overflow-hidden">
            <button
              onClick={() => setCollapsed(p => ({ ...p, [group.id]: !p[group.id] }))}
              className="w-full px-4 py-2.5 bg-muted/20 border-b border-border/30 flex justify-between items-center text-left"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{group.name}</span>
                  <span className="text-[11px] text-muted-foreground">({r.answered}/{r.total})</span>
                  {r.hasYes && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent/10 text-accent">{r.yesCount} YES</span>}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{group.subtitle}</div>
              </div>
              <span className={`text-muted-foreground transition-transform ${isCollapsed ? '-rotate-90' : ''}`}>▾</span>
            </button>
            {!isCollapsed && (
              <div>
                {group.items.map((item, idx) => {
                  const val = getResponse(item.num);
                  return (
                    <div key={item.num} className={`flex items-center px-4 py-2 gap-3 ${idx % 2 === 0 ? 'bg-muted/5' : ''} border-b border-border/10 last:border-b-0`}>
                      <span className="font-mono text-[11px] text-muted-foreground min-w-[22px] text-right">{item.num}</span>
                      <span className="flex-1 text-xs text-foreground">{item.text}</span>
                      <div className="flex gap-0.5 flex-shrink-0">
                        <button
                          onClick={() => setResponse(item.num, true)}
                          className={`px-3 py-1 rounded-l-md text-[11px] font-bold border transition-colors ${
                            val === true ? 'bg-accent text-accent-foreground border-accent' : 'bg-background border-border text-muted-foreground'
                          }`}
                        >Yes</button>
                        <button
                          onClick={() => setResponse(item.num, false)}
                          className={`px-3 py-1 rounded-r-md text-[11px] font-bold border transition-colors ${
                            val === false ? 'bg-green-600 text-white border-green-600' : 'bg-background border-border text-muted-foreground'
                          }`}
                        >No</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* CANS Level */}
      <div className="border-2 border-foreground/20 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-foreground text-background">
          <h3 className="text-sm font-bold">CANS Level</h3>
          <span className="text-[11px] opacity-70">Select based on how long client can be left alone</span>
        </div>

        {highestGroup && (
          <div className="px-4 py-2 border-b border-border/20 text-xs bg-muted/20">
            <strong>Highest group endorsed:</strong>{" "}
            {highestGroup === "E" ? "None (Group E)" : `Group ${highestGroup}`}
            {suggestedMinLevel && <span className="ml-2 text-muted-foreground">→ Minimum level: <strong>{suggestedMinLevel}</strong></span>}
          </div>
        )}

        <div className="p-2 space-y-0.5">
          {CANS_LEVELS.map(lvl => {
            const isValid = validLevels.includes(lvl.level);
            const isActive = activeCansLevel === lvl.level;
            return (
              <button
                key={lvl.level}
                onClick={() => isValid && onUpdateScores({ ...scores, __cans_level: lvl.level })}
                disabled={highestGroup !== null && !isValid}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                  isActive ? 'bg-accent/10 border-2 border-accent' : 'border-2 border-transparent'
                } ${highestGroup !== null && !isValid ? 'opacity-25' : 'hover:bg-muted/30'}`}
              >
                <span className={`font-mono text-lg font-bold min-w-[36px] text-center ${isActive ? 'text-accent' : 'text-muted-foreground'}`}>{lvl.level}</span>
                <span className={`text-xs ${isActive ? 'text-accent font-medium' : 'text-muted-foreground'}`}>{lvl.label}</span>
              </button>
            );
          })}
        </div>

        {activeLevelInfo && (
          <div className="p-4 mx-3 mb-3 rounded-lg bg-accent/5 border-2 border-accent/20 text-center">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">CANS Level</div>
            <div className="font-mono text-4xl font-bold text-accent">{activeLevelInfo.level}</div>
            <div className="text-xs text-accent mt-1">{activeLevelInfo.label}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function getCANSSummary(scores: Record<string, string>) {
  const cansLevel = scores["__cans_level"] || null;
  let totalYes = 0;
  for (let i = 1; i <= 28; i++) {
    if (scores[String(i)] === "true") totalYes++;
  }
  return { cansLevel: cansLevel || "Not determined", totalYes };
}
