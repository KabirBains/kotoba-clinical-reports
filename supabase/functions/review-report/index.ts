import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * REPORT QUALITY CHECKER (v2 — focused redesign)
 * ---------------------------------------------------------------------------
 * Replaces the previous 48-criterion rubric with FOUR narrow categories that
 * map onto the actual failure modes of an AI-generated FCA report:
 *
 *   1. CONTRADICTIONS  — intra-report disagreements (numerical, severity,
 *                        diagnostic, date, hours)
 *   2. HALLUCINATIONS  — claims in the report NOT traceable to source data
 *                        (clinician notes, Liaise evidence bank, diagnosis
 *                        list, assessment list)
 *   3. MISPLACEMENT    — content in the wrong section (recommendation in
 *                        Background, etc.)
 *   4. MISSING_ESSENTIAL — required content gaps (Section 34 justifications,
 *                        Risk profile entries for BoCs, orphaned Liaise items)
 *
 * Style / grammar / readability / person-first / voice / tone are EXPLICITLY
 * NOT checked — the report is AI-generated and those checks produce noise.
 *
 * SCORING (deterministic — same issue list always yields the same score):
 *   score = max(0, 100 - 8*high - 3*medium - 1*low)
 *
 * READINESS gate (deterministic):
 *   "ready"               score >= 90 AND zero high-severity issues
 *   "review_recommended"  score >= 75 AND ≤ 1 high-severity issue
 *   "address_issues"      otherwise
 *
 * CONSISTENCY: temperature is set to 0 so multiple calls with the same input
 * converge on the same issue set. The scoring formula is pure JS math, not
 * AI — once issues are detected the score is identical run-to-run.
 *
 * SOURCE-DATA INPUT (the v1 edge function only saw the report text and
 * therefore couldn't verify hallucinations):
 *   - diagnoses           : string[] of canonical diagnosis names
 *   - assessments         : Array<{ tool, scores }> of administered assessments
 *   - clinician_notes     : Record<sectionId, text>
 *   - collateral_evidence : EvidenceItem[] from Liaise bank
 *   - recommendations     : Array<{ supportName, recommendedHours, ... }>
 *   - participant_goals   : Array<{ number, text }>
 *
 * All optional — if not provided, the relevant checks are skipped (the model
 * is told "no source data for X, so don't flag hallucinations against it").
 * ---------------------------------------------------------------------------
 */

const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are a quality-assurance reviewer for NDIS Functional Capacity Assessment (FCA) reports. Your job is narrow and specific: catch FACTUAL and STRUCTURAL issues, not stylistic ones, and not items outside the OT's scope of practice.

═══════════════════════════════════════════════════════════════════════════
ABSOLUTELY DO NOT FLAG — these are HARD STOPS. Issues with the following
titles, descriptions, or framings MUST NOT appear in your output:
═══════════════════════════════════════════════════════════════════════════

GRAMMAR / STYLE / WRITING (the report is AI-generated; these are not your concern):
- "Person-first language" / "use of person-first language"
- "Third-person voice" / "first-person voice used"
- "Active vs passive voice" / "passive voice"
- "Readability" / "sentence flow" / "poor sentence flow" / "sentence variety"
- "Paragraph length" / "wall of text"
- "Grammar" / "spelling" / "punctuation"
- "Tone" / "professionalism" / "clinical register"
- "Stylistic word choice" / "terminology preference"
- "Markdown" / "formatting" / "bullet-point usage"
- "Could be expanded" / "could include more detail"
- Any framing that critiques HOW something is written rather than WHETHER it is correct

CLINICIAN VOICE / OBSERVATIONAL FRAMING (the report uses "the writer" / "the assessor"):
- Do NOT flag sentences like "the writer observed", "the assessor noted", or first-person clinical voice
- The clinician's own writing voice is intentional and not in your scope

SCOPE-OF-PRACTICE EXCLUSIONS (these belong to other roles, not the OT):
- NDIS plan dates, plan review dates, plan funding allocations — these are managed by Support Coordinators, not OTs. Do NOT flag plan-date fabrication or plan-funding inconsistencies.
- Assessment administration dates (e.g. WAIS-IV 2024, DASS-42 March 2025) — clinicians may legitimately omit dates in summary lists. Do NOT flag missing assessment dates as contradictions OR as fabricated dates. Date mismatches WITHIN the same assessment ARE valid contradictions, but a date appearing in one section and being absent (not contradicted) in another is fine.
- Service dates from external providers, billing-system dates, plan-management cycle dates — outside scope.

OUTPUT-LEVEL HARD RULE: If you find yourself writing an issue with a title containing any of the words "person-first", "first-person", "third-person", "passive voice", "active voice", "sentence flow", "readability", "grammar", "tone", "professionalism", "register", "markdown", "formatting", "plan date", "plan review", or "writing style" — DELETE the entire issue. It does not belong in the output.

YOU MUST FLAG only these four categories:

──────────────────────────────────────────────────────
CATEGORY 1 — CONTRADICTIONS (intra-report consistency)
──────────────────────────────────────────────────────
A claim asserted in two parts of the report that disagrees with itself. Examples:
  • Numerical inconsistency — DASS-42 Depression score "28/42" in Mental Health Risk vs "31/42" in Assessments summary
  • Severity mismatch — "moderate cognitive impairment" in Background vs "markedly impaired cognition" in Cognition section, with no acknowledgement that they're describing the same thing
  • Date mismatch — Last admission stated as "2024" in one section, "2023" in another
  • Diagnosis name mismatch — "Major depressive disorder" in Diagnoses vs only "depression" or "anxiety disorder" elsewhere (when MDD is the documented diagnosis)
  • Hours mismatch — Recommendations table says "35 hours/week" but the Recommendation justification narrative says "30 hours per week"
  • Frequency / duration mismatch — "Two falls in 6 months" in Risk vs "two falls in the past year" in ADL narrative
  • Age / chronology mismatch — Diagnosis date or age that doesn't match across sections
  • Carer status mismatch — "primary informal carer is her mother" in one section, "no informal supports" in another
  • Participant-name inconsistency — wrong first name used somewhere in the report (e.g. "Marcus" in a paragraph about a participant whose actual first name is "Jordan"). This is a HIGH-severity issue — a participant-name typo is a serious clinical-quality failure even if everything else is correct.

NOT a contradiction — DO NOT FLAG. A contradiction requires two source statements that ASSERT DIFFERENT FACTS. The following are OMISSIONS not contradictions and you must NOT flag them:
  • Same fact stated with different wording in different sections (e.g. "the participant requires hands-on assistance" vs "Marcus needs physical help" — same meaning).
  • One section provides MORE DETAIL than another section about the same fact. The shorter version is omitting detail, not contradicting. Examples that you MUST NOT flag:
      - Section 3 says "Bipolar I disorder, last manic episode 2023" and Section 4 says just "Bipolar I disorder" → NOT a contradiction
      - Section 3 says "(FSIQ 52, WAIS-IV 2024)" and Section 4 says "(FSIQ 52)" → NOT a contradiction. Section 4 is a diagnosis-list summary; it does not need to repeat the assessment year.
      - Section 6 says "DASS-42 (Depression 28/42, Anxiety 21/42, Stress 23/42)" and Section 12.3 says only "DASS-42 Depression: 28/42" → NOT a contradiction. The shorter version omits the other subscales but doesn't disagree.
      - Section 3 says "lamotrigine 150mg twice daily" and Section 12.3 says just "lamotrigine" → NOT a contradiction.
  • Same numerical score with or without severity interpretation. One section saying "DASS-42 Depression 28/42" and another saying "DASS-42 Depression 28/42 (severe)" are NOT contradicting. The interpretation is supplementary commentary, not a different fact. Same applies to "WHODAS 68%" vs "WHODAS 68% (substantial disability)". Do NOT flag these.
  • Different sections quoting the same fact with different surrounding context (e.g. one says "the participant has documented suicidal ideation" and another says "Marcus has expressed suicidal ideation twice in the past 6 months") — same finding, different elaborations. NOT a contradiction.
  • Same person referred to by full name in one place and first name elsewhere.
  • Same diagnosis named with full clinical name in one place ("Major depressive disorder, recurrent") and abbreviated elsewhere ("MDD") — assuming both refer to the same condition.

The TEST FOR A REAL CONTRADICTION: rewrite the two passages as standalone sentences. If both are simultaneously true, it's NOT a contradiction. "(FSIQ 52, WAIS-IV 2024)" and "(FSIQ 52)" are simultaneously true — both report FSIQ 52, the second just doesn't mention the year. NOT a contradiction. By contrast: "Depression score 28/42" and "Depression score 31/42" are NOT simultaneously true — IS a contradiction.

──────────────────────────────────────────────────────
CATEGORY 2 — HALLUCINATIONS (claims not in source data)
──────────────────────────────────────────────────────
Claims in the report that aren't traceable to the SOURCE DATA provided below. Use the source data as the canonical ground truth. Specifically flag:
  • A score, date, hour count, age, or quantity in the report that doesn't appear in any source
  • A diagnosis or condition mentioned that isn't in the DIAGNOSIS LIST
  • An assessment cited that isn't in the ASSESSMENTS LIST
  • A direct quote attributed to an informant who's not in the COLLATERAL EVIDENCE BANK
  • A family relationship or carer role not in the clinician notes or bank (e.g. report mentions "his brother" but no brother is documented)
  • A residence type, day programme, school, or service not mentioned in any source
  • An incident or event with specifics (dates, durations, locations) not in any source
  • Clinical inferences with assessment-style anchors ("good proprioceptive awareness", "intact sensory integration") not supported by an actual assessment

If a claim is reasonable inference from the source data (e.g. "requires structured supports" inferred from documented executive-function deficits), don't flag it as hallucination. Only flag claims with SPECIFIC factual anchors (numbers, names, scores, dates, identities) that aren't traceable.

If the source data for a category is empty or not provided, do NOT flag claims against it — the human reviewer is responsible for verifying claims when source data is unavailable.

DEMOGRAPHIC / CONTEXTUAL CLAIMS — when a report mentions a benign demographic or contextual fact (living arrangement, pension status, family composition, employment, cultural background, educational history) that isn't in the source data, do NOT flag it as a hallucination. These are typically clinician knowledge that hasn't been entered into structured fields. Reserve hallucination flags for SPECIFIC factual anchors (numbers, scores, dates, diagnoses, named informant quotes, specific incidents).

VERIFICATION DISCIPLINE — before flagging anything as a hallucination:
  1. Scan ALL clinician notes keys (the notes block is keyed by section — a claim about the carer's health may appear in section3_disability, not just section15_carer_sustainability)
  2. Scan ALL collateral evidence items (don't just check items tagged for the relevant section — relevant evidence may be tagged differently)
  3. Scan recommendation justification and S34 reasoning text
  4. Only flag if the claim is genuinely absent across ALL of the above
A common false-positive pattern: flagging a claim because it doesn't appear in the most-obvious section's clinician notes, when it's actually in another section's notes. Don't make this mistake — verify across all keys.

──────────────────────────────────────────────────────
CATEGORY 3 — MISPLACEMENT (content in the wrong section)
──────────────────────────────────────────────────────
Content that clearly belongs in a different section than where it appears:
  • Recommendation-shaped content (e.g. "Marcus requires increased SW hours") in the Background section
  • Mobility findings in the Mental Health Risk section
  • Assessment scores narrative in the Functional Capacity section (should be in Section 6 / 15)
  • Risk / safety content scattered in non-risk sections
  • Demographic info appearing in clinical sections rather than Section 1 / 2
  • A diagnosis-list entry repeated in narrative form in unrelated sections

Use clinical common sense — a single sentence that touches the wrong domain is acceptable; a paragraph that clearly belongs elsewhere is misplacement.

──────────────────────────────────────────────────────
CATEGORY 4 — MISSING_ESSENTIAL (required content gaps)
──────────────────────────────────────────────────────
Required content that's missing from the report:
  • Each recommendation in Section 17 should have a Section 34 ("reasonable and necessary") justification — flag any rec without one
  • Each documented behaviour of concern should appear in the Risk profile — flag any BoC absent there
  • Liaise bank items tagged for a section that don't appear cited anywhere in that section's narrative — flag as "orphaned evidence". For example: an evidence item with tag "carer_sustainability" exists in the bank, but Section 15 (Carer Sustainability) doesn't reference it (no quote, no paraphrase, no attribution). The bank's "tags" array lists which canonical sections an item belongs to — check that each tagged item shows up in at least one of its target sections.
  • Required sections empty — Section 1 (Referral), 2 (Background), 3 (Disability), 4 (Diagnoses), 5 (Goals), 14 (Functional Capacity), 17 (Recommendations) — flag any unpopulated
  • Cultural identity acknowledgement absent when demographics indicate non-Anglo background (Māori, Aboriginal, NESB) per source data
  • Carer-sustainability content absent when source data documents a primary informal carer
  • Recommendation traceability — every recommendation should link to at least one documented functional limitation; flag if it doesn't

──────────────────────────────────────────────────────
SEVERITY (assign one to each issue):
  • HIGH — factual error, contradiction with a numerical / date / diagnostic anchor, hallucination of a specific clinical fact (diagnosis / score / relationship not in source), missing Section 34 justification on a recommendation, missing required section, participant-name inconsistency
  • MEDIUM — misplacement of substantive content, vague hallucination (claim without specific anchor), orphaned Liaise evidence, missing cultural / carer acknowledgement when source indicates relevance
  • LOW — minor placement issues (a sentence in a slightly-wrong subsection), trivial inference gaps

──────────────────────────────────────────────────────
OUTPUT FORMAT (strict JSON — no markdown, no preamble):
──────────────────────────────────────────────────────
{
  "issues": [
    {
      "id": "issue_<sequential int>",
      "category": "contradiction" | "hallucination" | "misplacement" | "missing_essential",
      "severity": "high" | "medium" | "low",
      "title": "short noun phrase, e.g. 'Conflicting DASS-42 scores'",
      "description": "1-2 sentence explanation grounded in evidence",
      "section": "section name (e.g. 'Section 12.3 Mental Health Risk')",
      "flaggedText": "verbatim quote from the report",
      "conflictsWith": "verbatim quote from the OTHER source (other section text for contradictions; or 'not in source data' for hallucinations; or 'expected location: <section>' for misplacement; or '' for missing_essential)",
      "suggestedFix": "specific text replacement if straightforward, or null if clinical judgement is needed"
    }
  ]
}

If you find no issues, return {"issues": []}.

Be CONSERVATIVE — only flag issues you can clearly evidence. False positives are worse than misses for clinician trust. If you're unsure whether something is a contradiction or just paraphrase, do not flag it.

MULTI-CATEGORY ISSUES: A single passage may have MULTIPLE distinct issues from DIFFERENT categories. Flag each one separately. For example: a sentence "Marcus requires increased SW hours" appearing in Section 2 (Background) of a report about a participant named Jordan has TWO issues:
  (a) Participant-name inconsistency ("Marcus" instead of "Jordan") — flag as high-severity contradiction
  (b) Recommendation content in the Background section — flag as medium-severity misplacement
Both must appear as separate issues in the output. Do NOT collapse them into one.

Source-data interpretation: clinician-input fields (recommendation justifications, S34 reasoning) are ADVISORY, not authoritative source-of-truth. A claim that ONLY appears in a recommendation's S34 reasoning (e.g. "given his mother's recent cancer diagnosis") and isn't supported by clinician notes / Liaise bank / diagnosis list IS still a hallucination — flag it as such, because the report narrative is asserting a fact that no documented evidence supports.

WORKED EXAMPLE for the s34-only case (apply this rule consistently):
  - Source data shows: clinician notes section3_disability does NOT mention carer cancer; collateral evidence bank does NOT include any informant report of carer cancer; recommendations[0].s34Justification reads: "Reasonable and necessary because informal supports are demonstrably unsustainable given mother's recent cancer diagnosis."
  - Report Section 17 narrative says: "given his mother's recent cancer diagnosis"
  - VERDICT: This MUST be flagged as a medium-severity hallucination. The fact "mother has cancer" is asserted in the report narrative but is only supported by a recommendation's s34 reasoning field — that field is the clinician's own inference, not documented evidence. The report has elevated unverified clinician inference into asserted clinical fact. Flag it.
  - Apply this rule to every similar case: if a specific factual claim (a diagnosis, an event, a number) appears in the report narrative but its only "source" is a recommendation's justification or s34 field, flag as hallucination.`;

interface RequestBody {
  reportText: string;
  participantName?: string;
  diagnoses?: string[];
  assessments?: Array<{ tool: string; scores?: string }>;
  clinician_notes?: Record<string, string>;
  collateral_evidence?: Array<Record<string, unknown>>;
  recommendations?: Array<{ supportName: string; recommendedHours?: string; justification?: string; s34Justification?: string }>;
  participant_goals?: Array<{ number?: number; text: string } | string>;
}

interface Issue {
  id: string;
  category: "contradiction" | "hallucination" | "misplacement" | "missing_essential";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  section: string;
  flaggedText: string;
  conflictsWith: string;
  suggestedFix: string | null;
}

interface Scorecard {
  score: number;
  readiness: "ready" | "review_recommended" | "address_issues";
  summary: string;
  stats: {
    total: number;
    high: number;
    medium: number;
    low: number;
    byCategory: { contradiction: number; hallucination: number; misplacement: number; missing_essential: number };
  };
  issues: Issue[];
}

/** Format the source data into a single block the model can read. Empty
 *  sub-blocks are skipped entirely so the model isn't tempted to flag
 *  against missing data. */
function formatSourceData(body: RequestBody): string {
  const parts: string[] = [];

  if (body.diagnoses && body.diagnoses.length > 0) {
    parts.push(`DIAGNOSIS LIST (canonical — only these may appear in the report):\n${body.diagnoses.map((d) => `  - ${d}`).join("\n")}`);
  }

  if (body.assessments && body.assessments.length > 0) {
    parts.push(`ASSESSMENTS ADMINISTERED (only these may be cited):\n${body.assessments.map((a) => `  - ${a.tool}${a.scores ? ` — ${a.scores}` : ""}`).join("\n")}`);
  }

  if (body.participant_goals && body.participant_goals.length > 0) {
    const lines = body.participant_goals
      .map((g, i) => {
        if (typeof g === "string") return `  Goal ${i + 1}: ${g}`;
        const n = g.number ?? i + 1;
        return `  Goal ${n}: ${g.text}`;
      })
      .filter((l) => l.length > 10);
    if (lines.length > 0) parts.push(`PARTICIPANT GOALS:\n${lines.join("\n")}`);
  }

  if (body.recommendations && body.recommendations.length > 0) {
    // We expose the full justification + s34 text (not just presence) so
    // the model can verify report claims that reference recommendation
    // detail. Without this, a report sentence like "given his mother's
    // cancer diagnosis" gets flagged as a hallucination even when the
    // clinician put that detail into the s34Justification field. Truncate
    // long fields to keep the prompt budget under control.
    const lines = body.recommendations.map((r, i) => {
      const bits = [`  Rec ${i + 1}: ${r.supportName}`];
      if (r.recommendedHours) bits.push(`(${r.recommendedHours})`);
      const trimJust = (r.justification || "").trim();
      const trimS34 = (r.s34Justification || "").trim();
      if (trimS34) bits.push("[has S34 justification]");
      else bits.push("[NO S34 JUSTIFICATION]");
      let block = bits.join(" ");
      if (trimJust) block += `\n      Justification: ${trimJust.slice(0, 400)}${trimJust.length > 400 ? " …" : ""}`;
      if (trimS34) block += `\n      S34 reasoning: ${trimS34.slice(0, 400)}${trimS34.length > 400 ? " …" : ""}`;
      return block;
    });
    parts.push(`RECOMMENDATIONS LIST (with clinician-input justification text):\n${lines.join("\n")}`);
  }

  if (body.clinician_notes && Object.keys(body.clinician_notes).length > 0) {
    const noteLines = Object.entries(body.clinician_notes)
      .filter(([k, v]) => !k.startsWith("__") && typeof v === "string" && v.trim())
      .map(([k, v]) => `  [${k}] ${(v as string).slice(0, 600)}${(v as string).length > 600 ? " …" : ""}`);
    if (noteLines.length > 0) parts.push(`CLINICIAN NOTES (by section):\n${noteLines.join("\n")}`);
  }

  if (body.collateral_evidence && body.collateral_evidence.length > 0) {
    const lines = body.collateral_evidence
      .filter((ev) => typeof ev?.answer === "string" && (ev.answer as string).trim())
      .map((ev) => {
        const name = ev.informant && ev.informant !== "[Unnamed informant]" ? `${ev.informant}, ${ev.role || ev.template}` : `${ev.role || ev.template}`;
        const tags = Array.isArray(ev.tags) ? ` [tags: ${(ev.tags as string[]).join(", ")}]` : "";
        return `  - [${ev.template} — ${name}]${tags} ${ev.question}: ${ev.answer}`;
      });
    if (lines.length > 0) parts.push(`COLLATERAL EVIDENCE BANK (Liaise interviews):\n${lines.join("\n")}`);
  }

  if (parts.length === 0) {
    return "(NO SOURCE DATA PROVIDED — do NOT flag hallucinations or missing-essentials based on absent data; only flag clear intra-report contradictions and obvious misplacements.)";
  }

  return parts.join("\n\n");
}

/** Score formula. Pure math — given the same issue list, the score is identical
 *  every run. The model's job is detecting issues; the score is computed here. */
function computeScorecard(issues: Issue[]): Scorecard {
  const stats = {
    total: issues.length,
    high: issues.filter((i) => i.severity === "high").length,
    medium: issues.filter((i) => i.severity === "medium").length,
    low: issues.filter((i) => i.severity === "low").length,
    byCategory: {
      contradiction: issues.filter((i) => i.category === "contradiction").length,
      hallucination: issues.filter((i) => i.category === "hallucination").length,
      misplacement: issues.filter((i) => i.category === "misplacement").length,
      missing_essential: issues.filter((i) => i.category === "missing_essential").length,
    },
  };

  const score = Math.max(0, 100 - 8 * stats.high - 3 * stats.medium - 1 * stats.low);

  let readiness: Scorecard["readiness"];
  if (score >= 90 && stats.high === 0) readiness = "ready";
  else if (score >= 75 && stats.high <= 1) readiness = "review_recommended";
  else readiness = "address_issues";

  let summary: string;
  if (issues.length === 0) {
    summary = "No factual or structural issues detected.";
  } else if (stats.high === 0 && stats.medium === 0) {
    summary = `${stats.low} minor issue${stats.low === 1 ? "" : "s"} flagged for review.`;
  } else if (stats.high === 0) {
    summary = `${stats.medium} medium-severity issue${stats.medium === 1 ? "" : "s"} for review${stats.low > 0 ? `, plus ${stats.low} minor` : ""}.`;
  } else {
    summary = `${stats.high} high-severity issue${stats.high === 1 ? "" : "s"} need${stats.high === 1 ? "s" : ""} addressing${stats.medium > 0 ? `, plus ${stats.medium} medium` : ""}${stats.low > 0 ? `, plus ${stats.low} minor` : ""}.`;
  }

  return { score, readiness, summary, stats, issues };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!CLAUDE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "CLAUDE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { reportText, participantName } = body;
    if (!reportText || typeof reportText !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "reportText is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Length safety. A real FCA can run 30-40 pages. Claude Sonnet's input
    // window is generous (~200K tokens) but the *output* is capped at 6K
    // tokens here — enough for a long issue list but not infinite. If the
    // report is materially over a typical FCA budget (~25K characters),
    // log a warning header so the caller knows the review may be partial.
    // We do NOT truncate the report — the model handles long context fine,
    // we just want telemetry on edge cases.
    const reportLen = reportText.length;
    if (reportLen > 80_000) {
      console.warn(`review-report: large report (${reportLen} chars) — issue list may be partial`);
    }

    const sourceData = formatSourceData(body);
    const userPrompt = `Review this NDIS Functional Capacity Assessment report for ${participantName || "the participant"}. Apply the four-category rubric. Flag only what's clearly wrong.

=== REPORT TEXT ===
${reportText}
=== END OF REPORT ===

=== SOURCE DATA ===
${sourceData}
=== END OF SOURCE DATA ===

Return the issues as strict JSON. Be conservative — false positives erode clinician trust. Only flag what you can clearly evidence.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        // Temperature 0 was causing deterministic mid-output stalls on
        // long prompts — a tiny temperature breaks the stall while keeping
        // output highly consistent. The deterministic scoring formula
        // applied to the issue list still produces stable scores
        // run-to-run because the issue set converges.
        temperature: 0.05,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Claude API error:", response.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: `Claude API error: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const rawText: string = result.content?.[0]?.text || "";

    /**
     * Parse the model's response, handling the case where Claude self-
     * corrects mid-response and emits MULTIPLE JSON blocks separated by
     * commentary like "Wait, let me reconsider..." This happens when the
     * model initially writes an issue, then realises it conflicts with a
     * "DO NOT FLAG" rule in the prompt, and writes a corrected (often
     * empty) JSON block after. We want the FINAL JSON block — that's the
     * model's settled answer.
     *
     * Strategy: find every ```json...``` fenced block in the response,
     * try to parse each, and return the last one that parses successfully.
     * Fall back to the legacy "find {...}" heuristic if no fenced blocks
     * are found.
     */
    let parsed: { issues?: Issue[] };
    try {
      const fencedBlocks: string[] = [];
      const fencedRegex = /```json?\s*([\s\S]*?)\s*```/gi;
      let match: RegExpExecArray | null;
      while ((match = fencedRegex.exec(rawText)) !== null) {
        fencedBlocks.push(match[1].trim());
      }

      let parsedAny: { issues?: Issue[] } | null = null;
      // Try fenced blocks last-to-first so the model's final answer wins.
      for (let i = fencedBlocks.length - 1; i >= 0; i--) {
        try {
          parsedAny = JSON.parse(fencedBlocks[i]);
          break;
        } catch { /* try the previous block */ }
      }

      // Legacy fallback for responses without ```json fences.
      if (!parsedAny) {
        let cleaned = rawText.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
        // Find the LAST top-level brace pair (model's settled answer)
        const lastClose = cleaned.lastIndexOf("}");
        if (lastClose >= 0) {
          // Walk back to find matching open brace
          let depth = 0;
          let start = -1;
          for (let i = lastClose; i >= 0; i--) {
            if (cleaned[i] === "}") depth++;
            else if (cleaned[i] === "{") {
              depth--;
              if (depth === 0) { start = i; break; }
            }
          }
          if (start >= 0) cleaned = cleaned.slice(start, lastClose + 1);
        }
        parsedAny = JSON.parse(cleaned);
      }

      parsed = parsedAny ?? { issues: [] };
    } catch (parseErr) {
      console.error("Failed to parse review JSON:", parseErr, rawText.slice(0, 1000));
      return new Response(
        JSON.stringify({ success: false, error: "Failed to parse review response", raw: rawText, rawLen: rawText.length }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const issues = Array.isArray(parsed.issues) ? parsed.issues : [];

    // Server-side belt-and-braces filter. The prompt explicitly forbids
    // flagging style / grammar / clinician-voice issues, plus scope-of-
    // practice items that belong to Support Coordinators (NDIS plan dates,
    // plan review dates, plan funding) or aren't relevant to OT review
    // (assessment administration date "fabrication"). The model usually
    // obeys but occasionally leaks one of these — we drop them here based
    // on the issue title or description containing a banned pattern, so
    // the user never sees them regardless.
    const BANNED_ISSUE_PATTERNS: RegExp[] = [
      // Style / grammar / writing-mechanics patterns
      /person[\s-]?first language/i,
      /\b(first|third)[\s-]?person (voice|language)/i,
      /\b(active|passive) voice\b/i,
      /sentence flow|sentence variety|sentence structure/i,
      /\breadability\b/i,
      /paragraph length|wall of text/i,
      /\b(grammar|spelling|punctuation)\b/i,
      /\btone\b.*\b(report|writing|professional)/i,
      /\bclinical register\b/i,
      /stylistic (word choice|preference|consistency)/i,
      /markdown formatting|bullet[\s-]?point (usage|formatting)/i,
      /could be (expanded|more detailed|more comprehensive)/i,
      /writing style|prose style/i,
      // Clinician-voice flags
      /the writer (observed|noted|notes|documented)/i,
      /first[\s-]?person clinical voice/i,
      // Out-of-scope flags (managed by Support Coordinators, not OTs)
      /\b(ndis )?plan date|plan review date|plan funding|plan-date/i,
      /\bassessment (administration )?date.* (fabricat|invent|missing)/i,
      // Severity-interpretation differences (one section labels a score
      // "severe", another doesn't — same number, not a contradiction)
      /\bseverity (interpretation|label|classification) (inconsisten|missing|differ)/i,
      /inconsistent.*severity (interpretation|label|description)/i,
      /\b(severe|moderate|mild) (interpretation|classification) (missing|absent|not provided)/i,
    ];

    function shouldDropIssue(iss: Issue): boolean {
      const haystack = `${iss.title || ""} ${iss.description || ""}`;
      return BANNED_ISSUE_PATTERNS.some((re) => re.test(haystack));
    }

    const filtered = issues.filter((iss) => !shouldDropIssue(iss as Issue));

    // Re-id issues sequentially for stable ordering across runs (the model
    // sometimes uses arbitrary ids). Stable ids make consistency testing
    // easier and let the UI persist statuses across re-checks.
    const ordered = filtered.map((iss, i) => ({
      ...iss,
      id: `issue_${i + 1}`,
    } as Issue));

    const scorecard = computeScorecard(ordered);

    return new Response(
      JSON.stringify({ success: true, scorecard }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error("review-report error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
