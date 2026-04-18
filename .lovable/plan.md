

User reports: ran "Generate Full Report", saw the generation sequence run, but Report Mode shows no generated content. Need to investigate the pipeline.

Key observations from context:
1. Runtime error: `Edge function returned 500: Error, {"success":false,"error":"Doc load failed","details":"Load failed: OT_FCA_Template_v5.1.docx"}` — but this is from `assemble-report` (docx download), NOT `generate-report`. So that's a separate issue (download .docx failing because template missing in storage).
2. Edge function logs for `generate-report` only show boots/shutdowns — no actual invocations visible. That's suspicious. Either nothing called it, or logs are stale.
3. Stages 1/1.5 just landed: a generation gate was added blocking `handleGenerateFullReport` if Spine isn't approved. The user may have hit the gate (toast shown, queue never started) but interpreted it as "ran the sequence with no output".
4. Alternatively — the queue ran, sections returned, but writes to `report_content` aren't landing because of a state bug.

I need to investigate before proposing a fix. Let me lay out what I'll inspect.

### Investigation plan

1. Read `src/pages/ClientEditor.tsx` `handleGenerateFullReport` to see exactly what the gate does and whether it silently aborts vs runs the queue.
2. Read `src/ai/generationQueue.ts` to confirm how generated section text is written into `report_content`.
3. Read `src/ai/reportEngine.ts` (the section that handles `generate-report` invoke + result handling) to confirm whether the section results are correctly persisted.
4. Read `src/components/editor/ReportMode.tsx` to confirm how it reads `report_content` for display.
5. Check `supabase/functions/generate-report/index.ts` for any recent changes that might have broken response shape.
6. Check edge function logs for `generate-report` (live invocations) and any errors.
7. Confirm whether `__clinical_spine__` approval status is what blocked generation (most likely cause given Stage 1.5 just shipped).

### Likely root causes (ranked)

**A. Spine approval gate fired and aborted the run silently** — most likely. The user "saw the generation sequence" might actually be the progress UI flickering then exiting. Or the gate's toast was missed.

**B. generate-report response shape mismatch** — if Stage 1/1.5 changes accidentally touched generation, sections may return but the queue can't extract `.section_text` to write to `report_content`.

**C. Persisted to wrong key** — possible regression where generated content writes to `notes.__clinical_spine__` location or similar instead of `report_content`.

**D. The .docx Doc load failure is unrelated** — that's `assemble-report` failing because `OT_FCA_Template_v5.1.docx` isn't in the `report-documents` storage bucket. This blocks .docx download, not in-app display.

### Fix plan (after investigation, will adjust)

1. **Confirm gate behavior**: ensure the Spine gate shows a clear, prominent toast and scrolls to the panel. If the user's report has no Spine generated yet, the gate is the cause and we just need clearer UX (toast persistent + auto-open panel + visible "Approve Spine" CTA at top of Report Mode).
2. **Add diagnostic logging** to `generationQueue.ts` and the section-write path so future runs are traceable in console.
3. **Verify queue → report_content write path** is intact and unaffected by Stage 1/1.5 changes.
4. **Separate fix for the .docx template**: surface a clear error to the user about the missing template (out of scope for this turn unless related).

### What I'll deliver after approval

- Targeted code edits to `ClientEditor.tsx` (gate UX), `generationQueue.ts` (logging + verify write), and `reportEngine.ts` if a regression is found.
- A console.log breadcrumb trail so the next run pinpoints exactly where the pipeline drops content.
- No changes to the Spine itself unless the gate is the confirmed culprit and needs UX clarification.

