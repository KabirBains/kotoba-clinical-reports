## Quality Checker v2 — Wiring Plan

The v2 `QualityScorecard.tsx` and `review-report` edge function have already shipped. The remaining work is purely call-site wiring across **3 files**. The build is currently broken at `ReportMode.tsx` lines 1674, 1693, 1705 because of v1 prop names and v1 issue fields that no longer exist.

---

### File 1 — `src/pages/ClientEditor.tsx`

**1a. Pass full source-data payload to `review-report`** (currently only sends `reportText` + `participantName` at line 344).

Update `runQualityCheck` (lines 337–362):

```ts
import { gatherCollateralEvidence } from "@/components/editor/LiaiseMode";

const { data, error } = await supabase.functions.invoke("review-report", {
  body: {
    reportText,
    participantName: client?.client_name || "",
    diagnoses: diagnoses.map(d => d.name),
    assessments: assessments.map(a => ({
      tool: a.name,
      scores: Object.entries(a.scores || {})
        .map(([k, v]) => `${k}: ${v}`).join("; "),
    })),
    clinician_notes: Object.fromEntries(
      Object.entries(notes).filter(([, v]) => typeof v === "string" && v.trim())
    ) as Record<string, string>,
    collateral_evidence: gatherCollateralEvidence(collateralInterviews ?? []),
    recommendations: recommendations.map(r => ({
      supportName: r.supportName,
      recommendedHours: r.recommendedHours,
      justification: r.justification,
      s34Justification: r.s34Justification,
    })),
    participant_goals: (goals ?? [])
      .map((g, i) => ({ number: i + 1, text: g.text }))
      .filter(g => g.text.trim()),
  },
});
```

**1b. Replace v1 issue fields used in dismissed-key derivation.**

Lines 349–351 and 1565 currently compose dismissed-issue keys from `issue.criterion`, which no longer exists. Replace with `issue.category`:

```ts
// line ~350
const key = issue.category + "::" + issue.section + "::" + (issue.flaggedText || "").substring(0, 50);
// line ~1565 (inside onDismissIssue)
const key = issue.category + "::" + issue.section + "::" + (issue.flaggedText || "").substring(0, 50);
```

Note: this invalidates dismissed-key entries persisted by v1, but those carry stale issue identifiers anyway — re-checks under v2 will re-surface them on first run, which is the correct behaviour.

**1c. Update the `<ReportMode>` props passed at lines 1571–1582.**

- **Remove** the `onAcceptAllIssues` prop (no v2 equivalent — the "Apply N fixes" button in the scorecard footer covers this).
- **Rename** `onApplyCorrections` → `onApplyAcceptedFixes`.
- Inside the renamed handler (lines 1582–1662), replace `issue.tier === "auto_correct"` checks with `issue.suggestedFix` truthiness, and replace `issue.criterion` reads with `issue.category`:

```ts
const acceptedFixes = scorecard.issues
  .filter((issue: any) => issue.suggestedFix && issueStatuses[issue.id] === "accepted")
  .map((issue: any) => {
    /* …existing findSectionText logic… */
    return {
      section: sectionKey, sectionText,
      criterion: issue.category,        // edge function still expects `criterion` key
      flaggedText: issue.flaggedText,
      suggestedFix: issue.suggestedFix,
      description: issue.description,
    };
  });
```

