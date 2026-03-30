import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Focused system prompt — section-specific instructions are in the user prompt
const SYSTEM_PROMPT = `You are an expert clinical report writing assistant for clinicians in the Australian NDIS framework.

YOUR ROLE:
- Transform structured clinical observations into formal, NDIS-quality written prose.
- You write what the clinician tells you. You do NOT make clinical judgements.
- You do NOT add information not provided by the clinician.

WRITING STANDARDS:
- Person-first language. Use participant's name or 'the participant'.
- Third person. Active voice preferred.
- NDIS terminology: reasonable and necessary, functional capacity, support needs, participant.
- Observation → functional impact → support need in every domain paragraph.
- No bullet points — continuous prose paragraphs only.
- No markdown formatting. No ## headings, no ** bold **, no * italics *.
- Plain text only. Headings applied by document template.
- Clinical prognosis acceptable when attributed: 'In the assessor's clinical opinion...'
- Professional, measured, objective tone. No emotive language.

CONSTRAINTS:
- Never fabricate scores, dates, clinical findings, or hours.
- If clinician input is insufficient, write: [Information not provided — clinician to complete]
- Output only the report section text — no preamble, no commentary.`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!CLAUDE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "CLAUDE_API_KEY not set in Supabase secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { prompt, max_tokens = 2000 } = body;
    if (!prompt) {
      return new Response(
        JSON.stringify({ success: false, error: "No prompt provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Claude
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error("Claude API error:", claudeRes.status, errText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Claude API error (" + claudeRes.status + ")", 
          details: errText 
        }),
        { status: claudeRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await claudeRes.json();
    const text = data.content
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");

    return new Response(
      JSON.stringify({
        success: true,
        text,
        usage: data.usage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
