

## Goal

Two targeted edits to `src/lib/subsection-fields.ts`:

1. Add **"Supervision Required"** to the PADL ratings (used by 14.3 Personal ADLs and 14.4 Domestic IADLs since `DOMESTIC_IADL_RATINGS = PADL_RATINGS`).
2. Replace the inappropriate dropdown for **Behaviour regulation** and **Emotional regulation** in 14.8 with clinically meaningful options (frequency/severity of dysregulation rather than "Adequate / Avoidant").

## Change 1 — PADL ratings (affects 14.3 + 14.4)

Updated `PADL_RATINGS`:
```
Independent
Supervision Required        ← NEW (sits between Independent and Prompting)
Prompting Required
Assistance Required
Fully Dependent
```

Order rationale: "Supervision Required" reflects the participant performing the task themselves but needing someone present for safety — a lighter level of support than verbal prompting, so it slots in second.

## Change 2 — 14.8 Behaviour & Emotional regulation

These two fields currently use `SOCIAL_RATINGS` (`Adequate / Mildly Impaired / Significantly Impaired / Avoidant / Unable to Determine`), which doesn't describe dysregulation well — "Avoidant" is meaningless for emotional regulation, and "Adequate" understates clinical relevance.

Introduce a new shared scale, `REGULATION_RATINGS`, applied to both fields:

```
Self-Regulates
Occasional Dysregulation
Frequent Dysregulation
Pervasive Dysregulation
Unable to Determine
```

Rationale per option:
- **Self-Regulates** — participant manages internal state / behaviour without external support
- **Occasional Dysregulation** — episodes are infrequent, recover independently or with minimal prompting
- **Frequent Dysregulation** — recurring episodes, requires external co-regulation strategies
- **Pervasive Dysregulation** — near-constant dysregulation, requires full external regulation / behaviour support plan
- **Unable to Determine** — preserved for consistency with other scales

The "1:1 interactions" and "Group settings" fields in 14.8 keep `SOCIAL_RATINGS` — that scale fits social engagement appropriately.

## What is NOT changed

- No other subsections, no field IDs, no labels, no placeholders.
- No changes to AI prompts, edge functions, report assembly, or stored data.
- Existing reports with old values (e.g. "Adequate") still display correctly — they just won't match a new dropdown option until re-selected.

## Verification

Open a client → Notes mode → 14.3, 14.4, 14.8 → confirm the new dropdown options appear and the regulation fields read sensibly.

