import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CORRECTION_SYSTEM_PROMPT = `You are a clinical report editor for NDIS Functional Capacity Assessment reports.

You will receive a list of corrections to apply to specific report sections. For each correction:
1. Find the flagged text in the section
2. Replace it with the suggested fix
3. Ensure the surrounding text still flows naturally
4. Do NOT change any other text in the section
5. Maintain person-first language, third-person voice, and NDIS terminology

Return only valid JSON with the corrected section texts. No markdown, no code fences.`;

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
    const { corrections } = body;

    if (!Array.isArray(corrections) || corrections.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "corrections array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group corrections by section
    const bySection: Record<string, { sectionText: string; fixes: { flaggedText: string; suggestedFix: string; criterion: string; description: string }[] }> = {};
    for (const c of corrections) {
      if (!bySection[c.section]) {
        bySection[c.section] = { sectionText: c.sectionText, fixes: [] };
      }
      bySection[c.section].fixes.push({
        flaggedText: c.flaggedText,
        suggestedFix: c.suggestedFix,
        criterion: c.criterion,
        description: c.description,
      });
    }

    const sectionKeys = Object.keys(bySection);
    const userPrompt = `Apply the following corrections to the report sections. For each section, replace the flagged text with the suggested fix while maintaining natural flow.

${sectionKeys.map(key => {
  const entry = bySection[key];
  const fixList = entry.fixes.map((f, i) => 
    `  Fix ${i + 1} (${f.criterion}): "${f.description}"
    FIND: "${f.flaggedText}"
    REPLACE WITH: "${f.suggestedFix}"`
  ).join("\n\n");
  return `=== SECTION: ${key} ===
ORIGINAL TEXT:
${entry.sectionText}

CORRECTIONS:
${fixList}`;
}).join("\n\n")}

Return valid JSON with this structure:
{
  "${sectionKeys[0]}": "<corrected full section text>",
  ...
}

Return ONLY the sections that had corrections applied. Output the complete corrected text for each section.`;

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
        system: CORRECTION_SYSTEM_PROMPT,
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

    let correctedSections;
    try {
      let cleaned = rawText.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
      // Find JSON boundaries
      const jsonStart = cleaned.indexOf("{");
      const jsonEnd = cleaned.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      }
      try {
        correctedSections = JSON.parse(cleaned);
      } catch {
        // Fix common issues: trailing commas, control chars
        cleaned = cleaned
          .replace(/,\s*}/g, "}")
          .replace(/,\s*]/g, "]")
          .replace(/[\x00-\x1F\x7F]/g, " ");
        correctedSections = JSON.parse(cleaned);
      }
    } catch (parseErr) {
      console.error("Failed to parse corrections JSON:", parseErr, rawText.slice(0, 500));
      // If AI refused or returned non-JSON, try to apply simple text replacements directly
      const fallback: Record<string, string> = {};
      for (const key of sectionKeys) {
        const entry = bySection[key];
        let text = entry.sectionText;
        for (const fix of entry.fixes) {
          if (fix.flaggedText && fix.suggestedFix && text.includes(fix.flaggedText)) {
            text = text.replace(fix.flaggedText, fix.suggestedFix);
          }
        }
        if (text !== entry.sectionText) {
          fallback[key] = text;
        }
      }
      if (Object.keys(fallback).length > 0) {
        return new Response(
          JSON.stringify({ success: true, correctedSections: fallback }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: "Failed to parse corrected text from AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, correctedSections }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("correct-report error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
