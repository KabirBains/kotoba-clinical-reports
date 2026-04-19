

## Goal

Replace `src/lib/diagnosis-library.ts` with the expanded library from the uploaded `diagnosis_picker-2.jsx` (~250+ DSM-5 / ICD-10 entries across new categories), while keeping the existing `DiagnosisPicker.tsx` UI untouched.

## Why not replace the picker UI

The uploaded file's `DiagnosisPicker` component is a standalone JSX prototype using inline styles and hard-coded fonts. The project's current `src/components/editor/DiagnosisPicker.tsx` already implements the **same behaviour** (search by name/ICD/DSM/keyword, category chips, primary/secondary toggle, expandable description, custom diagnosis form) using Tailwind + shadcn, integrated with `notes` JSONB persistence and `DiagnosisInstance` types. Swapping it would regress styling and break props/state wiring. Only the data needs updating.

## Change — `src/lib/diagnosis-library.ts`

Replace the `DIAGNOSIS_LIBRARY` array with the full list extracted from the uploaded file (lines 14–approx 580 of the upload). Keep:

- The existing `DiagnosisEntry` interface (`id`, `name`, `icd10`, `dsm5`, `category`, `description`, `isCustom?`)
- The existing `DiagnosisInstance` interface (`isPrimary?`)
- The existing `DIAGNOSIS_CATEGORIES` derivation (`[...new Set(...)].sort()`) — auto-picks up the new categories

New categories that will appear in the filter chips automatically:

```
Neurodevelopmental, Intellectual Disability, Psychosocial,
Anxiety, Trauma & Stressor-Related, Obsessive-Compulsive,
Substance Use, Eating Disorders, Sleep-Wake, Personality,
Acquired Brain Injury, Neurological, Dementia & Neurocognitive,
Muscular/Physical, Genetic, Sensory, Medical
```

Order rationale within file: grouped by category banner comments (matching the upload's structure) so future edits stay readable.

## Backwards compatibility

- All existing IDs in the current library (`asd_1`, `adhd_combined`, `gad`, `ptsd`, `bpd`, `tbi`, `ms`, `parkinsons`, etc.) are preserved in the new library — saved diagnoses on existing reports keep resolving.
- A handful of IDs in the upload have **slight code refinements** (e.g. `mdd_single` ICD `F32` → `F32.9`, `id_mild` DSM `319` → `317`). This is a clinical accuracy upgrade — existing saved diagnoses just display the corrected codes on next load (the codes aren't user-editable post-add).
- One ID collision risk: the upload uses `cptsd` for Complex PTSD and the current file uses `cptsd` too — same ID, same intent. Verified safe.
- Where the upload introduces *new* level/subtype variants under an existing ICD (e.g. multiple `epilepsy_*` entries replacing the single `epilepsy`), the original `id: "epilepsy"` will be preserved as well to avoid orphaning saved data, even if the upload omits it. Same approach for `ms`, `stroke_left`/`stroke_right`, `sci_para`/`sci_tetra`, `spina_bifida`. Net result: union of old + new IDs.

## What is NOT changed

- `src/components/editor/DiagnosisPicker.tsx` — untouched
- `DiagnosisEntry` / `DiagnosisInstance` types — unchanged
- Persistence keys, AI prompts, methodology aggregator, report assembly — unaffected
- No edge functions touched

## Verification

Open a client → Notes mode → Section 6 Diagnoses → click **+ Add Diagnosis** → confirm:
- New category chips appear (Dementia & Neurocognitive, Trauma & Stressor-Related, Substance Use, Eating Disorders, Sleep-Wake)
- Searching "korsakoff", "dravet", "ftd", "anorexia", "ocd hoarding" returns results
- Existing reports with previously-saved diagnoses (e.g. ASD Level 2, ADHD Combined) still load and display correctly

