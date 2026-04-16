---
name: Clinical Spine
description: Stage 1 + 1.5 — Spine generation, cache shape, approval gate, and stale detection rules
type: feature
---
The Clinical Spine is a structured map of anchor impairments, recurring functional consequences, cross-domain links, and diagnosis→function chains derived once per report from diagnoses + assessments + functional notes + collateral.

**Edge function**: `build-clinical-spine` deployed to the Kotoba project (`rxczgtazoyvbdtlwnidu`). Single Claude call, low temperature (0.2), strict JSON output. Invoked via `kotobaSupabase.functions.invoke('build-clinical-spine', ...)`.

**Cache**: stored under `reports.notes.__clinical_spine__` with shape `{ spine, status: 'draft'|'approved'|'stale', approved_at, source_hash }`. Key constant exported as `SPINE_CACHE_KEY` from `src/ai/spineCache.ts`.

**Hashing**: SHA-256 over CANONICALISED JSON (recursive key sort + whitespace trim + null normalisation). Inputs hashed: diagnoses, assessment scores/interpretations, Section 12 raw notes, top-level section notes, participant pronoun/name fields. Excluded: recommendations, goals, the spine cache itself, formatting fields.

**Stale detection**: `markSpineStaleIfNeeded(notes)` runs on report load and re-flags status to `stale` when source hash drifts. Never auto-regenerates — clinician must explicitly re-approve.

**Pronoun consistency**: System prompt enforces `participant_first_name` and `participant_pronouns` across every narrative field (evidence, label, chain). Never "the participant", never mixed pronouns.

**Approval gate (Stage 1.5)**: Full-report generation (`handleGenerateFullReport` button in ClientEditor) is blocked until `spineCache.status === "approved"`. Single-section regenerates remain ungated until Stage 2 wires the spine into per-section calls. Toast prompts switch the editor to Report Mode and scrolls to the panel.

**UI**: `ClinicalSpinePanel` mounted at the top of Report Mode. Read-only display only — no inline editing in this stage. States: missing → "Generate" button; draft/stale → structured display + "Approve" / "Regenerate"; approved → collapsed badge + expand + "Regenerate".

**Dev validator**: `window.__kotobaRunSpineOnReport(reportId)` from `src/ai/devSpineValidator.ts` runs the spine builder against any existing report and logs the spine alongside `report_content` for manual quality comparison.

**Out of scope until Stage 2+**: spine injection into `generate-report`, prior-section context windowing, inline summaries, `thread-narrative` tuning, full editor UI, coverage metric, regeneration scope logic.
