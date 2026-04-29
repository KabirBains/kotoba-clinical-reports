
## Goal

Move the source of truth for the FCA report template **out of the `assemble-report` Supabase edge function** and **into the Kotoba React app**, using the already-installed `docx` + `file-saver` libraries. The new template will mirror Report Mode visually, add proper tables, a Table of Contents, structured subsection headers, an assessments sequence, a recommendations table, an AI disclosure, and a signature block.

## Why

- Edge function string-concatenated XML is fragile and hard to iterate on.
- All the source data already lives in `reportData` on the client.
- `docx` and `file-saver` are already in `package.json` (no new deps).
- A starter assembler (`src/ai/reportAssembler.ts`) already exists — we'll redesign and wire it up.

## Architecture changes

```text
Before:  ReportMode -> DownloadReportButton -> kotobaSupabase.functions.invoke("assemble-report") -> base64 .docx
After:   ReportMode -> DownloadReportButton -> assembleReport(reportData) [client-side docx-js] -> saveAs(.docx)
```

The Supabase edge function `assemble-report` becomes obsolete. We will keep it deployed but stop calling it (safe rollback path); the plan section "Edge function cleanup" lists what to do with it.

## New template structure

Page setup: US Letter (12240 × 15840 DXA), 1" margins, Arial throughout, blue (#1F4E79) H1 / dark grey H2 / grey H3, `WidthType.DXA` for all tables (Google Docs compatible).

1. **Cover page**
   - Title: "Functional Capacity Assessment"
   - Subtitle: "Clinical Report — National Disability Insurance Scheme"
   - "CONFIDENTIAL & PRIVILEGED" badge
   - Participant name, DOB, NDIS #, date of report

2. **Table of Contents** (`TableOfContents` with `headingStyleRange: "1-2"`, hyperlinked) on its own page. Note shown to clinician: "Right-click → Update Field in Word to refresh page numbers."

3. **Participant & Report Details** — three KV tables (participant / clinician / persons present), then AI disclosure + clinical disclaimer note boxes.

4. **Sections 1–13** (prose sections) — each heading on H1, prose paragraphs underneath. Page breaks between major sections matching current behaviour.

5. **Section 14 — Functional Capacity, Domain Observations**
   Each subsection (14.1 Mobility … 14.8 Social Functioning) rendered as a uniform block:
   ```text
   [H2] 14.x — <Domain Name>
   [Small KV table] Level of impairment: Independent | Prompting | Assistance | Dependent
                    Evidence sources:    (from notes / observation)
   [Body] Clinical prose (paragraph-split)
   ```
   The "Level of impairment" row is populated from each domain's structured JSON when available; falls back to "Not specified" if absent.

6. **Section 15 — Standardised Assessments**
   For each assessment in `reportData.assessments`, render in this exact order:
   ```text
   [H2] <Assessment name>
   [Body] Synopsis — short description of what the tool measures (sourced from assessment-library; fallback to "Why selected" field).
   [Table] Score / Result | Date Administered | Classification
   [H3] Clinical Interpretation
   [Body] Interpretation prose (parsed from section13/section14 prose, split by assessment heading where possible; fallback to the full interpretations block under the first assessment).
   ```

7. **Sections 16–17** (Limitations & Barriers; Functional Impact Summary) — prose.

8. **Section 18 — Recommendations**
   Single full-width table summarising every recommendation (one row per recommendation):
   `Support | NDIS Category | Current | Recommended | Ratio | Tasks Covered`
   Immediately **after** the table, for each recommendation, render a labelled prose block:
   ```text
   [H3] <Support name> — Justification
   [Body] Narrative justification & link to functional need (parsed from section16/section17 prose by support name; fallback to a single combined narratives block).
   ```

9. **Sections 19–20** (Risks of Insufficient Funding; Review & Monitoring Plan; Section 34 statement) — prose, with the Section 34 statement in a callout box.