(The `correct-report` edge function field name `criterion` is its own request contract — we keep that key but populate it from `issue.category`. If the function also needs updating to accept `category`, that's a separate change; the field is just a label passed through.)

---

### File 2 — `src/components/editor/ReportMode.tsx`

**2a. Drop the `onAcceptAllIssues` prop** from `interface ReportModeProps` (line 360) and remove `onAcceptAll` from the `<QualityScorecard>` invocation (line 1674 — the source of build error #1).

**2b. Rename `onApplyCorrections` → `onApplyAcceptedFixes`** in both the props interface (line 361) and the `<QualityScorecard>` invocation (line 1675).

**2c. Fix the highlighted-issue popover** (lines 1690–1724 — source of build errors #2 and #3).

- Replace `highlightedIssue.criterion` (line 1693) with `highlightedIssue.category` (or just drop the prefix and show the title alone — category is a machine-readable enum, not a label; recommended approach is to map to a human label):
  ```tsx
  const CATEGORY_LABEL = {
    contradiction: "Contradiction",
    hallucination: "Hallucination",
    misplacement: "Misplaced",
    missing_essential: "Missing",
  } as const;
  // …
  <h4 className="text-sm font-semibold text-foreground">
    {CATEGORY_LABEL[highlightedIssue.category]}: {highlightedIssue.title}
  </h4>
  ```
- Replace the `tier === "auto_correct"` branch at line 1705 with `suggestedFix` presence:
  ```tsx
  {highlightedIssue.suggestedFix ? (
    <Button …>Accept Fix</Button>
  ) : (
    <Button …>Mark as Reviewed</Button>
  )}
  ```

---

### File 3 — `src/components/DownloadReportButton.tsx`

**3a. Add the soft-confirmation export gate.** The current `handleDownload` (line 39) starts assembly immediately. Wrap it so high-severity unresolved issues raise the modal first.

- Extend `DownloadReportButtonProps` with `scorecard?: Scorecard | null` and `issueStatuses?: Record<string, IssueStatus>`.
- Import `ExportConfirmDialog`, `getExportConfirmation` from `@/components/editor/QualityScorecard`.
- Add state: `showExportConfirm`, then:

```tsx
const handleClick = () => {
  if (!props.scorecard) return handleDownload();   // no check run yet → no gate
  const gate = getExportConfirmation(props.scorecard, props.issueStatuses ?? {});
  if (gate.needsConfirmation) setShowExportConfirm(true);
  else handleDownload();
};
```

- Wire the existing `<Button>` `onClick` to `handleClick` (currently calls `handleDownload`).
- Render the dialog at the bottom of the component:

```tsx
{props.scorecard && (
  <ExportConfirmDialog
    open={showExportConfirm}
    onOpenChange={setShowExportConfirm}
    blockingIssues={getExportConfirmation(props.scorecard, props.issueStatuses ?? {}).blockingIssues}
    reason={getExportConfirmation(props.scorecard, props.issueStatuses ?? {}).reason}
    onConfirm={() => { setShowExportConfirm(false); handleDownload(); }}
    onAddressIssues={() => setShowExportConfirm(false)}
  />
)}
```

**3b. Pass `scorecard` and `issueStatuses` through `<ReportMode>` to `<DownloadReportButton>`** (line 1753 of `ReportMode.tsx`):

```tsx
<DownloadReportButton
  reportData={reportData}
  scorecard={props.scorecard}
  issueStatuses={props.issueStatuses}
/>
```

`ClientEditor` already passes both props to `<ReportMode>`, so no change is required there.

---

### Out of scope / non-changes

- **DB schema**: the existing `quality_scorecard`, `issue_statuses`, `dismissed_issue_keys` JSONB columns hold the v2 shape unchanged. No migration needed.
- **Edge functions**: `review-report` already accepts the new fields (lines 189–196 of `supabase/functions/review-report/index.ts`). `correct-report` continues to receive its existing `criterion` field — we just feed it from `issue.category`.
- **`QualityScorecard.tsx` itself**: not touched; it is the v2 source-of-truth and exports `ExportConfirmDialog` + `getExportConfirmation` ready to use.

### Acceptance

- TypeScript build passes (the 3 listed errors at `ReportMode.tsx:1674/1693/1705` are gone).
- Running "Check Report Quality" calls `review-report` with diagnoses, assessments, notes, collateral evidence, recommendations, and goals visible in the request body.
- Clicking "Download .docx Report" with ≥1 unresolved high-severity issue shows the `ExportConfirmDialog` modal; with zero, it downloads immediately as before.
- Existing flows (Accept fix, Dismiss, Acknowledge, Apply N fixes, Re-check, Clear & re-check, Find in report) continue to work.
