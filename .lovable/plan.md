

## Goal

Stop "Support level: [Level]" from appearing inside the AI-generated prose body in Section 14 (and elsewhere). Today it leaks in as `<> Support level: Fully Dependent` at the start of 14.3 paragraphs. The structured row UI already shows "Support level: …" as a clean italic label above each paragraph (ReportMode line 742-746), so the duplicate inside the prose is redundant noise.

## Root cause

Two cooperating triggers in `supabase/functions/generate-report/index.ts`:

1. The cached `SUB_AREA_RULES` block (lines 341-385) explicitly tells the model to output `Support level: [level]` after every `<<SUB_AREA: …>>` delimiter.
2. The `D2_support_level_declarations` rubric criterion (lines 254-257) actively penalises sections that omit it.

Even on per-row JSON domains (14.x), the model echoes the `SUPPORT LEVEL:` value from the row input back into the prose. The `<>` prefix is a leftover delimiter artifact.

## Changes

### 1. `supabase/functions/generate-report/index.ts`
- **Remove** the `D2_support_level_declarations` criterion push (lines 254-257).
- **Rewrite** `SUB_AREA_RULES` example blocks (lines 346-352, 366-381) to drop every `Support level: …` line. The `<<SUB_AREA: [Name]>>` delimiter stays — it's still needed for sub-area separation.
- **Add** an explicit negative rule inside `SUB_AREA_RULES`: *"Do NOT write 'Support level: …' anywhere in your prose. The support level is rendered separately by the UI."*
- **Update** the per-row domain prompt in `src/pages/ClientEditor.tsx` (around line 896) — append: *"Do NOT echo the SUPPORT LEVEL value in your prose. It is rendered separately."*

### 2. `src/lib/utils.ts` — defensive cleanup for already-stored content
Strengthen `stripMarkdown` so legacy/cached content also renders clean:
- Replace the existing narrow regex on line 52 with a broader version that strips any leading `Support level:` line at the start of a block, with or without a `<>` / `<` prefix and any whitespace:
  ```
  /^[\s<>]*support level\s*:\s*[^\n]*\n?/gim
  ```
- Keep the existing `<>` delimiter cleanup for other artifacts.

### 3. `src/components/editor/ReportMode.tsx`
Run the prose through a tiny inline cleaner before the `dangerouslySetInnerHTML` for both:
- the per-row path (`entry.text`, line 751)
- the legacy prose path (`proseText`, line 769)

This guarantees existing reports already saved in `notes` JSONB display cleanly, without needing regeneration.

## What's NOT changed

- The clean italic "Support level: {entry.rating}" label rendered by the UI (line 742-746) stays — that's the legitimate display.
- The `<<SUB_AREA: [Name]>>` delimiter mechanism stays.
- No changes to data, types, recommendations, assessments, methodology, or `assemble-report` (the .docx exporter reads the same cleaned text).

## Verification

1. Open the current client → Report Mode → Section 14.3. The previously-saved prose should no longer start with `<> Support level: Fully Dependent` (cleaned at render time).
2. Regenerate Section 14.3 and any other 14.x domain. Confirm the prose body contains no `Support level: …` line; the italic label above each row is unchanged.
3. Download the .docx and confirm the same.

