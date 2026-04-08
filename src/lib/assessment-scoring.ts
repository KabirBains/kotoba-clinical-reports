/**
 * Unified assessment scoring dispatcher.
 *
 * Each scoring component (WHODASScoring, LSP16Scoring, etc.) exports a
 * `getXxxScoreSummary(scores)` function that returns an `AssessmentScoreSummary`.
 * This file dispatches to the right one based on `definitionId`, providing
 * a single entry point for callers that need a consistent score summary.
 *
 * Replaces:
 *   - The 240-line `buildScoreSummary` block inlined in ClientEditor.tsx
 *   - The duplicated WHODAS_DOMAINS / Dass42_SUBSCALE_DEFS constants in ReportMode.tsx
 *   - The dead `getScoreForOption` paths in assessment-library.ts
 *
 * If you add a new assessment tool, you only need to:
 *   1. Create the scoring component with a `getXxxScoreSummary` export
 *   2. Add a case to the dispatcher below
 *   3. Add the definition to ASSESSMENT_LIBRARY in assessment-library.ts
 */

import {
  type AssessmentScoreSummary,
  type AssessmentInstance,
  EMPTY_SCORE_SUMMARY,
  ASSESSMENT_LIBRARY,
  calculateTotal,
  calculateSubscaleTotal,
  getClassification,
} from "./assessment-library";
import { getWhodasScoreSummary } from "@/components/editor/WHODASScoring";
import { getLsp16ScoreSummary } from "@/components/editor/LSP16Scoring";
import { getZaritScoreSummary } from "@/components/editor/ZaritScoring";
import { getFratScoreSummary } from "@/components/editor/FRATScoring";
import { getCansScoreSummary } from "@/components/editor/CANSScoring";
import { getLawtonScoreSummary } from "@/components/editor/LawtonIADLScoring";
import { getSensoryProfileScoreSummary } from "@/components/editor/SensoryProfileScoring";
import { getDass42ScoreSummary } from "@/components/editor/DASS42Scoring";

/**
 * Dispatch a score-summary call to the appropriate scoring component.
 *
 * For tools without a dedicated scoring component (custom assessments,
 * or the legacy `katz-adl` which uses the assessment-library subscales
 * directly), falls back to the generic library scoring functions.
 */
export function getAssessmentScoreSummary(
  definitionId: string,
  scores: Record<string, string>,
): AssessmentScoreSummary {
  switch (definitionId) {
    case "whodas-2.0":
      return getWhodasScoreSummary(scores);
    case "lsp-16":
      return getLsp16ScoreSummary(scores);
    case "zarit":
      return getZaritScoreSummary(scores);
    case "frat":
      return getFratScoreSummary(scores);
    case "cans":
      return getCansScoreSummary(scores);
    case "lawton-iadl":
      return getLawtonScoreSummary(scores);
    case "sensory-profile":
      return getSensoryProfileScoreSummary(scores);
    case "dass-42":
      return getDass42ScoreSummary(scores);
    default: {
      // Fallback for tools that use the assessment-library subscales (e.g.
      // katz-adl) or for custom tools. The library functions return 0 / ""
      // for tools with empty subscales, which is acceptable here — callers
      // get an empty summary they can render gracefully.
      const def = ASSESSMENT_LIBRARY.find((d) => d.id === definitionId);
      if (!def) return { ...EMPTY_SCORE_SUMMARY };
      const total = calculateTotal(def, scores);
      const classification = getClassification(def, total);
      const rows: { label: string; value: string }[] = [];
      for (const sub of def.subscales) {
        rows.push({
          label: sub.label,
          value: String(calculateSubscaleTotal(def, sub.id, scores)),
        });
      }
      // Count items as everything in subscales (best effort for library tools)
      const itemsTotal = def.subscales.reduce((s, sub) => s + sub.items.length, 0);
      let itemsAnswered = 0;
      for (const sub of def.subscales) {
        for (const item of sub.items) {
          if (scores[item.id]) itemsAnswered++;
        }
      }
      return {
        rows,
        total: itemsTotal > 0 ? String(total) : "",
        classification: itemsTotal > 0 ? classification : "",
        isComplete: itemsTotal > 0 && itemsAnswered === itemsTotal,
        itemsAnswered,
        itemsTotal,
        scoringDirection: "",
      };
    }
  }
}

/**
 * Convenience: get a score summary for an `AssessmentInstance`.
 * Also injects custom items as additional rows when present.
 */
export function getInstanceScoreSummary(instance: AssessmentInstance): AssessmentScoreSummary {
  const summary = getAssessmentScoreSummary(instance.definitionId, instance.scores);
  if (instance.isCustom && instance.customItems) {
    const extra = instance.customItems
      .filter((it) => it.value)
      .map((it) => ({ label: it.label, value: it.value }));
    return { ...summary, rows: [...summary.rows, ...extra] };
  }
  return summary;
}
