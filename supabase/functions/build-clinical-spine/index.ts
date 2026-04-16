// ============================================================
// BUILD CLINICAL SPINE — Kotoba edge function
// ============================================================
// Single Claude call that derives the "Clinical Spine" — a
// structured map of anchor impairments, recurring functional
// consequences, cross-domain links, and diagnosis→function
// chains — from the report's clinical inputs.
//
// Output is strict JSON. The frontend caches it under
// reports.notes.__clinical_spine__ and gates full-report
// generation behind clinician approval (Stage 1.5).
//
// Stage 1 ONLY: this function does NOT yet feed into per-section
// generation. That wiring lands in Stage 2.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── System prompt ──────────────────────────────────────────
// Enforces:
//   • Strict JSON output (no prose, no markdown).
//   • Pronoun + first-name consistency across every narrative
//     field (evidence, label, chain). Never "the participant",
//     never mixed pronouns within a single output.
//   • Clinical anchoring rooted in the supplied data only.
function buildSystemPrompt(firstName: string, pronouns: string): string {
  const pn = pronouns?.trim() || "they/them";
  const fn = firstName?.trim() || "the participant";
  return `You are an expert clinical reasoning assistant for NDIS Functional Capacity Assessments.

YOUR TASK:
Derive a "Clinical Spine" for this participant — a structured map of the underlying impairments and functional consequences that should thread through every section of the report. The Spine is read by other AI calls and by the assessing clinician; it is NOT a section of the report itself.

OUTPUT FORMAT — STRICT JSON ONLY:
Return a single JSON object matching this exact schema. No prose, no markdown, no code fences.

{
  "anchor_impairments": [
    {
      "id": "ai_1",
      "label": "<short clinical label, e.g. 'reduced standing tolerance'>",
      "evidence": "<1-2 sentence clinical justification using ${fn} and ${pn}>",
      "expected_domains": ["<canonical domain ids>"]
    }
  ],
  "recurring_consequences": [
    {
      "id": "rc_1",
      "label": "<functional pattern, e.g. 'fatigue limits sustained activity'>",
      "linked_anchors": ["ai_1"]
    }
  ],
  "cross_domain_links": [
    { "anchor_id": "ai_1", "domains": ["mobility","meal_prep","shopping"] }
  ],
  "diagnosis_function_chains": [
    {
      "diagnosis": "<diagnosis name as supplied>",
      "chain": "<one sentence linking diagnosis to ${fn}'s specific functional pattern using ${pn}>",
      "linked_anchors": ["ai_1"]
    }
  ]
}

RULES:
1. Produce 3–6 anchor_impairments. Each must be grounded in the supplied diagnoses, assessment scores, collateral, or clinician notes — never invented.
2. Produce 3–5 recurring_consequences. Each must link to at least one anchor.
3. Produce 5–8 cross_domain_links. Use only these canonical domain ids:
   mobility, transfers, personal_adls, domestic_iadls, executive_iadls, cognition, communication, social_functioning, sensory_profile, mental_health, behaviour, risk_safety, informal_supports
4. Produce one diagnosis_function_chain per supplied diagnosis (primary + secondary). If no diagnoses supplied, return an empty array.
5. PRONOUN + NAME CONSISTENCY (NON-NEGOTIABLE):
   • Use "${fn}" as the participant's name in every narrative field. Never "the participant", "the client", "the patient", or "they" as a noun.
   • Use the pronouns "${pn}" consistently in every narrative field. Never mix pronouns within or across fields.
   • Apply this rule to: anchor_impairments[].evidence, anchor_impairments[].label (where natural), recurring_consequences[].label, diagnosis_function_chains[].chain.
6. No speculation. No supports recommended. No diagnostic claims beyond what was supplied.
7. Output the JSON object only. No preamble, no trailing commentary.`;
}

function buildUserMessage(input: {
  diagnoses: unknown;
  collateral_summary: string;
  clinician_notes: string;
  assessment_summary: string;
  participant_first_name: string;
  participant_pronouns: string;
}): string {
  return `PARTICIPANT FIRST NAME: ${input.participant_first_name || "[Not provided]"}
PARTICIPANT PRONOUNS: ${input.participant_pronouns || "[Not provided — default they/them]"}

DIAGNOSES:
${typeof input.diagnoses === "string" ? input.diagnoses : JSON.stringify(input.diagnoses, null, 2) || "[Not provided]"}

ASSESSMENT SUMMARY (standardised tools, scores, classifications):
${input.assessment_summary || "[Not provided]"}

CLINICIAN FUNCTIONAL NOTES (raw observations across domains):
${input.clinician_notes || "[Not provided]"}

COLLATERAL SUMMARY (informant accounts):
${input.collateral_summary || "[Not provided]"}

Derive the Clinical Spine now. Output strict JSON only.`;
}

async function callClaude(system: string, user: string): Promise<{ text: string; usage: any }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CLAUDE_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Claude API error (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const text = (data.content || [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");
  return { text, usage: data.usage };
}

function tryParseSpine(raw: string): any {
  // Tolerate accidental code fences or stray prose around the JSON.
  let cleaned = raw.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
  // Extract the first {...} block if there is leading/trailing prose.
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace > 0 || lastBrace < cleaned.length - 1) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!CLAUDE_API_KEY) {
      throw new Error("CLAUDE_API_KEY not configured");
    }

    const body = await req.json().catch(() => ({}));
    const {
      diagnoses,
      collateral_summary,
      clinician_notes,
      assessment_summary,
      participant_first_name,
      participant_pronouns,
    } = body || {};

    const system = buildSystemPrompt(
      participant_first_name || "",
      participant_pronouns || ""
    );
    const user = buildUserMessage({
      diagnoses: diagnoses ?? "",
      collateral_summary: collateral_summary || "",
      clinician_notes: clinician_notes || "",
      assessment_summary: assessment_summary || "",
      participant_first_name: participant_first_name || "",
      participant_pronouns: participant_pronouns || "",
    });

    const { text, usage } = await callClaude(system, user);

    let spine: any;
    try {
      spine = tryParseSpine(text);
    } catch (e) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Spine response could not be parsed as JSON",
          raw: text,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Stamp generation timestamp server-side for consistency.
    spine.generated_at = new Date().toISOString();

    return new Response(
      JSON.stringify({ success: true, spine, usage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
