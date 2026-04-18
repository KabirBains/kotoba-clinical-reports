
## Goal

Add 6 new clinical writing rules to `supabase/functions/generate-report/index.ts` so Claude stops emitting markdown headings, fake "Evidence:" lines, invented demographics, repeated formal introductions, scattershot diagnosis attribution, and inconsistent carer references.

## Where the rules live

- **Cached prefix** (lines 544–552): static rule constants (`ANTI_REDUNDANCY`, `ASSESSMENT_SCORING_RULES`, `SUB_AREA_RULES`) — reused across calls via Anthropic prompt caching. Per the user's instruction, I will NOT touch this.
- **Dynamic suffix** (initialized line 556, `let dynamicSuffix = ""`): built fresh per call. This is where the new rules belong.

## Insertion point

Add a single new `=== SECTION-WRITING DISCIPLINE ===` block immediately after the participant/pronoun lines (after line 584) and before the Clinical Spine block (line 589). This places the rules early in the dynamic suffix where the model encounters them before any per-section routing.

## What gets added

A single `dynamicSuffix += "..."` block containing all 6 rules verbatim from the user's spec — each with its **RULE / Why / Forbidden / Correct (or Convention)** structure preserved so Claude understands the rationale, not just the constraint:

1. No in-prose section headings or numbering
2. No template "Evidence: As per..." citation blocks
3. No inferred/invented demographic details
4. Formal first-mention introduction restricted to Section 1 or 2
5. Diagnosis attribution: single most causally relevant, not all
6. Consistent parent/carer reference form (full at first mention per section, first-name thereafter)

## What is NOT changed

- `CLAUDE_API_KEY` handling
- Storage / docs loading
- Cached prefix constants (`ANTI_REDUNDANCY`, `ASSESSMENT_SCORING_RULES`, `SUB_AREA_RULES`)
- Clinical Spine injection
- Collateral routing (sections 6, 6_informant, 2, 12, 13, 16/17/18, 8/9)
- Section 17 consequence statement requirement
- Safety concerns routing
- Lookback context
- Any existing rule — append-only

## Deployment

After the edit, deploy `generate-report` via `supabase--deploy_edge_functions` so the next generation picks up the new rules. No frontend changes required.

## Verification path

Generate one section after deploy and confirm:
- No `##` or `**12.1**` style headings in output
- No literal `Evidence:` lines
- Sections 3+ open with "John presents..." not "Mr. John Smith (referred to as John...)"
- Diagnosis attribution varies per finding rather than concatenating all diagnoses
