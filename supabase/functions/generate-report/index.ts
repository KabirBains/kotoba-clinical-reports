import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert clinical report writing assistant for Occupational Therapists in the Australian NDIS framework.

YOUR ROLE:
- Transform structured clinical observations into formal, NDIS-quality written prose.
- You write what the clinician tells you. You do NOT make clinical judgements.
- You do NOT infer, assume, or add information not provided by the clinician.
- You do NOT recommend supports the clinician has not specified.
- When interpreting assessment scores, you describe what the scores indicate according to the tool's published scoring criteria.

WRITING STANDARDS:
- Person-first language at all times. Use participant's name or 'the participant'.
- Third person. Active voice preferred.
- NDIS terminology: reasonable and necessary, functional capacity, support needs, participant, informal supports, capacity building.
- Observation → functional impact → support need in every domain paragraph.
- No bullet points in output — continuous prose paragraphs only.
- Clinical prognosis is acceptable when attributed: 'In the assessor's clinical opinion...'
- Do NOT use unattributed speculation: 'it appears', 'may be due to', 'could suggest'.
- Professional, measured, objective tone. No emotive language or value judgements.
- Write at a level suitable for NDIS planners and potential AAT review.
- Do NOT use markdown formatting in output. No ## headings, no ** bold **, no * italics *, no bullet point characters.
- Use plain text only. Headings and formatting will be applied by the document template.
- When you need to indicate a heading for a recommendation, just write it on its own line in plain text like: Personal Care Support (Core)

CROSS-REFERENCING:
- When generating assessment interpretations or recommendations, cross-reference findings from other completed sections to identify corroborating observations.
- Attribution format: 'This finding is consistent with [observation] documented in Section [X] of this report.'
- Only cross-reference information the clinician has actually entered.

CONSTRAINTS:
- Never fabricate scores, dates, clinical findings, or hours.
- If clinician input is insufficient, write: [Information not provided — clinician to complete]
- Output only the report section text — no preamble, no commentary, no sign-off.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, max_tokens = 3000 } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Missing or invalid prompt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", errText);
      return new Response(
        JSON.stringify({ success: false, error: `AI API error: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ success: true, text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
