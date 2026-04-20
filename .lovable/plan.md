

## Goal

Three UI/queue changes to repurpose existing report sections and add one new section. The edge function (`generate-report`) has already been updated server-side to handle the new `section_name` values.

## Change 1 — Rename "Functional Impact Summary" → "Risks if No Funding"

**`src/lib/constants.ts`** — section 17:
- Keep `id: "functional-impact"` (preserves saved data); update `title` to **"Risks if No Funding"**.

**`src/components/editor/NotesMode.tsx`** (`SectionPanel`):
- Add a `placeholder` prop and pass a custom placeholder when `section.id === "functional-impact"`:
  > "Enter context for the risks — recommendations from earlier sections, critical safety concerns, and any specific deteriorations you want to anchor the risks to. The edge function will produce 3-6 professor-style risks in the output."

**`src/pages/ClientEditor.tsx`** — generation routing:
- Update `SECTION_LABELS["functional-impact"]` → `"Section 17 - Risks if No Funding"`.
- Add to `SECTION_NAME_MAP`: `"functional-impact": "section-risks-if-not-funded"`.
- In the top-level loop (line 628), add a per-section override for `max_tokens`: when `sectionId === "functional-impact"`, push with `maxTokens: 1500` (instead of the default 2000) and a **simplified prompt** that just passes the clinician's input — no template guidance, no rubric (the edge function owns those rules now). The prompt body is just the raw clinician observations under a brief header.

**`src/components/editor/ReportMode.tsx`**:
- Update the section heading rendering for `section15` → label "Risks if No Funding" (line 496 sources from `s("functional-impact")`, no key change needed).
- Render output: split returned prose on numbered/bolded headlines; render one risk per paragraph with the headline `<strong>`. If the model returns plain numbered prose, fall back to the existing paragraph rendering. Keep `dangerouslySetInnerHTML` + `stripMarkdown` pipeline intact.

## Change 2 — Rename "Review & Monitoring Plan" → "Barriers to Accessing/Utilising Supports"

**`src/lib/constants.ts`** — section 19:
- Keep `id: "review-monitoring"` (preserves saved data); update `title` to **"Barriers to Accessing/Utilising Supports"**.

**`src/components/editor/NotesMode.tsx`**:
- Custom placeholder when `section.id === "review-monitoring"`:
  > "Enter observations about what limits this participant's ability to access or benefit from supports. Examples: communication barriers, cognitive/behavioural barriers, transport/mobility, carer burnout, no extended family, housing instability, previous negative service experiences, cultural/linguistic factors."

**`src/pages/ClientEditor.tsx`**:
- Add to `SECTION_NAME_MAP`: `"review-monitoring": "section-barriers-to-supports"`.
- In the top-level loop, override for `review-monitoring`: `maxTokens: 1000`, simplified prompt (raw clinician input only, no template guidance/rubric).

**`src/components/editor/ReportMode.tsx`**:
- Section heading label updated for `section18` → "Barriers to Accessing/Utilising Supports". Renders as standard prose paragraph (no special formatting).

## Change 3 — New section: "Participant Decision Maker"

**`src/lib/constants.ts`**:
- Insert new section `{ id: "decision-maker", number: "1a", title: "Participant Decision Maker" }` immediately after `participant-details` (index 1). Renumbering the whole template would break saved data and many references — using `1a` keeps the placement requirement satisfied without touching downstream IDs.

**New component `src/components/editor/DecisionMakerSection.tsx`**:
Structured form following the `ParticipantReportDetails` pattern, with three inputs persisted under prefixed keys (so they don't pollute the generic notes scan):
- `__decisionMaker__primary` — text field: "Who currently makes decisions for this participant?"
- `__decisionMaker__limitedDomains` — multi-select chips with options: health, finances, accommodation, legal, daily living, medication, complex life decisions
- `__decisionMaker__observations` — textarea: "Additional observations about capacity"

Plus a derived `notes["decision-maker"]` rollup string (formatted observations) so the existing top-level generation loop picks it up automatically. The rollup is recomputed on any input change.

**`src/components/editor/NotesMode.tsx`**:
- Render `<DecisionMakerSection>` when `section.id === "decision-maker"`, branching just like the other structured sections (assessments, recommendations, etc).

**`src/pages/ClientEditor.tsx`**:
- Add to `SECTION_NAME_MAP`: `"decision-maker": "section-decision-maker"`.
- Override in the top-level loop: `maxTokens: 800`, simplified prompt body that just contains the formatted clinician inputs.
- Add `SECTION_LABELS["decision-maker"]` for the quality checker.

**`src/components/editor/ReportMode.tsx`**:
- Add render slot for the decision-maker output between Participant Details and Methodology in the report layout. Reads from `notes["decision-maker"]` after generation overwrites it (same flow as other top-level sections).

## What is NOT changed

- `id` values for `functional-impact` and `review-monitoring` — preserved so existing saved reports load.
- Edge functions, `assemble-report`, recommendations, assessments, methodology aggregator, goals — untouched.
- The "Limitations & Barriers to Progress" section (16) — left as-is per the request scope.
- No client-side prompt rules added for the three repurposed/new sections — the edge function owns the prose rules.

## Server-side wins (verification only, no code)

After shipping, regenerate a test report and spot-check:
1. Background section contains the permanence clause naturally woven in.
2. Recommendations / risk sections use "The writer recommends" instead of "The assessor recommends".
3. The protected phrase "in the assessor's clinical opinion" still appears for speculation attribution.

## Verification

1. Open a client → Notes mode. Confirm:
   - Section 17 title is "Risks if No Funding" with new placeholder.
   - Section 19 title is "Barriers to Accessing/Utilising Supports" with new placeholder.
   - New "1a Participant Decision Maker" section appears after Participant Details with the three structured inputs.
2. Add input to all three sections, click "Generate Full Report".
3. Switch to Report mode. Confirm:
   - Risks section renders 3-6 bolded-headline risks, one per paragraph.
   - Barriers section renders as a single 4-6 sentence paragraph.
   - Decision Maker section renders 2-4 sentences in the correct position.
4. Download .docx and confirm all three sections export correctly.