10. **AI Disclosure & Sign-off**
    - Prominent disclosure paragraph: this report was prepared with the assistance of AI writing technology, all clinical judgement is the clinician's, etc.
    - Sign-off table:
      `Report Author | <name>` (auto-filled)
      `Signature     | ___________________________` (fillable line)
      `Date          | ___________________________` (fillable line)
      `AHPRA Reg.    | <number>`
      `Organisation  | <practice>`
      `Contact       | <phone / email>`
    - Final footer paragraph reiterating NDIS Practice Standards & AHPRA Code of Conduct compliance.

Headers/footers on every page after cover: top — "FUNCTIONAL CAPACITY ASSESSMENT" left, "CONFIDENTIAL & PRIVILEGED" right. Bottom — page number left, participant name + report date right.

## Implementation tasks

1. **Rewrite `src/ai/reportAssembler.ts`**
   - Keep the `ReportData` interface (already matches what `ReportMode.tsx` builds at lines ~592–640) — extend with optional `domainImpairments?: Record<string, string>` for the level-of-impairment row.
   - Replace existing builder with the new template above. Use existing helpers (`h1`, `h2`, `kvTable`, `prose`, `noteBox`) and add: `h3`, `tocPage`, `assessmentBlock`, `recommendationsTable`, `signOffBlock`, `aiDisclosureBlock`.
   - Add bullet/numbering config (`LevelFormat.BULLET`) so any future bulleted lists render correctly.
   - Filename pattern stays: `FCA_<Name>_<YYYY-MM-DD>.docx`.

2. **Rewire `src/components/DownloadReportButton.tsx`**
   - Remove the `kotobaSupabase.functions.invoke("assemble-report", …)` call and the base64 decode.
   - Call `await assembleReport(reportData)` directly (it already triggers `saveAs` internally).
   - Keep the export soft-gate (`getExportConfirmation` + `ExportConfirmDialog`) — that flow is unchanged.
   - Keep the completed-sections progress bar + status states.

3. **Pass impairment levels through (Section 14 enhancement)**
   - In `src/components/editor/ReportMode.tsx` where `reportData` is assembled (around line 592), parse the structured JSON behind each `mobility / transfers / personal-adls …` note id and extract its `level` field into a new `domainImpairments` map keyed by `section12_1`…`section12_8`. Use the same helpers already used by `flattenDomainJson`.

4. **Assessment synopsis lookup**
   - Add a `getAssessmentSynopsis(definitionId | toolName)` helper in `src/lib/assessment-library.ts` (or read existing field if already present) so the assembler can render the "what this tool measures" line. Fallback chain: library entry → `whySelected` → empty.

5. **Recommendation narrative splitting**
   - Add a small util in the assembler that, given the combined recommendations narrative prose and a list of support names, splits the prose into per-recommendation chunks (regex on support-name headings already produced upstream). If a clean split isn't possible, fall back to printing the full narrative once after the table.

6. **Edge function cleanup**
   - Stop calling `assemble-report` from any client code (only `DownloadReportButton.tsx` uses it — confirmed via earlier audit).
   - Leave `supabase/functions/assemble-report/index.ts` deployed for one release cycle as a safety net, with a top-of-file comment marking it as deprecated. Removal can ship in a follow-up once the new client template is validated by the user.

7. **Sanity QA**
   - Manual: download a generated report from the current preview, open in Word + Google Docs, confirm TOC renders (Update Field), tables align, signature lines visible, page breaks sane.

## Files touched

- `src/ai/reportAssembler.ts` — full rewrite
- `src/components/DownloadReportButton.tsx` — switch to client-side assembler
- `src/components/editor/ReportMode.tsx` — add `domainImpairments` to `reportData`
- `src/lib/assessment-library.ts` — add synopsis lookup helper (small)
- `supabase/functions/assemble-report/index.ts` — deprecation comment only

## Out of scope (will iterate after first render)

- Embedding clinic logo / letterhead branding
- Real e-signature (Word-fillable line is sufficient per request)
- Removing the deprecated edge function (one release later)
- Any change to AI generation prompts or quality checker
