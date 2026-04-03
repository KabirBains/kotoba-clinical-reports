import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REVIEW_SYSTEM_PROMPT = `You are a quality assurance reviewer for NDIS Functional Capacity Assessment reports written by occupational therapists in Australia.

Your task is to review a complete FCA report and produce a structured JSON scorecard identifying quality issues across three categories:

CATEGORY A — Clinical & Structural (32 criteria)
Check for:
A1: Person-first language throughout (e.g. "participant who experiences..." not "disabled participant")
A2: Third-person voice (no "I", "we", "you")
A3: Active voice preferred over passive
A4: NDIS terminology used correctly (reasonable and necessary, functional capacity, support needs)
A5: Observation → impact → support need structure in domain paragraphs
A6: No bullet points in prose sections
A7: No markdown formatting (no **, ##, *, etc.)
A8: Clinical prognosis attributed ("In the assessor's clinical opinion...")
A9: No emotive or subjective language
A10: No fabricated data (scores, dates, hours that appear without evidence)
A11: Participant name used consistently
A12: Diagnoses stated factually, not as defining characteristics
A13: Support ratios justified with clinical reasoning
A14: Recommendations linked to functional limitations
A15: Section 34 justification present for each recommendation
A16: Goals are SMART or functionally anchored
A17: Risk statements evidence-based
A18: Assessment scores correctly interpreted
A19: Medication/medical info not overstepped (scope of practice)
A20: Informal supports acknowledged
A21: Cultural considerations noted if relevant
A22: Consent and methodology documented
A23: Each functional domain addresses capacity vs performance
A24: Support hours proportional to identified needs
A25: No contradictions between sections
A26: Prognosis realistic and evidence-based
A27: Environmental factors documented
A28: Participant goals reflected in recommendations
A29: Time-based language used ("at the time of assessment")
A30: No absolute language ("always", "never", "cannot")
A31: Strengths-based language included
A32: Review period recommended

CATEGORY B — Editorial & Coherence (8 criteria)
B1: Spelling and grammar
B2: Sentence flow and readability
B3: Consistent terminology (same terms used throughout)
B4: Appropriate paragraph length (not single sentences, not walls of text)
B5: Professional tone maintained
B6: No repetitive phrasing across sections
B7: Logical section ordering
B8: No orphan or incomplete sentences

CATEGORY C — Cross-Section Consistency (8 criteria)
C1: Diagnoses in Section 4 match references throughout report
C2: Goals in Section 3 reflected in recommendations
C3: Functional limitations in Section 14 supported by assessment results in Section 15
C4: Recommendations reference appropriate functional domains
C5: Risk factors in Section 11 addressed in recommendations
C6: Informal supports in Section 7 considered in recommended hours
C7: Assessment scores in Section 15 consistent with domain observations in Section 14
C8: Section 34 justifications reference disability-specific functional impacts

SCORING:
- Each criterion is pass (1) or fail (0)
- Category A: /32, Category B: /8, Category C: /8
- Overall score: sum / 48 × 100, rounded to nearest integer
- Letter grade: A+ (97-100), A (93-96), A- (90-92), B+ (87-89), B (83-86), B- (80-82), C+ (77-79), C (73-76), C- (70-72), D (60-69), F (<60)

ISSUE REPORTING:
For each failed criterion, create an issue object with:
- id: unique string (e.g. "issue_A1_1")
- criterion: the criterion code (e.g. "A1")
- category: "clinical", "editorial", or "cross_section"
- severity: "high" (affects clinical validity), "medium" (affects quality), "low" (style/polish)
- title: short description
- description: detailed explanation
- section: which report section contains the issue
- flaggedText: the exact text that triggered the issue (quote directly from the report)
- tier: "auto_correct" if you can suggest a specific text replacement, "clinician_review" if clinical judgement needed
- suggestedFix: the corrected text (only for auto_correct tier, otherwise null)
- crossRefSource: for Category C issues, the source section text (otherwise null)
- crossRefTarget: for Category C issues, the target section that's inconsistent (otherwise null)

OUTPUT FORMAT:
Return valid JSON only. No markdown, no code fences. Structure:
{
  "score": <number 0-100>,
  "grade": "<letter grade>",
  "summary": "<one sentence summary>",
  "categories": {
    "clinical": { "passed": <n>, "total": 32 },
    "editorial": { "passed": <n>, "total": 8 },
    "cross_section": { "passed": <n>, "total": 8 }
  },
  "missingSections": ["<section name>", ...],
  "issues": [<issue objects>]
}`;

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

    const body = await req.json();
    const { reportText, participantName } = body;

    if (!reportText || typeof reportText !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "reportText is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPrompt = `Review the following NDIS Functional Capacity Assessment report for ${participantName || "the participant"}.

Apply ALL criteria from categories A, B, and C. Report every issue found.

=== FULL REPORT TEXT ===
${reportText}
=== END OF REPORT ===

Return the quality scorecard as valid JSON only.`;

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
        system: REVIEW_SYSTEM_PROMPT,
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
    const rawText = result.content?.[0]?.text || "";

    // Parse JSON from response
    let scorecard;
    try {
      const cleaned = rawText.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
      scorecard = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse scorecard JSON:", parseErr, rawText.slice(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: "Failed to parse quality scorecard from AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, scorecard }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("review-report error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
