
## Goal

Add 4 new countable, enforceable clinical writing rules to the dynamic section-writing rules block in `supabase/functions/generate-report/index.ts` — same `=== SECTION-WRITING DISCIPLINE ===` location used by the previous 6 rules.

## Where the rules go

- **File**: `supabase/functions/generate-report/index.ts`
- **Block**: `dynamicSuffix` (the `=== SECTION-WRITING DISCIPLINE ===` block appended in the last turn)
- **Action**: Append a new sub-block `=== ENFORCEABLE QUALITY RULES (count before returning) ===` immediately after rule 6 (carer references) and before the Clinical Spine injection
- **Cached prefix**: untouched

## Rules being added (verbatim from spec, with rationale + examples preserved)

1. **Intensifier budget** — hard caps with concrete rewrite examples; diagnosis-name "Severe" excluded from cap; intensifier-before-quantified-fact must be deleted
2. **Speculation must be attributed** — explicit trigger word list; rewrite (preferred) or attribute to assessor opinion
3. **Cross-section citation** — section-number reference format for collateral / assessments / risks / FC / diagnoses; exclusion for in-section observations
4. **No generic closing boilerplate** — banned phrase list + the "paste-into-different-report" test

## What is NOT changed

- Cached prefix (`ANTI_REDUNDANCY`, `ASSESSMENT_SCORING_RULES`, `SUB_AREA_RULES`)
- CLAUDE_API_KEY, storage, clinical spine, collateral routing, threading
- Any existing rule (append-only)
- Section 17 consequence requirement, safety routing, lookback context

## Deployment

After edit, deploy `generate-report` via `supabase--deploy_edge_functions`. No frontend changes.

## Verification

User generates a section and confirms:
- Intensifier counts under caps (`significantly` ≤2, `profound` ≤1, `severe` ≤2 excluding diagnosis, etc.)
- No bare "appears [adjective]" / "apparent [noun]" without rewrite or assessor attribution
- Cross-section references include section number ("see Section 6")
- Closing sentences contain a section-specific concrete fact, no generic "missed opportunities" / "associated mental health risks" filler
