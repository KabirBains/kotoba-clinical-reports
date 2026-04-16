

## Stages 1 & 1.5 — Final Plan (Approved with Clarifications)

### Confirmation: Edge function routing

`src/integrations/supabase/kotobaClient.ts` already exists and points to `https://rxczgtazoyvbdtlwnidu.supabase.co`. All existing AI edge functions (`generate-report`, `thread-narrative`, etc.) are invoked via `kotobaSupabase.functions.invoke(...)`. **`build-clinical-spine` will follow the same pattern** — deployed to Kotoba project, called via `kotobaSupabase`. The default `supabase` client (Loveable project) is used only for DB/auth and will not be touched.

### Stage 1: Spine Foundation

**1.1 Edge function: `supabase/functions/build-clinical-spine/index.ts` (Kotoba)**
- Single Claude call (low temp, ~4k output tokens), strict JSON output.
- Input: `{ diagnoses, collateral_summary, clinician_notes, assessment_summary, participant_first_name, participant_pronouns }`.
- System prompt enforces pronoun + first-name consistency: every `evidence`, `chain`, and `label` field must use `{participant_first_name}` and `{participant_pronouns}` — never "the participant", never mixed pronouns.
- Output schema: `anchor_impairments[]`, `recurring_consequences[]`, `cross_domain_links[]`, `diagnosis_function_chains[]`, `generated_at`.
- CORS + JWT verify-in-code, matching existing Kotoba functions.

**1.2 Cache shape in `reports.notes` JSONB under `__clinical_spine__`**
```json
{
  "spine": { ... },
  "status": "draft" | "approved" | "stale",
  "approved_at": "ISO" | null,
  "source_hash": "sha256-hex"
}
```

**1.3 Hash helper: `src/ai/spineCache.ts`**
- `canonicalize(value)` — recursive: sort object keys, normalise `null`/`undefined`, trim string whitespace, stable array order preservation.
- `computeSpineSourceHash(notes)` — extracts only spine-relevant inputs (diagnoses, assessment scores for DASS/WHODAS/LSP-16/FRAT/CANS/Lawton/Zarit/Sensory, Section 12 raw functional notes, collateral interview content), canonicalises, then SHA-256 via `crypto.subtle.digest`. Returns hex.
- `isSpineStale(notes)` — compares cached `source_hash` to fresh hash.
- `markSpineStaleIfNeeded(notes)` — pure helper used on report load.
- Excludes: recommendations, goals, formatting fields, the spine cache itself.

**1.4 reportEngine helper: `buildClinicalSpine(notes, participantContext)`**
- Calls Kotoba edge function via `kotobaSupabase.functions.invoke('build-clinical-spine', ...)`.
- Stores result with `status: "draft"` + current `source_hash`.
- Returns spine for immediate UI display.

**1.5 Dev-only validation helper: `src/ai/devSpineValidator.ts`**
- Not wired to UI. Exports `runSpineOnExistingReport(reportId)` callable from browser console.
- Loads a completed report from DB, derives spine inputs, calls `buildClinicalSpine`, logs the result side-by-side with the existing final report content for manual quality comparison.
- Documented in code comments only.

### Stage 1.5: Approval Checkpoint UI

**1.5.1 New component: `src/components/editor/ClinicalSpinePanel.tsx`**

Read-only display + action buttons. States:
- **No spine**: "Generate Clinical Spine" button → invokes builder, shows loading.
- **Draft**: Structured read-only render of all four spine arrays. Buttons: "Approve and proceed" / "Regenerate Spine".
- **Stale**: Same as Draft + amber banner "Upstream clinical data has changed. Re-approval required."
- **Approved**: Collapsed by default, badge "Approved · {timestamp}". Expandable. "Regenerate Spine" button.

Mounted in Report Mode, above report content, below toolbar. No editor inputs in this stage.

**1.5.2 Gate in `ClientEditor.tsx`**
- Modify ONLY `handleGenerateFullReport`: if spine missing or `status !== "approved"`, show toast and scroll to spine panel; abort.
- Single-section regenerates remain ungated (per clarification — spine isn't wired into per-section generation until Stage 2).
- On report load, run `markSpineStaleIfNeeded` to auto-flag stale spines.

### Files

```text
NEW    supabase/functions/build-clinical-spine/index.ts   (Kotoba project)
NEW    src/ai/spineCache.ts                               (canonicalise + SHA-256 + stale detection)
NEW    src/ai/devSpineValidator.ts                        (dev-only console helper)
EDIT   src/ai/reportEngine.ts                             (buildClinicalSpine helper via kotobaSupabase)
NEW    src/components/editor/ClinicalSpinePanel.tsx       (read-only display + approve/regenerate)
EDIT   src/pages/ClientEditor.tsx                         (mount panel, gate full-report generation, stale detection on load)
NEW    mem://features/clinical-spine                      (concept, gate scope, invalidation rules, hash method)
EDIT   mem://index.md                                     (add reference)
```

### Out of scope (deferred)

Stages 2–5: spine injection into generation, per-section summaries, thread-narrative tuning, full editor UI, coverage metric, regeneration scope logic. No changes to `generate-report`, `thread-narrative`, `generationQueue.ts`, or single-section regenerate flows in this pass.

