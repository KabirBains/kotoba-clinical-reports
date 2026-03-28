import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "report-documents";
const FILES: Record<string, string> = {
  template: "OT_FCA_Template_v4.1.docx",
  prompts: "OT_AI_Prompt_Templates_v4.1.docx",
  rubric: "OT_Report_Quality_Rubric_v4.1.docx",
};

let cache: { template: string; prompts: string; rubric: string; at: number } | null = null;
const TTL = 30 * 60 * 1000;

// Extract text from docx XML without JSZip
// A .docx is a ZIP file. We use DecompressionStream (built into Deno) 
// or fall back to reading the XML directly.
async function extractTextFromDocx(blob: Blob): Promise<string> {
  try {
    // Try importing JSZip dynamically to avoid startup crash
    const JSZipModule = await import("https://esm.sh/jszip@3.10.1");
    const JSZip = JSZipModule.default;
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file("word/document.xml")?.async("string");
    if (!xml) throw new Error("No document.xml");
    
    return xml
      .replace(/<w:p[^>]*\/>/g, "\n")
      .replace(/<w:p[^>]*>/g, "\n")
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br\/>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch (e) {
    throw new Error("Failed to extract text from docx: " + (e as Error).message);
  }
}

async function loadDocs() {
  if (cache && Date.now() - cache.at < TTL) return cache;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not available");
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const result: Record<string, string> = {};

  for (const [key, fileName] of Object.entries(FILES)) {
    const { data, error } = await sb.storage.from(BUCKET).download(fileName);
    if (error || !data) {
      throw new Error("Failed to load " + fileName + ": " + (error?.message || "no data returned"));
    }
    result[key] = await extractTextFromDocx(data);
  }

  cache = { 
    template: result.template, 
    prompts: result.prompts, 
    rubric: result.rubric, 
    at: Date.now() 
  };
  return cache;
}

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

    const { prompt, max_tokens = 3000 } = body;
    if (!prompt) {
      return new Response(
        JSON.stringify({ success: false, error: "No prompt provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load the 3 reference documents from Storage
    let docs;
    try {
      docs = await loadDocs();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return new Response(
        JSON.stringify({
          success: false,
          error: "Could not load reference documents",
          details: msg,
          fix: "Create a Storage bucket called 'report-documents' and upload the 3 .docx files.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build system prompt with all 3 documents
    const systemPrompt = "You are an expert clinical report writing assistant for Occupational Therapists in the Australian NDIS framework.\n\nYou MUST follow these three reference documents for every output:\n\n=== DOCUMENT 1: FCA REPORT TEMPLATE ===\nThis defines the STRUCTURE of the report. Follow section ordering and content requirements exactly.\n\n" + docs.template + "\n\n=== DOCUMENT 2: AI PROMPT TEMPLATES & WRITING INSTRUCTIONS ===\nThis defines HOW to write each section. Follow writing rules, section-specific instructions, and the assessment synopsis library.\n\n" + docs.prompts + "\n\n=== DOCUMENT 3: QUALITY RUBRIC ===\nThis defines the QUALITY STANDARDS every output must meet. Check your output against all criteria before responding.\n\n" + docs.rubric + "\n\nYOUR ROLE:\n- Transform structured clinical observations into formal, NDIS-quality written prose.\n- Follow the Template for WHERE each section fits.\n- Follow the Prompt Templates for HOW to write each section.\n- Meet ALL Rubric criteria in every output.\n- You write what the clinician tells you. You do NOT make clinical judgements.\n- You do NOT add information not provided by the clinician.\n- Do NOT use markdown formatting. No ## headings, no ** bold **, no * italics *, no bullet point characters.\n- Use plain text only. Headings and formatting will be applied by the document template.\n- Output only the report section text. No preamble, no commentary.";

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
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
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
