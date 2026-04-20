import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const DECISION_MAKER_KEYS = {
  primary: "__decisionMaker__primary",
  limitedDomains: "__decisionMaker__limitedDomains",
  observations: "__decisionMaker__observations",
} as const;

const DOMAIN_OPTIONS = [
  "health",
  "finances",
  "accommodation",
  "legal",
  "daily living",
  "medication",
  "complex life decisions",
] as const;

interface DecisionMakerSectionProps {
  notes: Record<string, string>;
  onUpdateNote: (key: string, value: string) => void;
}

/**
 * Section 1a — Participant Decision Maker.
 *
 * Captures three structured inputs (decision maker identity, capacity-limited
 * domains, free-text observations) under prefixed __decisionMaker__ keys so
 * they don't pollute the generic notes scan in ClientEditor.tsx.
 *
 * A derived rollup string is written to notes["decision-maker"] so the
 * existing top-level generation loop picks it up automatically and routes it
 * to the edge function via section_name: "section-decision-maker".
 */
export function DecisionMakerSection({ notes, onUpdateNote }: DecisionMakerSectionProps) {
  const [open, setOpen] = useState(true);

  const primary = notes[DECISION_MAKER_KEYS.primary] || "";
  const domainsRaw = notes[DECISION_MAKER_KEYS.limitedDomains] || "";
  const selectedDomains = domainsRaw
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  const observations = notes[DECISION_MAKER_KEYS.observations] || "";

  const hasContent = !!(primary.trim() || selectedDomains.length > 0 || observations.trim());

  // Recompute the rollup notes["decision-maker"] whenever any input changes
  // so the top-level generation loop sees fresh content. We write only when
  // it differs to avoid feedback loops.
  useEffect(() => {
    const lines: string[] = [];
    if (primary.trim()) lines.push(`Primary decision maker: ${primary.trim()}`);
    if (selectedDomains.length > 0) {
      lines.push(`Decision domains where capacity is limited by disability: ${selectedDomains.join(", ")}`);
    }
    if (observations.trim()) lines.push(`Additional observations about capacity: ${observations.trim()}`);
    const rollup = lines.join("\n");
    if ((notes["decision-maker"] || "") !== rollup) {
      onUpdateNote("decision-maker", rollup);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primary, domainsRaw, observations]);

  const toggleDomain = (domain: string) => {
    const set = new Set(selectedDomains);
    if (set.has(domain)) set.delete(domain);
    else set.add(domain);
    onUpdateNote(DECISION_MAKER_KEYS.limitedDomains, Array.from(set).join(", "));
  };

  return (
    <div data-section-id="decision-maker" className="border-b border-border/30 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <span className="text-xs text-muted-foreground font-mono w-8 flex-shrink-0">1a</span>
        <span className="text-sm font-medium text-foreground flex-1">Participant Decision Maker</span>
        {hasContent && <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 pl-[4.5rem] space-y-4">
          {/* Primary decision maker */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground tracking-wide">
              Who currently makes decisions for this participant?
            </label>
            <input
              type="text"
              value={primary}
              onChange={(e) => onUpdateNote(DECISION_MAKER_KEYS.primary, e.target.value)}
              placeholder='e.g. "Self", "Mother — Mo", "Public Guardian", "Financial Administrator"'
              className="w-full h-9 px-3 text-xs bg-muted/30 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Limited domains */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground tracking-wide">
              Decision domains where capacity is limited by disability
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DOMAIN_OPTIONS.map((d) => {
                const active = selectedDomains.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDomain(d)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border transition-colors capitalize",
                      active
                        ? "bg-accent text-accent-foreground border-accent"
                        : "bg-muted/30 text-foreground border-border/50 hover:bg-muted/60",
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Observations */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground tracking-wide">
              Additional observations about capacity
            </label>
            <textarea
              rows={3}
              value={observations}
              onChange={(e) => onUpdateNote(DECISION_MAKER_KEYS.observations, e.target.value)}
              placeholder='e.g. "Can indicate basic preferences but cannot comprehend long-term consequences"'
              style={{ resize: "vertical", minHeight: "70px" }}
              className="w-full px-3 py-2 text-xs bg-muted/30 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 placeholder:text-muted-foreground/50"
            />
          </div>
        </div>
      )}
    </div>
  );
}
